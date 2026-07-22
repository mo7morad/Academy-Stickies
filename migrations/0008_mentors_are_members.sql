-- Academy Stickies — mentors become members.
-- Apply locally:  npm run migrate8:local
-- Apply to prod:  npm run migrate8:remote
--
-- Mentors ("seniors") used to live in their own `mentors` table with no
-- login_token: they could be *given* stickies and have a wall, but they could
-- never sign in to see it, and the invite/links scripts (which only read
-- `members`) never mailed them a link. This migration makes them first-class
-- members so they behave exactly like learners — sign in, own a board, give and
-- receive notes, edit their profile, publish their wall.
--
-- DEPLOY ORDER: this DROPs the `mentors` table, so apply this migration and
-- deploy the matching code together. The old code reads `mentors`; the new code
-- reads members+profiles (WHERE is_mentor = 1).

PRAGMA foreign_keys = OFF;

-- Mentor-specific fields move onto the shared `profiles` table. is_mentor keeps
-- the two groups distinguishable (the Mentors directory, the learner roster).
ALTER TABLE profiles ADD COLUMN role       TEXT;
ALTER TABLE profiles ADD COLUMN nickname   TEXT;
ALTER TABLE profiles ADD COLUMN skills     TEXT NOT NULL DEFAULT '[]';
ALTER TABLE profiles ADD COLUMN sort_order INTEGER;
ALTER TABLE profiles ADD COLUMN is_mentor  INTEGER NOT NULL DEFAULT 0;

-- Move each mentor into `members`, KEEPING its existing id so the stickies
-- already addressed to that id stay valid. A fresh 256-bit login token is
-- minted per mentor (they never had one). Mentors without an email on file get
-- a stable, non-deliverable placeholder so the NOT NULL/UNIQUE column holds and
-- the row still has an account; invite.ts skips the @no-email.invalid sentinel.
INSERT OR IGNORE INTO members (id, name, email, avatar_key, login_token, wall_public, created_at)
SELECT
  id,
  name,
  COALESCE(NULLIF(lower(trim(email)), ''), lower(slug) || '@no-email.invalid'),
  NULL,
  lower(hex(randomblob(32))),
  wall_public,
  CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM mentors;

-- Their prose + photos become a profiles row flagged is_mentor = 1.
INSERT OR IGNORE INTO profiles
  (member_id, slug, session, tagline, photo_key, thumb_key, intro, sections, links, updated_at, role, nickname, skills, sort_order, is_mentor)
SELECT
  id, slug, NULL, tagline, photo_key, thumb_key, intro, sections, links, updated_at, role, nickname, skills, sort_order, 1
FROM mentors;

DROP TABLE mentors;

PRAGMA foreign_keys = ON;
