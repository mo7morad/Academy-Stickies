/**
 * Parse the (gitignored) Cohort/ folder into D1 seed SQL + optimized WebP photos.
 *
 *   npm run cohort           # build SQL + photos, seed local D1
 *   npm run cohort:remote    # ...and seed the deployed D1
 *
 * Cohort/ holds student and mentor PII (emails, prose, faces) and is never
 * committed. This script turns it into:
 *   - scripts/.generated.cohort.sql   (gitignored) -> D1 profiles/mentors tables
 *   - .cohort-media/{learners,mentors}/<slug>.webp (gitignored) -> R2 via upload-cohort-media
 *
 * Both source formats are messy hand-written Markdown, so the parser is
 * deliberately forgiving: it keeps each author's own section order and only
 * normalizes headings enough to render them consistently.
 */
import { execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, join } from "node:path";
import { loose, normalizeProse, stripTags, toTagline } from "../shared/text";
import { d1ExecFile, isRemote, sqlQuote } from "./util";

const COHORT_DIR = "Cohort";
const MEDIA_DIR = ".cohort-media";
const SQL_FILE = "scripts/.generated.cohort.sql";

// Two sizes, because one cannot serve both jobs well:
//   full  — profile headers (104-132px, so 400 covers 3x)
//   thumb — the roster's 66px grid of 200+ faces (144 covers 2x)
// Serving `full` into the roster wasted ~709 KiB per mobile load.
const PHOTO_PX = 400;
const THUMB_PX = 144;

interface CohortEntry {
  full_name: string;
  email: string;
  session: string;
  profile_url: string;
  photo_path: string;
  profile_md_path: string;
}

interface Section {
  title: string;
  body: string;
}

interface Link {
  label: string;
  url: string;
}

interface Person {
  slug: string;
  name: string;
  email: string;
  session: string;
  nickname: string | null;
  role: string | null;
  skills: string[];
  intro: string;
  tagline: string;
  sections: Section[];
  links: Link[];
  photoKey: string | null;
  thumbKey: string | null;
}

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

const EMOJI =
  /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{1F1E6}-\u{1F1FF}\u{FE00}-\u{FE0F}\u{200D}]/gu;

/**
 * Strip tags, emoji and Markdown emphasis from a heading so variants collapse
 * together. Titles never pass through tidyBody, so without stripTags they kept
 * whatever the author typed — sections rendered as "My Strengths<br/>".
 */
function cleanHeading(raw: string): string {
  return stripTags(raw)
    .replace(EMOJI, "")
    .replace(/==/g, "")
    .replace(/[*_~`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[:?.]+$/, "")
    .trim();
}

/** Heading variants seen across both cohorts -> one label we actually render. */
const CANONICAL: Record<string, string> = {
  "about me": "About Me",
  "who am i": "Who I Am",
  hello: "Who I Am",
  "my strengths": "Strengths",
  strengths: "Strengths",
  "what am i skilled at": "Skills",
  "skills and expertise": "Skills",
  skills: "Skills",
  "my goals": "Goals",
  goals: "Goals",
  "my starting point": "Starting Point",
  "starting point": "Starting Point",
  "where am i before the academy": "Before the Academy",
  "where was i before the academy": "Before the Academy",
  "what have you been doing before academy": "Before the Academy",
  "past work and experience": "Before the Academy",
  "my interest": "Interests",
  "my interests": "Interests",
  "what are you interested in": "Interests",
  "what do i do in my free time": "Free Time",
  "what i want to learn": "What I Want to Learn",
  "what she love to talk about and love to learn more": "What I Want to Learn",
  "fun facts": "Fun Facts",
  "fun fact": "Fun Facts",
  "important facts": "Fun Facts",
  "value & vibes": "Values & Vibes",
  "values & vibes": "Values & Vibes",
  contact: "Contact",
  contacts: "Contact",
  "you can find me on": "Contact",
  // Keys used by mentors who wrote their whole profile inside the details table.
  "past experiences": "Before the Academy",
  "interests and hobbies": "Interests",
  highlight: "Highlight",
};

/** Zero-width characters ride along in Docs exports and break every match. */
const ZERO_WIDTH = /[​-‍﻿]/g;

/**
 * Three profiles were pasted out of a Google Docs export, which dumps the
 * editor's own sidebar into the file: app chrome, a read time, the document
 * outline, then the title again. All of it lands in the intro and becomes the
 * tagline — "Document meeting options View Docs activity center More options".
 *
 * Every line of that dump is a fragment, so the cut runs to the first line of
 * real prose. The marker gates it to the files that carry the dump; the other
 * 204 are hand-written and must not be touched by this.
 */
const DOC_EXPORT = /^(add page|copy doc link)\s*$/im;

function isProse(line: string): boolean {
  return line.trim().split(/\s+/).filter(Boolean).length >= 8;
}

function dropDocExportHead(md: string): string {
  if (!DOC_EXPORT.test(md)) return md;
  const lines = md.split("\n");
  const start = lines.findIndex(isProse);
  return start < 0 ? md : lines.slice(start).join("\n");
}

/**
 * Exports also repeat the page title — the member's own name — as the first
 * line of the body, where it lands in the intro and then the tagline: cards
 * read "Abuidillah Adjie Muliadi Hi, Abui here!".
 */
function dropRepeatedName(lines: string[], name: string): string[] {
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (line && loose(line) !== loose(name)) break;
    i++;
  }
  return lines.slice(i);
}

/** Details-table keys that map onto structured fields rather than prose. */
const META_KEYS = ["name", "nickname", "role", "skills"];

/** Details-table keys whose value is only a bag of URLs. */
const LINK_KEYS = /^(social media links|social media|social|links|contact|contacts)$/;

function canonicalTitle(heading: string): string {
  const cleaned = cleanHeading(heading);
  const hit = CANONICAL[cleaned.toLowerCase()];
  if (hit) return hit;
  // Unknown heading: keep the author's wording, just tidied up.
  return cleaned.replace(/\s+/g, " ").trim();
}

/** Mentors self-report roles as "Tech mentor"/"Tech Mentor"/"Design mentor". */
function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function tidyBody(raw: string): string {
  return normalizeProse(
    raw
      .split("\n")
      .filter((l) => !/^\s*[-*_]{3,}\s*$/.test(l)) // horizontal rules
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  );
}

function extractLinks(body: string): Link[] {
  const links: Link[] = [];
  const seen = new Set<string>();

  // Label may be empty — several profiles contain a bare `[](https://…)`.
  for (const m of body.matchAll(/\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g)) {
    const url = m[2];
    if (seen.has(url)) continue;
    seen.add(url);
    links.push({ label: cleanHeading(m[1]) || hostLabel(url), url });
  }
  // Bare URLs that were not already part of a Markdown link.
  for (const m of body.matchAll(/(?<!\()\bhttps?:\/\/[^\s)<>"']+/g)) {
    const url = m[0].replace(/[.,;]$/, "");
    if (seen.has(url)) continue;
    seen.add(url);
    links.push({ label: hostLabel(url), url });
  }
  return links;
}

function hostLabel(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const name = host.split(".")[0];
    return name.charAt(0).toUpperCase() + name.slice(1);
  } catch {
    return "Link";
  }
}

// ---------------------------------------------------------------------------
// Markdown -> Person
// ---------------------------------------------------------------------------

/**
 * A Markdown table squashes a bullet list onto one line ("- a- b- c").
 * Restore the breaks so it renders as the list the author wrote.
 */
function unmashList(value: string): string {
  const text = value.trim();
  if ((text.match(/-\s+\S/g)?.length ?? 0) < 2) return text;
  return text.replace(/\s*-\s+/g, "\n- ").replace(/^\n/, "").trim();
}

function parseTableRows(lines: string[]): Record<string, string> {
  const meta: Record<string, string> = {};
  for (const raw of lines) {
    const line = raw.trim();
    if (/^\|[\s|:-]+\|?$/.test(line)) continue; // separator row
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length >= 2) {
      const key = cleanHeading(cells[0]).toLowerCase();
      const value = cells.slice(1).join(" | ").trim();
      if (key && value) meta[key] = value;
    }
  }
  return meta;
}

/**
 * Pull the `| Key | Value |` details table out of a mentor profile. It usually
 * opens the file, but several authors put a greeting, a heading or their photo
 * above it — so scan for the first table that actually looks like the meta one.
 */
function takeTable(lines: string[]): {
  meta: Record<string, string>;
  rest: string[];
} {
  let i = 0;
  while (i < lines.length) {
    if (!lines[i].trim().startsWith("|")) {
      i++;
      continue;
    }
    let end = i;
    while (end < lines.length && lines[end].trim().startsWith("|")) end++;

    const meta = parseTableRows(lines.slice(i, end));
    if (Object.keys(meta).some((k) => META_KEYS.includes(k))) {
      return { meta, rest: [...lines.slice(0, i), ...lines.slice(end)] };
    }
    i = end; // a table, but not the details one — keep looking
  }
  return { meta: {}, rest: lines };
}

/**
 * Nicknames are free text, so they range from "Javi" to "yes, Wais." — keep the
 * ones that add something, drop the ones that just restate the name.
 */
function cleanNickname(raw: string | null, displayName: string): string | null {
  if (!raw) return null;
  const nick = cleanHeading(raw).replace(/[.,;]+$/, "").trim();
  if (!nick || nick.length > 24) return null;
  if (loose(nick) === loose(displayName)) return null;
  // "yes, Wais." next to the name "Wais" tells the reader nothing new.
  if (nick.split(/[\s,]+/).some((w) => w && loose(w) === loose(displayName))) {
    return null;
  }
  return nick;
}

function parseProfile(
  md: string,
  name: string,
): Omit<
  Person,
  "slug" | "email" | "session" | "photoKey" | "thumbKey" | "name"
> & {
  tableName: string | null;
} {
  // Drop embedded photos — we serve optimized copies from R2 instead.
  const cleaned = dropDocExportHead(md.replace(ZERO_WIDTH, "")).replace(
    /!\[[^\]]*\]\([^)]*\)/g,
    "",
  );
  const { meta, rest } = takeTable(cleaned.split("\n"));

  const preamble: string[] = [];
  const sections: Section[] = [];
  let current: { title: string; level: number; body: string[] } | null = null;

  for (const line of rest) {
    const h = line.match(/^\s{0,3}(#{1,3})\s+(.*\S)\s*$/);
    if (h) {
      if (current) sections.push({ title: current.title, body: tidyBody(current.body.join("\n")) });
      current = { title: h[2], level: h[1].length, body: [] };
      continue;
    }
    (current ? current.body : preamble).push(line);
  }
  if (current) sections.push({ title: current.title, body: tidyBody(current.body.join("\n")) });

  let intro = tidyBody(dropRepeatedName(preamble, name).join("\n"));

  // Learner files open with `# Their Name` — that's a title, not a section, so
  // fold its prose into the intro. The repeated title usually sits under that
  // heading rather than above it, so it arrives here, not in the preamble.
  if (sections.length && loose(cleanHeading(sections[0].title)) === loose(name)) {
    const first = sections.shift()!;
    const body = dropRepeatedName(first.body.split("\n"), name).join("\n");
    intro = tidyBody([intro, body].filter(Boolean).join("\n\n"));
  }

  // Contact sections become link chips rather than a wall of URLs.
  const links: Link[] = [];
  const kept: Section[] = [];
  for (const s of sections) {
    const title = canonicalTitle(s.title);
    if (!title) continue;
    if (title === "Contact") {
      links.push(...extractLinks(s.body));
      continue;
    }
    if (s.body) kept.push({ title, body: s.body });
  }
  links.push(...extractLinks(intro));
  // Some details tables carry a "Social media links" row.
  for (const value of Object.values(meta)) links.push(...extractLinks(value));

  // A few mentors wrote their whole profile as table rows instead of sections
  // ("Past experiences", "Interests and Hobbies", "Fun facts"). Those rows are
  // the profile, so promote them rather than dropping them on the floor.
  for (const [key, value] of Object.entries(meta)) {
    if (META_KEYS.includes(key) || LINK_KEYS.test(key)) continue;
    const body = unmashList(value);
    if (body) kept.push({ title: canonicalTitle(key), body });
  }

  const skills = (meta.skills ?? "")
    .split(/,(?![^(]*\))/)
    .map((s) => cleanHeading(s))
    .filter(Boolean);

  const taglineSource = intro || kept[0]?.body || "";

  return {
    // Mentor tables carry the real full name ("Nima M'HIN") while the roster
    // only knows a short one ("Nima"); prefer the fuller of the two.
    tableName: meta.name ? cleanHeading(meta.name) : null,
    nickname: meta.nickname ? cleanHeading(meta.nickname) : null,
    role: meta.role ? titleCase(cleanHeading(meta.role)) : null,
    skills,
    intro,
    tagline: toTagline(taglineSource),
    sections: kept,
    links: dedupeLinks(links),
  };
}

function dedupeLinks(links: Link[]): Link[] {
  const seen = new Set<string>();
  return links.filter((l) => {
    const key = l.url.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Photos
// ---------------------------------------------------------------------------

/**
 * R2 object keys ride inside a URL path, so the slug "Muthia_Khaerinah_S."
 * becomes ".../Muthia_Khaerinah_S..webp" — which the API reads as a traversal
 * segment and rejects with 403. Names are people's own text, so normalize the
 * key to a boring alphabet instead of trusting the filename.
 */
function mediaSlug(slug: string): string {
  return (
    slug
      .normalize("NFKD")
      .replace(/[^A-Za-z0-9_-]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "") || "profile"
  );
}

function imageSize(file: string): { w: number; h: number } | null {
  try {
    const out = execFileSync("sips", ["-g", "pixelWidth", "-g", "pixelHeight", file], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const w = Number(out.match(/pixelWidth:\s*(\d+)/)?.[1]);
    const h = Number(out.match(/pixelHeight:\s*(\d+)/)?.[1]);
    return w && h ? { w, h } : null;
  } catch {
    return null;
  }
}

function encode(
  src: string,
  out: string,
  crop: { x: number; y: number; side: number },
  px: number,
  quality: string,
): boolean {
  try {
    execFileSync(
      "cwebp",
      [
        "-quiet",
        "-q", quality,
        // cwebp crops before resizing, so this squares the frame first.
        "-crop", String(crop.x), String(crop.y), String(crop.side), String(crop.side),
        "-resize", String(px), String(px),
        src,
        "-o", out,
      ],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
    return true;
  } catch {
    return false;
  }
}

/** Centre-crop to a square and encode both the full and thumb WebP variants. */
function buildPhoto(
  src: string,
  destDir: string,
  slug: string,
): { full: boolean; thumb: boolean } {
  if (!existsSync(src)) return { full: false, thumb: false };
  const size = imageSize(src);
  if (!size) return { full: false, thumb: false };

  const side = Math.min(size.w, size.h);
  const crop = {
    x: Math.round((size.w - side) / 2),
    y: Math.round((size.h - side) / 2),
    side,
  };

  return {
    full: encode(src, join(destDir, `${slug}.webp`), crop, PHOTO_PX, "78"),
    // Thumbs are shown at 66px; a lower quality is invisible there and halves
    // the bytes again across 200+ faces.
    thumb: encode(src, join(destDir, `${slug}_sm.webp`), crop, THUMB_PX, "72"),
  };
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

function readEntries(file: string): CohortEntry[] {
  return JSON.parse(readFileSync(file, "utf8")) as CohortEntry[];
}

/** A high-entropy magic-link token for a mentor's new member row (matches the
 *  256-bit base64url tokens scripts/seed.ts mints for roster members). */
function mentorToken(): string {
  return randomBytes(32).toString("base64url");
}

function loadGroup(
  group: "learners" | "seniors",
  mediaSub: "learners" | "mentors",
): Person[] {
  const dir = join(COHORT_DIR, group);
  const entries = readEntries(join(dir, "partial.json"));
  const destDir = join(MEDIA_DIR, mediaSub);
  mkdirSync(destDir, { recursive: true });

  const people: Person[] = [];
  for (const e of entries) {
    const name = (e.full_name || "").trim();
    if (!name) continue;

    const slug = basename(e.profile_md_path || "", ".md") || name.replace(/\s+/g, "_");
    const mdPath = join(dir, "profiles", `${slug}.md`);
    if (!existsSync(mdPath)) {
      console.warn(`  ! no profile markdown for ${name} (${slug})`);
      continue;
    }

    const { tableName, ...parsed } = parseProfile(readFileSync(mdPath, "utf8"), name);
    const key = mediaSlug(slug);
    const photo = buildPhoto(join(dir, "photos", `${slug}.jpg`), destDir, key);

    // A mentor's table name ("Nima M'HIN") beats the roster's short one ("Nima"),
    // which then serves as the nickname if they didn't give one themselves.
    const displayName = tableName && tableName.length > name.length ? tableName : name;

    people.push({
      ...parsed,
      nickname: cleanNickname(parsed.nickname ?? (displayName !== name ? name : null), displayName),
      slug,
      name: displayName,
      email: (e.email || "").trim().toLowerCase(),
      session: (e.session || "").trim().toUpperCase(),
      photoKey: photo.full ? `${mediaSub}/${key}.webp` : null,
      thumbKey: photo.thumb ? `${mediaSub}/${key}_sm.webp` : null,
    });
  }
  return people;
}

function main() {
  if (!existsSync(COHORT_DIR)) {
    console.error(
      `${COHORT_DIR}/ not found. It holds cohort PII and is intentionally gitignored —\n` +
        `restore it locally before running this script.`,
    );
    process.exit(1);
  }

  rmSync(MEDIA_DIR, { recursive: true, force: true });

  console.log("Parsing learners…");
  const learners = loadGroup("learners", "learners");
  console.log("Parsing mentors…");
  const mentors = loadGroup("seniors", "mentors");

  const now = Date.now();
  const sql: string[] = [];

  // Learners attach to an existing roster member by email, so anyone not on the
  // roster is skipped by the SELECT rather than creating an orphan profile.
  for (const p of learners) {
    if (!p.email) {
      console.warn(`  ! skipping ${p.name}: no email to match a member on`);
      continue;
    }
    sql.push(
      `INSERT INTO profiles (member_id, slug, session, tagline, photo_key, thumb_key, intro, sections, links, updated_at)\n` +
        `SELECT m.id, ${sqlQuote(p.slug)}, ${p.session ? sqlQuote(p.session) : "NULL"}, ` +
        `${sqlQuote(p.tagline)}, ${p.photoKey ? sqlQuote(p.photoKey) : "NULL"}, ` +
        `${p.thumbKey ? sqlQuote(p.thumbKey) : "NULL"}, ${sqlQuote(p.intro)}, ` +
        `${sqlQuote(JSON.stringify(p.sections))}, ${sqlQuote(JSON.stringify(p.links))}, ${now}\n` +
        `FROM members m WHERE lower(m.email) = ${sqlQuote(p.email)}\n` +
        `ON CONFLICT(member_id) DO UPDATE SET slug=excluded.slug, session=excluded.session, ` +
        `tagline=excluded.tagline, photo_key=excluded.photo_key, thumb_key=excluded.thumb_key, ` +
        `intro=excluded.intro, sections=excluded.sections, links=excluded.links, ` +
        `updated_at=excluded.updated_at\n` +
        // A member who has edited their own profile in-app has edited_at set;
        // leave their words alone. Only untouched imports refresh from Cohort/.
        `WHERE profiles.edited_at IS NULL;`,
    );
  }

  // Mentors are full members. Unlike learners (who are pre-seeded from the
  // roster and only get a profile attached), a mentor isn't on the roster, so
  // here we CREATE their member row — with its own login token — and then their
  // profile, flagged is_mentor = 1. Both are keyed on email so a re-import keeps
  // the same id (and thus their existing stickies) and login token. A mentor
  // imported without an email gets a stable, non-deliverable placeholder.
  mentors.forEach((p, i) => {
    const email = p.email || `${p.slug.toLowerCase()}@no-email.invalid`;
    const emailSql = sqlQuote(email);

    sql.push(
      `INSERT INTO members (id, name, email, login_token, wall_public, created_at)\n` +
        `VALUES (${sqlQuote(randomUUID())}, ${sqlQuote(p.name)}, ${emailSql}, ` +
        `${sqlQuote(mentorToken())}, 0, ${now})\n` +
        `ON CONFLICT(email) DO UPDATE SET name = excluded.name;`,
    );

    sql.push(
      `INSERT INTO profiles (member_id, slug, session, tagline, photo_key, thumb_key, intro, sections, links, updated_at, role, nickname, skills, sort_order, is_mentor)\n` +
        `SELECT m.id, ${sqlQuote(p.slug)}, NULL, ${sqlQuote(p.tagline)}, ` +
        `${p.photoKey ? sqlQuote(p.photoKey) : "NULL"}, ${p.thumbKey ? sqlQuote(p.thumbKey) : "NULL"}, ` +
        `${sqlQuote(p.intro)}, ${sqlQuote(JSON.stringify(p.sections))}, ${sqlQuote(JSON.stringify(p.links))}, ${now}, ` +
        `${p.role ? sqlQuote(p.role) : "NULL"}, ${p.nickname ? sqlQuote(p.nickname) : "NULL"}, ` +
        `${sqlQuote(JSON.stringify(p.skills))}, ${i}, 1\n` +
        `FROM members m WHERE lower(m.email) = ${emailSql}\n` +
        `ON CONFLICT(member_id) DO UPDATE SET slug=excluded.slug, tagline=excluded.tagline, ` +
        `photo_key=excluded.photo_key, thumb_key=excluded.thumb_key, intro=excluded.intro, ` +
        `sections=excluded.sections, links=excluded.links, updated_at=excluded.updated_at, ` +
        `role=excluded.role, nickname=excluded.nickname, skills=excluded.skills, ` +
        `sort_order=excluded.sort_order, is_mentor=1\n` +
        // A mentor who has edited their own profile in-app has edited_at set;
        // leave their words (and role/skills) alone. Only untouched imports refresh.
        `WHERE profiles.edited_at IS NULL;`,
    );
  });

  writeFileSync(SQL_FILE, sql.join("\n") + "\n");

  const withPhoto = [...learners, ...mentors].filter((p) => p.photoKey).length;
  const noSections = [...learners, ...mentors].filter((p) => !p.sections.length);
  console.log(
    `\n${learners.length} learner profile(s), ${mentors.length} mentor(s), ` +
      `${withPhoto} photo(s) -> ${MEDIA_DIR}/`,
  );
  if (noSections.length) {
    console.log(
      `  note: ${noSections.length} profile(s) are free-form (intro only): ` +
        noSections.map((p) => p.name).join(", "),
    );
  }

  const remote = isRemote();
  console.log(`\nSeeding profiles + mentors into ${remote ? "REMOTE" : "LOCAL"} D1…`);
  d1ExecFile(SQL_FILE, remote);
  console.log(
    `\nDone. Next: npm run cohort:media${remote ? ":remote" : ""} to upload the photos to R2.`,
  );
}

main();
