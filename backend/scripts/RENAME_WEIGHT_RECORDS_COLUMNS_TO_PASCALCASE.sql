-- Rename weight_records_table columns from snake_case to PascalCase

ALTER TABLE weight_records_table 
RENAME COLUMN id TO "ID";

ALTER TABLE weight_records_table 
RENAME COLUMN user_id TO "UserId";

ALTER TABLE weight_records_table 
RENAME COLUMN weight TO "Weight";

ALTER TABLE weight_records_table 
RENAME COLUMN bmi TO "Bmi";

ALTER TABLE weight_records_table 
RENAME COLUMN body_fat TO "BodyFat";

ALTER TABLE weight_records_table 
RENAME COLUMN muscle_mass TO "MuscleMass";

ALTER TABLE weight_records_table 
RENAME COLUMN bmr TO "Bmr";

ALTER TABLE weight_records_table 
RENAME COLUMN weight_image_base64 TO "WeightImageBase64";

ALTER TABLE weight_records_table 
RENAME COLUMN created_at TO "CreatedAt";

ALTER TABLE weight_records_table 
RENAME COLUMN updated_at TO "UpdatedAt";

ALTER TABLE weight_records_table 
RENAME COLUMN is_deleted TO "IsDeleted";

-- Final columns: ID, UserId, Weight, Bmi, BodyFat, MuscleMass, Bmr, 
-- WeightImageBase64, CreatedAt, UpdatedAt, IsDeleted
