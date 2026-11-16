-- MeMo 💕 Database Schema
-- Version 1: Initial tables

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- User profile table
CREATE TABLE IF NOT EXISTS user_profile (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('boy', 'girl')),
  name TEXT NOT NULL,
  device_id TEXT NOT NULL UNIQUE,
  pairing_code TEXT,
  paired_device_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Couple pair table
CREATE TABLE IF NOT EXISTS couple_pair (
  id TEXT PRIMARY KEY,
  boy_device_id TEXT NOT NULL,
  girl_device_id TEXT NOT NULL,
  anniversary_date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(boy_device_id, girl_device_id)
);

-- Period entries table
CREATE TABLE IF NOT EXISTS period_entries (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  is_period_day INTEGER NOT NULL DEFAULT 1,
  flow TEXT CHECK (flow IN ('light', 'medium', 'heavy')),
  symptoms TEXT, -- JSON array
  notes TEXT,
  created_by TEXT NOT NULL CHECK (created_by IN ('boy', 'girl')),
  synced INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(date, created_by)
);

-- Cycle settings table
CREATE TABLE IF NOT EXISTS cycle_settings (
  id TEXT PRIMARY KEY,
  cycle_length INTEGER NOT NULL DEFAULT 28,
  period_length INTEGER NOT NULL DEFAULT 5,
  last_period_start TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Milestones table
CREATE TABLE IF NOT EXISTS milestones (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  emoji TEXT NOT NULL,
  note TEXT,
  created_by TEXT NOT NULL CHECK (created_by IN ('boy', 'girl')),
  synced INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Anniversaries table
CREATE TABLE IF NOT EXISTS anniversaries (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  label TEXT NOT NULL,
  is_primary INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Notification settings table
CREATE TABLE IF NOT EXISTS notification_settings (
  id TEXT PRIMARY KEY,
  period_reminder INTEGER NOT NULL DEFAULT 1,
  period_reminder_days INTEGER NOT NULL DEFAULT 1,
  ovulation_reminder INTEGER NOT NULL DEFAULT 1,
  milestone_reminder INTEGER NOT NULL DEFAULT 1,
  milestone_reminder_days INTEGER NOT NULL DEFAULT 3,
  anniversary_reminder INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- App settings table
CREATE TABLE IF NOT EXISTS app_settings (
  id TEXT PRIMARY KEY,
  theme TEXT NOT NULL DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
  language TEXT NOT NULL DEFAULT 'en',
  widget_enabled INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Sync queue table
CREATE TABLE IF NOT EXISTS sync_queue (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('period', 'milestone', 'anniversary', 'cycle_settings', 'notification_settings', 'app_settings')),
  action TEXT NOT NULL CHECK (action IN ('insert', 'update', 'delete')),
  payload TEXT NOT NULL, -- JSON
  retries INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_attempt_at TEXT
);

-- Pairing codes table
CREATE TABLE IF NOT EXISTS pairing_codes (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('boy', 'girl')),
  device_id TEXT NOT NULL,
  name TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  used_at TEXT,
  used_by_device_id TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_period_entries_date ON period_entries(date);
CREATE INDEX IF NOT EXISTS idx_milestones_date ON milestones(date);
CREATE INDEX IF NOT EXISTS idx_sync_queue_created ON sync_queue(created_at);
CREATE INDEX IF NOT EXISTS idx_pairing_codes_code ON pairing_codes(code);
CREATE INDEX IF NOT EXISTS idx_pairing_codes_expires ON pairing_codes(expires_at);

-- Triggers for updated_at
CREATE TRIGGER IF NOT EXISTS update_user_profile_updated_at
AFTER UPDATE ON user_profile
BEGIN
  UPDATE user_profile SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_period_entries_updated_at
AFTER UPDATE ON period_entries
BEGIN
  UPDATE period_entries SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_milestones_updated_at
AFTER UPDATE ON milestones
BEGIN
  UPDATE milestones SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_cycle_settings_updated_at
AFTER UPDATE ON cycle_settings
BEGIN
  UPDATE cycle_settings SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- Default settings
INSERT OR IGNORE INTO app_settings (id, theme, language, widget_enabled)
VALUES ('default', 'system', 'en', 1);

INSERT OR IGNORE INTO notification_settings (id, period_reminder, period_reminder_days, ovulation_reminder, milestone_reminder, milestone_reminder_days, anniversary_reminder)
VALUES ('default', 1, 1, 1, 1, 3, 1);

INSERT OR IGNORE INTO cycle_settings (id, cycle_length, period_length)
VALUES ('default', 28, 5);