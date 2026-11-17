-- MeMo 💕 Database Schema
-- Version 5: a "your period ended — she is strong" congrats reminder toggle.

ALTER TABLE notification_settings ADD COLUMN period_ended_reminder INTEGER NOT NULL DEFAULT 1;
