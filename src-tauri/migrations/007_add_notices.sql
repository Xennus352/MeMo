-- MeMo 💕 Database Schema
-- Version 7: the noticeboard — notes one partner pins for the other with a
-- time to alert them. 0 = one-time alert at remind_at; N = alert every N
-- minutes until either partner stops it (active = 0).

CREATE TABLE IF NOT EXISTS notices (
  id TEXT PRIMARY KEY,
  message TEXT NOT NULL,
  remind_at TEXT NOT NULL,
  repeat_minutes INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL CHECK (created_by IN ('boy', 'girl')),
  synced INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notices_active ON notices(active, remind_at);

CREATE TRIGGER IF NOT EXISTS update_notices_updated_at
AFTER UPDATE ON notices
BEGIN
  UPDATE notices SET updated_at = datetime('now') WHERE id = NEW.id;
END;
