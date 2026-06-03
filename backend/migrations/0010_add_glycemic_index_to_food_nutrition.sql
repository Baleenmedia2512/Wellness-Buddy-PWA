-- Add GlycemicIndex to food_nutrition_data_table
-- GI is the carb-weighted average of all food items in a meal (0–100+ scale).
-- NULL for manual entries (AI not used) and legacy rows.
ALTER TABLE food_nutrition_data_table
  ADD COLUMN IF NOT EXISTS "GlycemicIndex" DECIMAL(5,2) DEFAULT NULL;
