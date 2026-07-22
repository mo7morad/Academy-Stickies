-- Academy Stickies — member-editable profiles.
-- Apply locally:  npm run migrate7:local
-- Apply to prod:  npm run migrate7:remote
--
-- Profiles began as a one-way import from the gitignored Cohort/ folder. Once a
-- member edits their own profile through the app (PUT /api/me/profile), this
-- stamps edited_at — and the cohort re-import (scripts/build-cohort.ts) skips
-- any row where it is set, so a member's own words are never clobbered by a
-- later `npm run cohort`.

ALTER TABLE profiles ADD COLUMN edited_at INTEGER;
