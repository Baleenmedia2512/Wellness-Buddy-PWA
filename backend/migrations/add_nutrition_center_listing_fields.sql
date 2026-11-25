-- Opening hours, facilities, and features for nutrition centre registration.
-- Nullable so apps below 3.5.7, and requests with no version, can still register.

ALTER TABLE nutrition_centers_table
  ADD COLUMN IF NOT EXISTS opening_hours_json TEXT NULL,
  ADD COLUMN IF NOT EXISTS facilities_json TEXT NULL,
  ADD COLUMN IF NOT EXISTS features_json TEXT NULL;
