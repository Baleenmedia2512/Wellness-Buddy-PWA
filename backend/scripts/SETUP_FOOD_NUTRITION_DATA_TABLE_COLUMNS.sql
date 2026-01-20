-- Setup food_nutrition_data_table with PascalCase columns
-- Target: 1849 records from foodnutritiontable.json

-- Add PascalCase columns
ALTER TABLE food_nutrition_data_table ADD COLUMN IF NOT EXISTS "ID" INTEGER;
ALTER TABLE food_nutrition_data_table ADD COLUMN IF NOT EXISTS "UserID" TEXT;
ALTER TABLE food_nutrition_data_table ADD COLUMN IF NOT EXISTS "ImagePath" TEXT;
ALTER TABLE food_nutrition_data_table ADD COLUMN IF NOT EXISTS "AnalysisData" TEXT;
ALTER TABLE food_nutrition_data_table ADD COLUMN IF NOT EXISTS "ConfidenceScore" NUMERIC;
ALTER TABLE food_nutrition_data_table ADD COLUMN IF NOT EXISTS "TotalCalories" NUMERIC;
ALTER TABLE food_nutrition_data_table ADD COLUMN IF NOT EXISTS "TotalProtein" NUMERIC;
ALTER TABLE food_nutrition_data_table ADD COLUMN IF NOT EXISTS "TotalCarbs" NUMERIC;
ALTER TABLE food_nutrition_data_table ADD COLUMN IF NOT EXISTS "TotalFat" NUMERIC;
ALTER TABLE food_nutrition_data_table ADD COLUMN IF NOT EXISTS "TotalFiber" NUMERIC;
ALTER TABLE food_nutrition_data_table ADD COLUMN IF NOT EXISTS "ProcessedBy" TEXT;
ALTER TABLE food_nutrition_data_table ADD COLUMN IF NOT EXISTS "DeviceInfo" TEXT;
ALTER TABLE food_nutrition_data_table ADD COLUMN IF NOT EXISTS "CreatedAt" TIMESTAMP;
ALTER TABLE food_nutrition_data_table ADD COLUMN IF NOT EXISTS "UpdatedAt" TIMESTAMP;
ALTER TABLE food_nutrition_data_table ADD COLUMN IF NOT EXISTS "ImageBase64" TEXT;
ALTER TABLE food_nutrition_data_table ADD COLUMN IF NOT EXISTS "IsDeleted" INTEGER;

-- Drop old snake_case columns if they exist
ALTER TABLE food_nutrition_data_table DROP COLUMN IF EXISTS user_id;
ALTER TABLE food_nutrition_data_table DROP COLUMN IF EXISTS meal_type;
ALTER TABLE food_nutrition_data_table DROP COLUMN IF EXISTS food_items;
ALTER TABLE food_nutrition_data_table DROP COLUMN IF EXISTS calories;
ALTER TABLE food_nutrition_data_table DROP COLUMN IF EXISTS protein;
ALTER TABLE food_nutrition_data_table DROP COLUMN IF EXISTS carbohydrates;
ALTER TABLE food_nutrition_data_table DROP COLUMN IF EXISTS fat;
ALTER TABLE food_nutrition_data_table DROP COLUMN IF EXISTS fiber;
ALTER TABLE food_nutrition_data_table DROP COLUMN IF EXISTS image_path;
ALTER TABLE food_nutrition_data_table DROP COLUMN IF EXISTS confidence_score;
ALTER TABLE food_nutrition_data_table DROP COLUMN IF EXISTS processed_by;
ALTER TABLE food_nutrition_data_table DROP COLUMN IF EXISTS device_info;
ALTER TABLE food_nutrition_data_table DROP COLUMN IF EXISTS created_at;
ALTER TABLE food_nutrition_data_table DROP COLUMN IF EXISTS updated_at;
ALTER TABLE food_nutrition_data_table DROP COLUMN IF EXISTS is_deleted;

-- Rename id to ID if needed
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'food_nutrition_data_table' 
             AND column_name = 'id') THEN
    ALTER TABLE food_nutrition_data_table RENAME COLUMN id TO "ID";
  END IF;
END $$;
