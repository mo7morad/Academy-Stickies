-- Academy Stickies — small avatar variants.
-- Apply locally:  npm run migrate3:local
-- Apply to prod:  npm run migrate3:remote
--
-- The roster renders 200+ faces at 66px. Serving the 400px profile photo into
-- that slot wasted ~709 KiB per mobile load (Lighthouse: "Properly size
-- images"), so each photo now also gets a 144px variant (2x the roster avatar).
-- The 400px original is kept for the profile header, where it is the right size.

ALTER TABLE profiles ADD COLUMN thumb_key TEXT;
ALTER TABLE mentors  ADD COLUMN thumb_key TEXT;
