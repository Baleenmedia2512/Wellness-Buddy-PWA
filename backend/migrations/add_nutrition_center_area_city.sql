-- Area and city captured from the centre map pin.
-- Nullable so older apps that do not send them can still register.

ALTER TABLE nutrition_centers_table
  ADD COLUMN IF NOT EXISTS area VARCHAR(120) NULL,
  ADD COLUMN IF NOT EXISTS city VARCHAR(120) NULL;
