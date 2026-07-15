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
import { emailConfigured, sendMagicLink, sendStickyNotification } from "../../lib/email";
import {
  MAX_AVATAR_BYTES,
  MAX_PHOTO_BYTES,
  validateImage,
} from "../../lib/media";
import { pseudonymFor } from "../../lib/pseudonym";
import { MAX_FIELD_LEN, STICKY_COLORS } from "../../shared/types";
import type {
  Me,
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
  CF_ACCOUNT_ID?: string;
  CF_EMAIL_API_TOKEN?: string;
  EMAIL_FROM?: string;
  EMAIL_FROM_NAME?: string;
};

interface MemberRow {
  id: string;
  name: string;
  email: string;
  avatar_key: string | null;
  login_token: string;
  wall_public: number;
  created_at: number;
  last_login_at: number | null;
}

type Variables = { member: MemberRow };
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

function avatarUrl(m: { avatar_key: string | null }): string | null {
  return m.avatar_key ? `/api/media/${m.avatar_key}` : null;
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

// Auth middleware: requires a valid signed session cookie.
async function requireAuth(c: AppContext, next: Next) {
  const cookie = getCookie(c, COOKIE_NAME);
  const memberId = cookie
    ? await verifySession(cookie, c.env.SESSION_SECRET)
    : null;
  if (!memberId) return c.json({ error: "unauthorized" }, 401);

  const member = await c.env.DB.prepare("SELECT * FROM members WHERE id = ?")
    .bind(memberId)
    .first<MemberRow>();
  if (!member) return c.json({ error: "unauthorized" }, 401);

  c.set("member", member);
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

app.get("/members", requireAuth, async (c) => {
  const me = c.get("member");
  const rows = await c.env.DB.prepare(
    `SELECT m.id, m.name, m.avatar_key, m.wall_public,
            (SELECT COUNT(*) FROM stickies s WHERE s.recipient_id = m.id) AS received_count
     FROM members m
     ORDER BY m.name COLLATE NOCASE ASC`,
  ).all<{
    id: string;
    name: string;
    avatar_key: string | null;
    wall_public: number;
    received_count: number;
  }>();

  const members: RosterMember[] = (rows.results ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    avatarUrl: avatarUrl(r),
    wallPublic: r.wall_public === 1,
    isSelf: r.id === me.id,
    receivedCount: r.received_count,
  }));
  return c.json({ members });
});

app.get("/members/:id", requireAuth, async (c) => {
  const me = c.get("member");
  const id = c.req.param("id");

  const member = await c.env.DB.prepare(
    `SELECT m.id, m.name, m.avatar_key, m.wall_public,
            (SELECT COUNT(*) FROM stickies s WHERE s.recipient_id = m.id) AS received_count
     FROM members m WHERE m.id = ?`,
  )
    .bind(id)
    .first<{
      id: string;
      name: string;
      avatar_key: string | null;
      wall_public: number;
      received_count: number;
    }>();
  if (!member) return c.json({ error: "not found" }, 404);

  const isSelf = member.id === me.id;
  const visible = isSelf || member.wall_public === 1;

  const rosterMember: RosterMember = {
    id: member.id,
    name: member.name,
    avatarUrl: avatarUrl(member),
    wallPublic: member.wall_public === 1,
    isSelf,
    receivedCount: member.received_count,
  };

  if (!visible) {
    const res: WallResponse = {
      member: rosterMember,
      isSelf,
      visible: false,
      stickies: [],
    };
    return c.json(res);
  }

  const rows = await c.env.DB.prepare(
    `SELECT s.id, s.author_id, s.is_anonymous, s.described_as, s.good_at,
            s.color, s.photo_key, s.created_at, s.anon_name, s.anon_color,
            a.name AS author_name
     FROM stickies s
     LEFT JOIN members a ON a.id = s.author_id
     WHERE s.recipient_id = ?
     ORDER BY s.created_at DESC`,
  )
    .bind(id)
    .all<{
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
    }>();

  const stickies: Sticky[] = (rows.results ?? []).map((r) => ({
    id: r.id,
    authorName:
      r.is_anonymous === 1 ? (r.anon_name ?? "Anonymous") : r.author_name,
    authorColor: r.is_anonymous === 1 ? r.anon_color : null,
    isAnonymous: r.is_anonymous === 1,
    mine: r.is_anonymous === 0 && r.author_id === me.id,
    describedAs: r.described_as,
    goodAt: r.good_at,
    color: (STICKY_COLORS as readonly string[]).includes(r.color)
      ? (r.color as StickyColor)
      : "yellow",
    photoUrl: r.photo_key ? `/api/media/${r.photo_key}` : null,
    createdAt: r.created_at,
  }));

  const res: WallResponse = { member: rosterMember, isSelf, visible: true, stickies };
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

  const recipient = await c.env.DB.prepare(
    "SELECT id, name, email FROM members WHERE id = ?",
  )
    .bind(recipientId)
    .first<{ id: string; name: string; email: string }>();
  if (!recipient) return c.json({ error: "recipient not found" }, 404);

  const stickyId = newId();

  // Anonymous stickies get a stable, non-reversible codename (e.g. "Pink Leopard").
  const pseudo = isAnonymous
    ? pseudonymFor(me.id, recipientId, c.env.SESSION_SECRET)
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
app.delete("/stickies/:id", requireAuth, async (c) => {
  const me = c.get("member");
  const id = c.req.param("id");

  const sticky = await c.env.DB.prepare(
    "SELECT id, recipient_id, photo_key FROM stickies WHERE id = ?",
  )
    .bind(id)
    .first<{ id: string; recipient_id: string; photo_key: string | null }>();
  if (!sticky) return c.json({ error: "not found" }, 404);
  if (sticky.recipient_id !== me.id) {
    return c.json({ error: "You can only remove stickies from your own wall." }, 403);
  }

  await c.env.DB.prepare("DELETE FROM stickies WHERE id = ?").bind(id).run();
  if (sticky.photo_key) {
    c.executionCtx.waitUntil(c.env.MEDIA.delete(sticky.photo_key).catch(() => {}));
  }
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Media (auth-gated). Avatars are open to any member; sticky photos follow
// the same visibility rule as their wall.
// ---------------------------------------------------------------------------

app.get("/media/*", requireAuth, async (c) => {
  const me = c.get("member");
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
      row.recipient_id === me.id ||
      row.author_id === me.id ||
      row.wall_public === 1;
    if (!allowed) return c.json({ error: "forbidden" }, 403);
  } else if (!key.startsWith("avatars/")) {
    return c.json({ error: "not found" }, 404);
  }

  const object = await c.env.MEDIA.get(key);
  if (!object) return c.json({ error: "not found" }, 404);

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set(
    "Cache-Control",
    key.startsWith("avatars/") ? "private, max-age=3600" : "private, max-age=600",
  );
  return new Response(object.body, { headers });
});

app.notFound((c) => c.json({ error: "not found" }, 404));

export const onRequest = handle(app);
