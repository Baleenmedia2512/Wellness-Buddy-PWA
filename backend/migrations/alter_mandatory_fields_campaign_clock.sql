-- Add the server campaign clock and the reminder claim mask.
-- Run only if create_mandatory_field_tables.sql was already applied
-- without these columns. Do not run this against production from the app.
-- required_since starts when Required turns on. A later save that leaves
-- Required on does not move it. Turning Required off and on again stores a
-- new timestamp and clears reminder_mask for that field.
-- reminder_mask records which of days 2, 4, 6, and 8 were already claimed.
-- A failed send clears the bit so the slot can be retried.

ALTER TABLE mandatory_field_rules
  ADD COLUMN IF NOT EXISTS required_since DATETIME(3) NULL;

ALTER TABLE user_field_grace
  ADD COLUMN IF NOT EXISTS reminder_mask INT NOT NULL DEFAULT 0;
