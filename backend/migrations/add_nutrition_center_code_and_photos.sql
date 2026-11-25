-- Centre code and photo slots on nutrition centre registration.
-- center_code is nullable so apps below 3.5.7, and requests with no version,
-- can still register. Photos live in a child table so the centre list stays small.
-- Removal: after APP_VERSION_MIN_REQUIRED >= 3.5.7 and no supported client
-- still registers a centre without these fields.

ALTER TABLE nutrition_centers_table
  ADD COLUMN IF NOT EXISTS center_code VARCHAR(32) NULL;

ALTER TABLE nutrition_centers_table
  ADD UNIQUE INDEX IF NOT EXISTS uq_nutrition_centers_center_code (center_code);

CREATE TABLE IF NOT EXISTS nutrition_center_photos_table (
  id INT NOT NULL AUTO_INCREMENT,
  center_id INT NOT NULL,
  category VARCHAR(32) NOT NULL,
  image_key VARCHAR(240) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_nutrition_center_photos_center_category (center_id, category),
  CONSTRAINT fk_nutrition_center_photos_center
    FOREIGN KEY (center_id) REFERENCES nutrition_centers_table (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
