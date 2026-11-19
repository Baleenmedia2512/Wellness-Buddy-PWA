-- Store the MilesWeb/R2 file key, same as weight, education, and good-habit photos.
-- The JPEG itself lives under nutrition-centres/ on disk.

ALTER TABLE nutrition_center_photos_table
  ADD COLUMN IF NOT EXISTS image_key VARCHAR(240) NULL;

ALTER TABLE nutrition_center_photos_table
  DROP COLUMN IF EXISTS image_data;

ALTER TABLE nutrition_center_photos_table
  MODIFY image_key VARCHAR(240) NOT NULL;
