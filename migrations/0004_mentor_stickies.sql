-- Drop foreign key constraint on recipient_id so we can send stickies to mentors
PRAGMA foreign_keys = OFF;

-- Add email column to mentors
ALTER TABLE mentors ADD COLUMN email TEXT;

CREATE TABLE stickies_new (
  id           TEXT PRIMARY KEY,
  recipient_id TEXT NOT NULL,
  author_id    TEXT REFERENCES members(id) ON DELETE SET NULL,
  is_anonymous INTEGER NOT NULL DEFAULT 0,
  described_as TEXT NOT NULL DEFAULT '',
  good_at      TEXT NOT NULL DEFAULT '',
  color        TEXT NOT NULL DEFAULT 'yellow',
  photo_key    TEXT,
  created_at   INTEGER NOT NULL,
  anon_name    TEXT,
  anon_color   TEXT
);

INSERT INTO stickies_new SELECT * FROM stickies;
DROP TABLE stickies;
ALTER TABLE stickies_new RENAME TO stickies;
CREATE INDEX idx_stickies_recipient ON stickies(recipient_id, created_at DESC);

PRAGMA foreign_keys = ON;
