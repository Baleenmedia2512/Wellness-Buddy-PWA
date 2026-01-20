-- Rename food_corrections_table columns to PascalCase

ALTER TABLE food_corrections_table 
  RENAME COLUMN id TO "Id";

ALTER TABLE food_corrections_table 
  RENAME COLUMN user_id TO "UserId";

ALTER TABLE food_corrections_table 
  RENAME COLUMN ai_detected TO "AiDetected";

ALTER TABLE food_corrections_table 
  RENAME COLUMN user_corrected TO "UserCorrected";

ALTER TABLE food_corrections_table 
  RENAME COLUMN times_corrected TO "TimesCorrected";

ALTER TABLE food_corrections_table 
  RENAME COLUMN created_at TO "CreatedAt";

ALTER TABLE food_corrections_table 
  RENAME COLUMN last_corrected TO "LastCorrected";
