-- Adds codename fields for anonymous stickies (e.g. "Pink Leopard").
-- Run once against an existing database:
--   npm run migrate:local   /   npm run migrate:remote
ALTER TABLE stickies ADD COLUMN anon_name TEXT;
ALTER TABLE stickies ADD COLUMN anon_color TEXT;
