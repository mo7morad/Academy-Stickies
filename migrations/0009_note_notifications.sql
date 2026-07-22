-- Academy Stickies — new-note notifications (red dots)
-- Apply locally:  npm run migrate9:local
-- Apply to prod:  npm run migrate9:remote
--
-- A member sees a red dot when a sticky lands on their wall that arrived after
-- the last time they looked. `notifications_seen_at` is that watermark (epoch
-- ms): the unread count is the number of received stickies newer than it, and
-- opening your own wall stamps it to "now" so the dot clears.
--
-- Existing members are stamped with "now" on migrate so launch day doesn't
-- retroactively flag every note they already have as unread — only notes that
-- arrive from here on light up the dot.

ALTER TABLE members ADD COLUMN notifications_seen_at INTEGER;

UPDATE members
   SET notifications_seen_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000;
