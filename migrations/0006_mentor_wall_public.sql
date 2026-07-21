-- Academy Stickies — mentor wall visibility
-- Apply locally:  npm run migrate6:local
-- Apply to prod:  npm run migrate6:remote
--
-- Mentor walls used to be public to every signed-in member, hard-coded in the
-- API. Mentors get the same deal as learners now: the notes people leave them
-- are theirs to publish, so a wall starts private and the column — not the
-- code — decides who can read it.

ALTER TABLE mentors ADD COLUMN wall_public INTEGER NOT NULL DEFAULT 0;
