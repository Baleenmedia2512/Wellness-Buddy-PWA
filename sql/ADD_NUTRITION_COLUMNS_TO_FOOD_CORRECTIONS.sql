-- =====================================================
-- ADD NUTRITION & QUANTITY COLUMNS TO FOOD CORRECTIONS
-- =====================================================
-- This migration adds support for quantity and nutritional
-- value corrections (not just food names)
--
-- Note: AI values are already stored in meals/nutrition table
-- We only store the CORRECTED values here
--
-- Features:
-- ✅ Track user-corrected quantity, unit, and nutrition values  
-- ✅ Food type detection (liquid/solid) for safe matching
-- ✅ Prevents solid/liquid correction mix-ups
--
-- Date: 2026-02-20
-- =====================================================

-- Add User Correction Columns (corrected values only)
ALTER TABLE food_corrections_table
ADD COLUMN IF NOT EXISTS "CorrectedQuantity" DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS "CorrectedUnit" VARCHAR(20),
ADD COLUMN IF NOT EXISTS "CorrectedFoodType" VARCHAR(10),
ADD COLUMN IF NOT EXISTS "CorrectedCalories" DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS "CorrectedCarbs" DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS "CorrectedProtein" DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS "CorrectedFat" DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS "CorrectedFiber" DECIMAL(10,2);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_food_corrections_type ON food_corrections_table("CorrectedFoodType");
CREATE INDEX IF NOT EXISTS idx_food_corrections_unit ON food_corrections_table("CorrectedUnit");

-- Add comments for documentation
COMMENT ON COLUMN food_corrections_table."CorrectedQuantity" IS 'User-corrected quantity (e.g., 150)';
COMMENT ON COLUMN food_corrections_table."CorrectedUnit" IS 'User-corrected unit (e.g., ml, g)';
COMMENT ON COLUMN food_corrections_table."CorrectedFoodType" IS 'Corrected food type: liquid or solid (auto-detected from unit)';
COMMENT ON COLUMN food_corrections_table."CorrectedCalories" IS 'User-corrected calories';
COMMENT ON COLUMN food_corrections_table."CorrectedCarbs" IS 'User-corrected carbs (grams)';
COMMENT ON COLUMN food_corrections_table."CorrectedProtein" IS 'User-corrected protein (grams)';
COMMENT ON COLUMN food_corrections_table."CorrectedFat" IS 'User-corrected fat (grams)';
COMMENT ON COLUMN food_corrections_table."CorrectedFiber" IS 'User-corrected fiber (grams)';

-- Verification query
SELECT 
    column_name, 
    data_type, 
    character_maximum_length,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'food_corrections_table'
ORDER BY ordinal_position;

-- Example data structure after migration:
-- ┌─────────────────┬─────────────────┬────────────────────┐
-- │ Name Correction │ Value Correction│ Metadata           │
-- ├─────────────────┼─────────────────┼────────────────────┤
-- │ AiDetected      │ CorrectedQuantity│ UserId            │
-- │ UserCorrected   │ CorrectedUnit    │ TimesCorrected    │
-- │                 │ CorrectedFoodType│ CreatedAt         │
-- │                 │ CorrectedCalories│ LastCorrected     │
-- │                 │ CorrectedCarbs   │                   │
-- │                 │ CorrectedProtein │                   │
-- │                 │ CorrectedFat     │                   │
-- │                 │ CorrectedFiber   │                   │
-- └─────────────────┴─────────────────┴────────────────────┘

-- Usage Example:
-- When user corrects "Milk" 200ml → "Tea" 150ml:
-- ┌─────────────┬───────────────┬──────────────────┬──────────────────┐
-- │ AiDetected  │ UserCorrected │ CorrectedQuantity│ CorrectedCalories│
-- ├─────────────┼───────────────┼──────────────────┼──────────────────┤
-- │ "Milk"      │ "Tea"         │ 150              │ 80               │
-- └─────────────┴───────────────┴──────────────────┴──────────────────┘
-- AI values (200ml, 120 cal) are in meals table,
-- only corrected values (150ml, 80 cal) are here
