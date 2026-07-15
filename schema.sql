-- Academy Stickies — D1 schema
-- Apply locally:  npm run db:local
-- Apply to prod:  npm run db:remote

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS members (
  id            TEXT PRIMARY KEY,            -- uuid
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,        -- academy email
  avatar_key    TEXT,                        -- R2 object key, nullable
  login_token   TEXT NOT NULL UNIQUE,        -- high-entropy magic-link token
  wall_public   INTEGER NOT NULL DEFAULT 0,  -- recipient-controlled visibility (0/1)
  created_at    INTEGER NOT NULL,            -- epoch ms
  last_login_at INTEGER
);

CREATE TABLE IF NOT EXISTS stickies (
  id           TEXT PRIMARY KEY,             -- uuid
  recipient_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  author_id    TEXT REFERENCES members(id) ON DELETE SET NULL, -- NULL when anonymous
  is_anonymous INTEGER NOT NULL DEFAULT 0,
  described_as TEXT NOT NULL DEFAULT '',     -- "how I'd describe you"
  good_at      TEXT NOT NULL DEFAULT '',     -- "what you're great at professionally"
  color        TEXT NOT NULL DEFAULT 'yellow',
  photo_key    TEXT,                         -- optional R2 object key
  created_at   INTEGER NOT NULL,             -- epoch ms
  anon_name    TEXT,                         -- codename for anonymous notes ("Pink Leopard")
  anon_color   TEXT                          -- accent hex for the codename
);

CREATE INDEX IF NOT EXISTS idx_stickies_recipient ON stickies(recipient_id, created_at DESC);
