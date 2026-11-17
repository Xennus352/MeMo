-- MeMo 💕 Database Schema
-- Version 6: the theme transition effect chosen for Light/Dark switches
-- (and the Custom/Random mode plus per-effect options), persisted as JSON.

ALTER TABLE app_settings ADD COLUMN theme_transition TEXT NOT NULL DEFAULT '{"mode":"random"}';
