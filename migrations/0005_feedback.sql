-- Academy Stickies — member feedback
-- Apply locally:  npm run migrate5:local
-- Apply to prod:  npm run migrate5:remote

CREATE TABLE IF NOT EXISTS feedback (
  id         TEXT PRIMARY KEY,
  member_id  TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  message    TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback(created_at DESC);
