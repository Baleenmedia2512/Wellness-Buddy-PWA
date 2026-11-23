-- Optional seating count on a nutrition centre. Blank stays NULL.
-- Older apps omit the field and keep registering.

ALTER TABLE nutrition_centers_table
  ADD COLUMN IF NOT EXISTS seating_count INT NULL;
