-- Drop duplicate snake_case columns from food_nutrition_data_table
-- Keep only the PascalCase columns

ALTER TABLE food_nutrition_data_table 
DROP COLUMN IF EXISTS analysis_data;

ALTER TABLE food_nutrition_data_table 
DROP COLUMN IF EXISTS total_calories;

ALTER TABLE food_nutrition_data_table 
DROP COLUMN IF EXISTS total_protein;

ALTER TABLE food_nutrition_data_table 
DROP COLUMN IF EXISTS total_carbs;

ALTER TABLE food_nutrition_data_table 
DROP COLUMN IF EXISTS total_fat;

ALTER TABLE food_nutrition_data_table 
DROP COLUMN IF EXISTS total_fiber;

ALTER TABLE food_nutrition_data_table 
DROP COLUMN IF EXISTS image_base64;

-- Final columns will be (in PascalCase):
-- ID, UserID, ImagePath, AnalysisData, ConfidenceScore, 
-- TotalCalories, TotalProtein, TotalCarbs, TotalFat, TotalFiber,
-- ProcessedBy, DeviceInfo, CreatedAt, UpdatedAt, ImageBase64, IsDeleted
