-- MeMo 💕 Database Schema
-- Version 4: anniversary reminders get their own "days before" setting so the
-- couple can pick a different lead time for annual dates than for milestones.

ALTER TABLE notification_settings ADD COLUMN anniversary_reminder_days INTEGER NOT NULL DEFAULT 3;
