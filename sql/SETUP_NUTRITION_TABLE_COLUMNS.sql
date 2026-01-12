-- Add required columns to nutrition_table
-- This table is for nutrition program names

ALTER TABLE nutrition_table ADD COLUMN IF NOT EXISTS "Id" INTEGER;
ALTER TABLE nutrition_table ADD COLUMN IF NOT EXISTS "EntryUser" VARCHAR(100);
ALTER TABLE nutrition_table ADD COLUMN IF NOT EXISTS "EntryDate" DATE;
ALTER TABLE nutrition_table ADD COLUMN IF NOT EXISTS "NutritionName" VARCHAR(255);

-- Drop snake_case columns if they exist
ALTER TABLE nutrition_table DROP COLUMN IF EXISTS user_id;
ALTER TABLE nutrition_table DROP COLUMN IF EXISTS meal_type;
ALTER TABLE nutrition_table DROP COLUMN IF EXISTS food_items;
ALTER TABLE nutrition_table DROP COLUMN IF EXISTS calories;
ALTER TABLE nutrition_table DROP COLUMN IF EXISTS protein;
ALTER TABLE nutrition_table DROP COLUMN IF EXISTS carbohydrates;
ALTER TABLE nutrition_table DROP COLUMN IF EXISTS fat;
ALTER TABLE nutrition_table DROP COLUMN IF EXISTS fiber;

-- Handle id column
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'nutrition_table' AND column_name = 'Id') THEN
        ALTER TABLE nutrition_table DROP COLUMN IF EXISTS id;
    ELSE
        ALTER TABLE nutrition_table RENAME COLUMN id TO "Id";
    END IF;
END $$;
