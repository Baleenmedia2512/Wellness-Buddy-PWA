-- Add community-position scope and the ask-again interval.
-- Run this only if create_mandatory_field_tables.sql was already applied
-- without these columns. A fresh create already includes them.
-- Does not enable any rule. Does not update team_table.

ALTER TABLE mandatory_field_rules
  ADD COLUMN IF NOT EXISTS remind_every_days INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS position_scope VARCHAR(16) NOT NULL DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS position_codes JSON NULL;

ALTER TABLE user_field_grace
  ADD COLUMN IF NOT EXISTS last_prompted_at DATETIME(3) NULL;

INSERT INTO mandatory_field_rules
  (field_key, required, grace_type, grace_limit, audience, min_app_version, notify_enabled, remind_every_days, position_scope)
SELECT 'communityPosition', 0, 'days', 0, 'both', '3.5.6', 1, 0, 'all'
WHERE NOT EXISTS (
  SELECT 1 FROM mandatory_field_rules existing
  WHERE existing.field_key = 'communityPosition'
);
