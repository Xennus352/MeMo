-- MeMo 💕 Database Schema
-- Version 3: anniversaries gain updated_at so cross-device
-- last-write-wins sync can merge them.

ALTER TABLE anniversaries ADD COLUMN updated_at TEXT;
UPDATE anniversaries SET updated_at = created_at WHERE updated_at IS NULL;

CREATE TRIGGER IF NOT EXISTS update_anniversaries_updated_at
AFTER UPDATE ON anniversaries
BEGIN
  UPDATE anniversaries SET updated_at = datetime('now') WHERE id = NEW.id;
END;
