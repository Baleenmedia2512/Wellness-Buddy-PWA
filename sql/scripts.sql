ALTER TABLE food_nutrition_data_table ADD COLUMN ImageBase64 LONGTEXT DEFAULT NULL;

ALTER TABLE food_nutrition_data_table
ADD COLUMN IsDeleted TINYINT(1) NOT NULL DEFAULT 0 
