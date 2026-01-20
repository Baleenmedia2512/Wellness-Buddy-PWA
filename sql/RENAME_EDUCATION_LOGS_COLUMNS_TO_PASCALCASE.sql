-- Rename education_logs_table columns to PascalCase

ALTER TABLE education_logs_table 
  RENAME COLUMN id TO "Id";

ALTER TABLE education_logs_table 
  RENAME COLUMN user_id TO "UserId";

ALTER TABLE education_logs_table 
  RENAME COLUMN platform TO "Platform";

ALTER TABLE education_logs_table 
  RENAME COLUMN topic TO "Topic";

ALTER TABLE education_logs_table 
  RENAME COLUMN created_at TO "CreatedAt";

ALTER TABLE education_logs_table 
  RENAME COLUMN updated_at TO "UpdatedAt";

ALTER TABLE education_logs_table 
  RENAME COLUMN confidence TO "Confidence";

ALTER TABLE education_logs_table 
  RENAME COLUMN device_info TO "DeviceInfo";

ALTER TABLE education_logs_table 
  RENAME COLUMN image_base64 TO "ImageBase64";

ALTER TABLE education_logs_table 
  RENAME COLUMN is_deleted TO "IsDeleted";
