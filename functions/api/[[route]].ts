import { Hono } from "hono";
import type { Context, Next } from "hono";
import { handle } from "hono/cloudflare-pages";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";

import {
  COOKIE_NAME,
  createSession,
  newId,
  randomToken,
  verifySession,
} from "../../lib/auth";
import {
  emailConfigured,
  sendFeedbackNotification,
  sendMagicLink,
  sendStickyNotification,
} from "../../lib/email";
import {
  MAX_AVATAR_BYTES,
  MAX_PHOTO_BYTES,
  validateImage,
} from "../../lib/media";
import { pseudonymFor } from "../../lib/pseudonym";
import { MAX_FIELD_LEN, STICKY_COLORS } from "../../shared/types";
import type {
  Me,
  Mentor,
  Profile,
  ProfileLink,
  ProfileSection,
  RosterMember,
  Sticky,
  StickyColor,
  WallResponse,
} from "../../shared/types";

type Env = {
  DB: D1Database;
  MEDIA: R2Bucket;
  SESSION_SECRET: string;
  SITE_URL?: string;
  BREVO_API_KEY?: string;
  EMAIL_FROM?: string;
  EMAIL_FROM_NAME?: string;
  FEEDBACK_NOTIFY_EMAIL?: string;
};

const MAX_FEEDBACK_LEN = 2000;

interface MemberRow {
  id: string;
  name: string;
  email: string;
  avatar_key: string | null;
  login_token: string;
  wall_public: number;
  created_at: number;
  last_login_at: number | null;
  photo_key: string | null; // joined from profiles — the cohort photo
  thumb_key: string | null;
}

type Variables = { member: MemberRow; memberId: string };
type AppContext = Context<{ Bindings: Env; Variables: Variables }>;

const app = new Hono<{ Bindings: Env; Variables: Variables }>().basePath("/api");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isHttps(url: string): boolean {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

function siteOrigin(c: AppContext): string {
  if (c.env.SITE_URL) return c.env.SITE_URL.replace(/\/$/, "");
  return new URL(c.req.url).origin;
}

function mediaUrl(key: string | null): string | null {
  return key ? `/api/media/${key}` : null;
}

/** A member's own upload wins; otherwise fall back to their cohort photo. */
function avatarUrl(m: {
  avatar_key: string | null;
  photo_key?: string | null;
}): string | null {
  return mediaUrl(m.avatar_key ?? m.photo_key ?? null);
}

/**
 * Small variant for lists. An uploaded avatar has no thumb (the browser sends a
 * single 512px crop), so it stands in for itself.
 */
function thumbUrl(m: {
  avatar_key: string | null;
  thumb_key?: string | null;
  photo_key?: string | null;
}): string | null {
  return mediaUrl(m.avatar_key ?? m.thumb_key ?? m.photo_key ?? null);
}

/** Profile prose is stored as JSON text in D1; never let a bad row 500 a page. */
function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function toMe(m: MemberRow): Me {
  return {
    id: m.id,
    name: m.name,
    email: m.email,
    avatarUrl: avatarUrl(m),
    wallPublic: m.wall_public === 1,
  };
}

/**
 * Requires a valid session, and nothing else. The cookie is a signed payload
 * carrying the member id, so establishing *who* is asking costs no database
 * work at all — only routes that need the member's own name, email or avatar
 * key have to go and read the row (see requireAuth).
 *
 * That distinction is worth keeping: a roster page fires two dozen image
 * requests, and under requireAuth each one billed a D1 query before it could
 * hand back a 3KB thumbnail.
 */
async function requireSession(c: AppContext, next: Next) {
  const cookie = getCookie(c, COOKIE_NAME);
  const memberId = cookie
    ? await verifySession(cookie, c.env.SESSION_SECRET)
    : null;
  if (!memberId) return c.json({ error: "unauthorized" }, 401);

  c.set("memberId", memberId);
  await next();
}

/** requireSession, plus the member's own row. For routes that read fields
 *  beyond the id. A member deleted from the roster mid-session lands here. */
async function requireAuth(c: AppContext, next: Next) {
  const cookie = getCookie(c, COOKIE_NAME);
  const memberId = cookie
    ? await verifySession(cookie, c.env.SESSION_SECRET)
    : null;
  if (!memberId) return c.json({ error: "unauthorized" }, 401);

  const member = await c.env.DB.prepare(
    `SELECT m.*, p.photo_key, p.thumb_key
     FROM members m LEFT JOIN profiles p ON p.member_id = m.id
     WHERE m.id = ?`,
  )
    .bind(memberId)
    .first<MemberRow>();
  if (!member) return c.json({ error: "unauthorized" }, 401);

  c.set("member", member);
  c.set("memberId", member.id);
  await next();
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

// Magic link: GET /api/auth?token=... -> set cookie -> redirect to app.
app.get("/auth", async (c) => {
  const token = c.req.query("token");
  const origin = siteOrigin(c);
  if (!token) return c.redirect(`${origin}/?error=missing`);

  const member = await c.env.DB.prepare(
    "SELECT * FROM members WHERE login_token = ?",
  )
    .bind(token)
    .first<MemberRow>();
  if (!member) return c.redirect(`${origin}/?error=badlink`);

  const session = await createSession(member.id, c.env.SESSION_SECRET);
  setCookie(c, COOKIE_NAME, session.value, {
    httpOnly: true,
    secure: isHttps(c.req.url),
    sameSite: "Lax",
    path: "/",
    maxAge: session.maxAge,
  });

  await c.env.DB.prepare("UPDATE members SET last_login_at = ? WHERE id = ?")
    .bind(Date.now(), member.id)
    .run();

  return c.redirect(`${origin}/`);
});

app.post("/logout", (c) => {
  deleteCookie(c, COOKIE_NAME, { path: "/" });
  return c.json({ ok: true });
});

// Optional self-service resend of a login link.
app.post("/request-link", async (c) => {
  const body = await c.req
    .json<{ email?: string }>()
    .catch(() => ({}) as { email?: string });
  const email = (body.email || "").trim().toLowerCase();
  if (!email) return c.json({ error: "email required" }, 400);

  if (!emailConfigured(c.env)) {
    return c.json({ sent: false, reason: "email-not-configured" });
  }

  const member = await c.env.DB.prepare(
    "SELECT * FROM members WHERE lower(email) = ?",
  )
    .bind(email)
    .first<MemberRow>();

  if (member) {
    const link = `${siteOrigin(c)}/api/auth?token=${member.login_token}`;
    try {
      await sendMagicLink(c.env, member.email, member.name, link);
    } catch (err) {
      console.error("sendMagicLink failed", err);
      return c.json({ sent: false, reason: "send-failed" }, 502);
    }
  }
  // Generic response regardless of whether the email is on the roster.
  return c.json({ sent: true });
});

// ---------------------------------------------------------------------------
// Current member
// ---------------------------------------------------------------------------

app.get("/me", requireAuth, (c) => {
  return c.json(toMe(c.get("member")));
});

app.patch("/me", requireAuth, async (c) => {
  const member = c.get("member");
  const body = await c.req
    .json<{ wallPublic?: boolean }>()
    .catch(() => ({}) as { wallPublic?: boolean });
  if (typeof body.wallPublic !== "boolean") {
    return c.json({ error: "wallPublic (boolean) required" }, 400);
  }
  await c.env.DB.prepare("UPDATE members SET wall_public = ? WHERE id = ?")
    .bind(body.wallPublic ? 1 : 0, member.id)
    .run();
  return c.json({ ...toMe(member), wallPublic: body.wallPublic });
});

app.post("/me/avatar", requireAuth, async (c) => {
  const member = c.get("member");
  const body = await c.req.parseBody();
  const file = body["avatar"];
  if (!(file instanceof File)) {
    return c.json({ error: "avatar file required" }, 400);
  }
  const check = validateImage(file, MAX_AVATAR_BYTES);
  if (!check.ok) return c.json({ error: check.error }, 400);

  // Unique key per upload so browsers never serve a stale cached avatar.
  const key = `avatars/${member.id}-${Date.now()}`;
  await c.env.MEDIA.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });

  // Best-effort cleanup of the previous avatar object.
  if (member.avatar_key) {
    c.executionCtx.waitUntil(
      c.env.MEDIA.delete(member.avatar_key).catch(() => {}),
    );
  }

  await c.env.DB.prepare("UPDATE members SET avatar_key = ? WHERE id = ?")
    .bind(key, member.id)
    .run();

  return c.json({ avatarUrl: `/api/media/${key}` });
});

// ---------------------------------------------------------------------------
// Roster + walls
// ---------------------------------------------------------------------------

interface RosterRow {
  id: string;
  name: string;
  avatar_key: string | null;
  wall_public: number;
  received_count: number;
  photo_key: string | null;
  thumb_key: string | null;
  session: string | null;
  tagline: string | null;
}

/** A roster row plus the prose only a single wall needs. */
interface ProfileRow extends RosterRow {
  intro: string | null;
  sections: string | null;
  links: string | null;
}

interface StickyRow {
  id: string;
  author_id: string | null;
  is_anonymous: number;
  described_as: string;
  good_at: string;
  color: string;
  photo_key: string | null;
  created_at: number;
  anon_name: string | null;
  anon_color: string | null;
  author_name: string | null;
}

function toRosterMember(r: RosterRow, meId: string): RosterMember {
  return {
    id: r.id,
    name: r.name,
    avatarUrl: avatarUrl(r),
    thumbUrl: thumbUrl(r),
    wallPublic: r.wall_public === 1,
    isSelf: r.id === meId,
    receivedCount: r.received_count,
    session: r.session,
    tagline: r.tagline,
  };
}

// The roster deliberately carries only the card-sized bits of a profile
// (photo, session, tagline). The prose is fetched per member.
app.get("/members", requireSession, async (c) => {
  const meId = c.get("memberId");
  const rows = await c.env.DB.prepare(
    `SELECT m.id, m.name, m.avatar_key, m.wall_public,
            p.photo_key, p.thumb_key, p.session, p.tagline,
            (SELECT COUNT(*) FROM stickies s WHERE s.recipient_id = m.id) AS received_count
     FROM members m
     LEFT JOIN profiles p ON p.member_id = m.id
     ORDER BY m.name COLLATE NOCASE ASC`,
  ).all<RosterRow>();

  const members = (rows.results ?? []).map((r) => toRosterMember(r, meId));
  return c.json({ members });
});

// Mentors are read-only: browsable by any signed-in member, but they have no
// wall and cannot be given stickies, so this is a plain list.
app.get("/mentors", requireSession, async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT id, slug, name, nickname, role, skills, tagline, photo_key, thumb_key, intro, sections, links
     FROM mentors
     ORDER BY sort_order ASC, name COLLATE NOCASE ASC`,
  ).all<{
    id: string;
    slug: string;
    name: string;
    nickname: string | null;
    role: string | null;
    skills: string;
    tagline: string | null;
    photo_key: string | null;
    thumb_key: string | null;
    intro: string | null;
    sections: string;
    links: string;
  }>();

  const mentors: Mentor[] = (rows.results ?? []).map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    nickname: r.nickname,
    role: r.role,
    skills: parseJson<string[]>(r.skills, []),
    tagline: r.tagline,
    photoUrl: mediaUrl(r.photo_key),
    thumbUrl: mediaUrl(r.thumb_key ?? r.photo_key),
    intro: r.intro ?? "",
    sections: parseJson<ProfileSection[]>(r.sections, []),
    links: parseJson<ProfileLink[]>(r.links, []),
  }));
  return c.json({ mentors });
});

app.get("/members/:id", requireSession, async (c) => {
  const meId = c.get("memberId");
  const id = c.req.param("id");

  // The wall's two reads — whose wall it is, and what's on it — go out in one
  // batch. They aren't dependent (the visibility check only gates whether the
  // notes are *returned*), and a wall used to cost three serial D1 round trips
  // before it could paint. Fetching notes for a wall that turns out to be
  // private wastes one cheap indexed read; a second round trip cost more.
  const [memberRes, stickyRes] = await c.env.DB.batch<Record<string, unknown>>([
    c.env.DB.prepare(
      `SELECT m.id, m.name, m.avatar_key, m.wall_public,
              p.photo_key, p.thumb_key, p.session, p.tagline, p.intro, p.sections, p.links,
              (SELECT COUNT(*) FROM stickies s WHERE s.recipient_id = m.id) AS received_count
       FROM members m
       LEFT JOIN profiles p ON p.member_id = m.id
       WHERE m.id = ?`,
    ).bind(id),
    c.env.DB.prepare(
      `SELECT s.id, s.author_id, s.is_anonymous, s.described_as, s.good_at,
              s.color, s.photo_key, s.created_at, s.anon_name, s.anon_color,
              a.name AS author_name
       FROM stickies s
       LEFT JOIN members a ON a.id = s.author_id
       WHERE s.recipient_id = ?
       ORDER BY s.created_at DESC`,
    ).bind(id),
  ]);

  let member = (memberRes.results?.[0] ?? null) as unknown as ProfileRow | null;
  let isMentor = false;

  if (!member) {
    const mentor = await c.env.DB.prepare(
      `SELECT id, slug, name, nickname, role, skills, tagline, photo_key, thumb_key, intro, sections, links,
              (SELECT COUNT(*) FROM stickies s WHERE s.recipient_id = mentors.id) AS received_count
       FROM mentors
       WHERE id = ?`,
    )
      .bind(id)
      .first<{
        id: string;
        name: string;
        nickname: string | null;
        role: string | null;
        skills: string;
        tagline: string | null;
        photo_key: string | null;
        thumb_key: string | null;
        intro: string | null;
        sections: string;
        links: string;
        received_count: number;
      }>();

    if (!mentor) return c.json({ error: "not found" }, 404);

    isMentor = true;
    member = {
      id: mentor.id,
      name: mentor.name,
      avatar_key: mentor.photo_key,
      wall_public: 1, // Mentor walls are public
      photo_key: mentor.photo_key,
      thumb_key: mentor.thumb_key,
      session: mentor.role, // show role instead of AM/PM session
      tagline: mentor.tagline,
      intro: mentor.intro,
      sections: mentor.sections,
      links: mentor.links,
      received_count: mentor.received_count,
    };
  }

  const isSelf = member.id === meId;
  const visible = isSelf || member.wall_public === 1 || isMentor;
  const rosterMember = toRosterMember(member, meId);

  // A profile introduces someone to the cohort, so it stays readable even when
  // they keep their sticky wall private. Members without a profile get null.
  const profile: Profile | null = member.sections
    ? {
        session: member.session,
        tagline: member.tagline,
        intro: member.intro ?? "",
        sections: parseJson<ProfileSection[]>(member.sections, []),
        links: parseJson<ProfileLink[]>(member.links, []),
      }
    : null;

  if (!visible) {
    const res: WallResponse = {
      member: rosterMember,
      isSelf,
      visible: false,
      stickies: [],
      profile,
    };
    return c.json(res);
  }

  const stickyRows = (stickyRes.results ?? []) as unknown as StickyRow[];

  const stickies: Sticky[] = stickyRows.map((r) => ({
    id: r.id,
    authorName:
      r.is_anonymous === 1 ? (r.anon_name ?? "Anonymous") : r.author_name,
    authorColor: r.is_anonymous === 1 ? r.anon_color : null,
    isAnonymous: r.is_anonymous === 1,
    mine: r.is_anonymous === 0 && r.author_id === meId,
    describedAs: r.described_as,
    goodAt: r.good_at,
    color: (STICKY_COLORS as readonly string[]).includes(r.color)
      ? (r.color as StickyColor)
      : "yellow",
    photoUrl: r.photo_key ? `/api/media/${r.photo_key}` : null,
    createdAt: r.created_at,
  }));

  const res: WallResponse = {
    member: rosterMember,
    isSelf,
    visible: true,
    stickies,
    profile,
  };
  return c.json(res);
});

// ---------------------------------------------------------------------------
// Stickies
// ---------------------------------------------------------------------------

app.post("/stickies", requireAuth, async (c) => {
  const me = c.get("member");
  const body = await c.req.parseBody();

  const recipientId = String(body["recipient_id"] ?? "");
  const describedAs = String(body["described_as"] ?? "").trim().slice(0, MAX_FIELD_LEN);
  const goodAt = String(body["good_at"] ?? "").trim().slice(0, MAX_FIELD_LEN);
  const isAnonymous = String(body["is_anonymous"] ?? "") === "true";
  const colorRaw = String(body["color"] ?? "yellow");
  const color = (STICKY_COLORS as readonly string[]).includes(colorRaw)
    ? colorRaw
    : "yellow";

  if (!recipientId) return c.json({ error: "recipient_id required" }, 400);
  if (recipientId === me.id) {
    return c.json({ error: "You can't give yourself a sticky." }, 400);
  }
  if (!describedAs && !goodAt) {
    return c.json({ error: "Write at least one of the two fields." }, 400);
  }

  let recipient = await c.env.DB.prepare(
    "SELECT id, name, email FROM members WHERE id = ?",
  )
    .bind(recipientId)
    .first<{ id: string; name: string; email: string }>();

  if (!recipient) {
    recipient = await c.env.DB.prepare(
      "SELECT id, name, email FROM mentors WHERE id = ?",
    )
      .bind(recipientId)
      .first<{ id: string; name: string; email: string }>();
  }
  if (!recipient) return c.json({ error: "recipient not found" }, 404);

  const stickyId = newId();

  // Anonymous stickies get a random codename (e.g. "Pink Leopard").
  const pseudo = isAnonymous
    ? pseudonymFor()
    : null;

  // Optional photo attachment.
  let photoKey: string | null = null;
  const photo = body["photo"];
  if (photo instanceof File && photo.size > 0) {
    const check = validateImage(photo, MAX_PHOTO_BYTES);
    if (!check.ok) return c.json({ error: check.error }, 400);
    photoKey = `stickies/${stickyId}`;
    await c.env.MEDIA.put(photoKey, await photo.arrayBuffer(), {
      httpMetadata: { contentType: photo.type },
    });
  }

  const createdAt = Date.now();
  await c.env.DB.prepare(
    `INSERT INTO stickies
       (id, recipient_id, author_id, is_anonymous, described_as, good_at, color, photo_key, created_at, anon_name, anon_color)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      stickyId,
      recipientId,
      isAnonymous ? null : me.id, // anonymity is guaranteed by storage
      isAnonymous ? 1 : 0,
      describedAs,
      goodAt,
      color,
      photoKey,
      createdAt,
      pseudo?.name ?? null,
      isAnonymous ? pseudo?.color ?? null : null,
    )
    .run();

  // Send an email notification asynchronously if configured
  if (recipient.email) {
    const authorNameForEmail = isAnonymous ? (pseudo?.name ?? "Someone") : me.name;
    const link = `${c.env.SITE_URL || "https://academy-stickies.pages.dev"}/me`;
    c.executionCtx.waitUntil(
      sendStickyNotification(
        c.env,
        recipient.email,
        recipient.name,
        authorNameForEmail,
        link
      ).catch(console.error)
    );
  }

  const sticky: Sticky = {
    id: stickyId,
    authorName: isAnonymous ? (pseudo?.name ?? "Anonymous") : me.name,
    authorColor: pseudo?.color ?? null,
    isAnonymous,
    mine: !isAnonymous,
    describedAs,
    goodAt,
    color: color as StickyColor,
    photoUrl: photoKey ? `/api/media/${photoKey}` : null,
    createdAt,
  };
  return c.json({ sticky }, 201);
});

// The recipient can remove a sticky from their own wall.
app.delete("/stickies/:id", requireSession, async (c) => {
  const meId = c.get("memberId");
  const id = c.req.param("id");

  const sticky = await c.env.DB.prepare(
    "SELECT id, recipient_id, photo_key FROM stickies WHERE id = ?",
  )
    .bind(id)
    .first<{ id: string; recipient_id: string; photo_key: string | null }>();
  if (!sticky) return c.json({ error: "not found" }, 404);
  if (sticky.recipient_id !== meId) {
    return c.json({ error: "You can only remove stickies from your own wall." }, 403);
  }

  await c.env.DB.prepare("DELETE FROM stickies WHERE id = ?").bind(id).run();
  if (sticky.photo_key) {
    c.executionCtx.waitUntil(c.env.MEDIA.delete(sticky.photo_key).catch(() => {}));
  }
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------

app.post("/feedback", requireAuth, async (c) => {
  const me = c.get("member");
  const body = await c.req
    .json<{ message?: string }>()
    .catch(() => ({}) as { message?: string });
  const message = String(body.message ?? "").trim().slice(0, MAX_FEEDBACK_LEN);
  if (!message) return c.json({ error: "Write something first." }, 400);

  const id = newId();
  const createdAt = Date.now();
  await c.env.DB.prepare(
    "INSERT INTO feedback (id, member_id, message, created_at) VALUES (?, ?, ?, ?)",
  )
    .bind(id, me.id, message, createdAt)
    .run();

  if (c.env.FEEDBACK_NOTIFY_EMAIL) {
    c.executionCtx.waitUntil(
      sendFeedbackNotification(c.env, c.env.FEEDBACK_NOTIFY_EMAIL, me.name, message).catch(
        console.error,
      ),
    );
  }

  return c.json({ ok: true }, 201);
});

// ---------------------------------------------------------------------------
// Media (auth-gated). Avatars and cohort photos (learners/, mentors/) are open
// to any signed-in member; sticky photos follow the same visibility rule as
// their wall. Nothing here is reachable without a session — these are real
// people's faces, so there is no public path to them.
// ---------------------------------------------------------------------------

const OPEN_MEDIA_PREFIXES = ["avatars/", "learners/", "mentors/"];

app.get("/media/*", requireSession, async (c) => {
  const meId = c.get("memberId");
  const key = decodeURIComponent(c.req.path.slice("/api/media/".length));
  if (!key) return c.json({ error: "not found" }, 404);

  if (key.startsWith("stickies/")) {
    const stickyId = key.slice("stickies/".length);
    const row = await c.env.DB.prepare(
      `SELECT s.author_id, s.recipient_id, m.wall_public
       FROM stickies s JOIN members m ON m.id = s.recipient_id
       WHERE s.id = ?`,
    )
      .bind(stickyId)
      .first<{ author_id: string | null; recipient_id: string; wall_public: number }>();
    if (!row) return c.json({ error: "not found" }, 404);
    const allowed =
      row.recipient_id === meId ||
      row.author_id === meId ||
      row.wall_public === 1;
    if (!allowed) return c.json({ error: "forbidden" }, 403);
  } else if (!OPEN_MEDIA_PREFIXES.some((p) => key.startsWith(p))) {
    return c.json({ error: "not found" }, 404);
  }

  const object = await c.env.MEDIA.get(key);
  if (!object) return c.json({ error: "not found" }, 404);

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  // Nothing here is ever rewritten under the same key — cohort photos are
  // keyed by name, and an avatar upload mints a fresh key each time — so faces
  // can be cached hard and never revalidated. Sticky photos are the exception:
  // their key is stable, but the wall around them can turn private, and a long
  // cache would keep serving a photo the viewer has since lost access to.
  const rewritable = key.startsWith("stickies/");
  headers.set(
    "Cache-Control",
    rewritable
      ? "private, max-age=600"
      : "private, max-age=31536000, immutable",
  );
  return new Response(object.body, { headers });
});

app.notFound((c) => c.json({ error: "not found" }, 404));

export const onRequest = handle(app);
