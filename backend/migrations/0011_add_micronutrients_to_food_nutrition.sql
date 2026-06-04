-- Add vitamin + mineral micronutrient totals to food_nutrition_data_table.
-- Mirrors the per-meal aggregation pattern established by migrations 0009/0010
-- (TotalSugar / TotalSodium / TotalCholesterol / GlycemicIndex).
--
-- All values are per-meal totals (sum of all foods in that meal), populated by
-- background-analysis/analysis.service.js extractNutrition() from the Gemini
-- response. NULL for legacy rows and for AI responses that omit a value.
--
-- Units (locked, must match Gemini prompt + frontend RDA constants):
--   VitaminA  µg RAE      VitaminD  µg
--   VitaminE  mg          VitaminK  µg
--   VitaminC  mg
--   VitaminB1/B2/B3/B6 mg   VitaminB9 µg   VitaminB12 µg
--   Calcium/Magnesium/Potassium/Phosphorus mg
--   Iron/Zinc mg
ALTER TABLE food_nutrition_data_table
  -- Fat-soluble + Vitamin C
  ADD COLUMN IF NOT EXISTS "TotalVitaminA"   DECIMAL(8,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS "TotalVitaminC"   DECIMAL(8,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS "TotalVitaminD"   DECIMAL(8,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS "TotalVitaminE"   DECIMAL(8,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS "TotalVitaminK"   DECIMAL(8,2) DEFAULT NULL,
  -- B-Complex
  ADD COLUMN IF NOT EXISTS "TotalVitaminB1"  DECIMAL(8,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS "TotalVitaminB2"  DECIMAL(8,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS "TotalVitaminB3"  DECIMAL(8,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS "TotalVitaminB6"  DECIMAL(8,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS "TotalVitaminB9"  DECIMAL(8,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS "TotalVitaminB12" DECIMAL(8,2) DEFAULT NULL,
  -- Essential minerals
  ADD COLUMN IF NOT EXISTS "TotalCalcium"    DECIMAL(8,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS "TotalIron"       DECIMAL(8,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS "TotalMagnesium"  DECIMAL(8,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS "TotalPotassium"  DECIMAL(8,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS "TotalZinc"       DECIMAL(8,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS "TotalPhosphorus" DECIMAL(8,2) DEFAULT NULL;
