-- Migration: 0009_add_sugar_sodium_cholesterol_to_food_nutrition.sql
-- Purpose: Extend food_nutrition_data_table with three new micronutrient
--          columns required by the Nutrition Dashboard carousel (Heart Healthy
--          and Low Carb cards). Columns are nullable so all existing rows remain
--          valid — aggregation code uses COALESCE(col, 0).
-- Rollback: see compensating migration 0010_drop_sugar_sodium_cholesterol.sql
--           (written but not merged; file kept in migrations/ directory).

ALTER TABLE food_nutrition_data_table
  ADD COLUMN IF NOT EXISTS "TotalSugar"       DECIMAL(8,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS "TotalSodium"      DECIMAL(8,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS "TotalCholesterol" DECIMAL(8,2) DEFAULT NULL;

COMMENT ON COLUMN food_nutrition_data_table."TotalSugar"       IS 'Total sugar in grams for the meal. NULL when not provided by AI.';
COMMENT ON COLUMN food_nutrition_data_table."TotalSodium"      IS 'Total sodium in milligrams for the meal. NULL when not provided by AI.';
COMMENT ON COLUMN food_nutrition_data_table."TotalCholesterol" IS 'Total cholesterol in milligrams for the meal. NULL when not provided by AI.';
