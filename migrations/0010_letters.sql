-- Migration 0010: Letters table for private envelope letters
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS letters (
  id            TEXT PRIMARY KEY,
  recipient_id  TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  author_id     TEXT REFERENCES members(id) ON DELETE SET NULL,
  is_anonymous  INTEGER NOT NULL DEFAULT 0,
  subject       TEXT NOT NULL DEFAULT '',
  body          TEXT NOT NULL DEFAULT '',
  paper_style   TEXT NOT NULL DEFAULT 'classic',
  photo_key     TEXT,
  is_opened     INTEGER NOT NULL DEFAULT 0,
  opened_at     INTEGER,
  created_at    INTEGER NOT NULL,
  anon_name     TEXT,
  anon_color    TEXT
);

CREATE INDEX IF NOT EXISTS idx_letters_recipient ON letters(recipient_id, created_at DESC);
