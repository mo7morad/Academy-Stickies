-- Academy Stickies — cohort profiles (learners) + mentors (seniors)
-- Apply locally:  npm run migrate2:local
-- Apply to prod:  npm run migrate2:remote
--
-- Profile prose, photos and emails are student/mentor PII: they live here in D1
-- (seeded from the gitignored Cohort/ folder) and are only ever served through
-- the authenticated /api routes. Nothing here is committed to the public repo.

-- One profile per roster member, keyed by the member it belongs to.
CREATE TABLE IF NOT EXISTS profiles (
  member_id  TEXT PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
  slug       TEXT NOT NULL,                 -- Cohort filename slug, e.g. "Aileen_Jane"
  session    TEXT,                          -- 'AM' | 'PM'
  tagline    TEXT,                          -- one-liner shown on roster cards
  photo_key  TEXT,                          -- R2 key, e.g. "learners/Aileen_Jane.webp"
  intro      TEXT,                          -- prose before the first heading
  sections   TEXT NOT NULL DEFAULT '[]',    -- JSON: [{ "title": ..., "body": ... }]
  links      TEXT NOT NULL DEFAULT '[]',    -- JSON: [{ "label": ..., "url": ... }]
  updated_at INTEGER NOT NULL
);

-- Mentors ("seniors"). They are not roster members: they have no wall and cannot
-- receive stickies, so they get their own table rather than rows in `members`.
CREATE TABLE IF NOT EXISTS mentors (
  id         TEXT PRIMARY KEY,
  slug       TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  nickname   TEXT,
  role       TEXT,                          -- e.g. "Tech mentor"
  skills     TEXT NOT NULL DEFAULT '[]',    -- JSON: string[]
  tagline    TEXT,
  photo_key  TEXT,                          -- R2 key, e.g. "mentors/Nima.webp"
  intro      TEXT,
  sections   TEXT NOT NULL DEFAULT '[]',    -- JSON: [{ "title": ..., "body": ... }]
  links      TEXT NOT NULL DEFAULT '[]',    -- JSON: [{ "label": ..., "url": ... }]
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mentors_sort ON mentors(sort_order, name COLLATE NOCASE);
