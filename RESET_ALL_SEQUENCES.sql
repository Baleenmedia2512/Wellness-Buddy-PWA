-- ========================================
-- RESET ALL POSTGRESQL SEQUENCES
-- ========================================
-- Run this in Supabase Dashboard > SQL Editor
-- This fixes duplicate key errors (code 23505)
-- ========================================

-- Reset food_nutrition_data_table sequence
SELECT setval(
  pg_get_serial_sequence('food_nutrition_data_table', 'ID'), 
  (SELECT COALESCE(MAX("ID"), 0) FROM food_nutrition_data_table) + 1,
  false
);

-- Reset weight_records_table sequence
SELECT setval(
  pg_get_serial_sequence('weight_records_table', 'ID'), 
  (SELECT COALESCE(MAX("ID"), 0) FROM weight_records_table) + 1,
  false
);

-- Reset ai_token_usage_table sequence
SELECT setval(
  pg_get_serial_sequence('ai_token_usage_table', 'ID'), 
  (SELECT COALESCE(MAX("ID"), 0) FROM ai_token_usage_table) + 1,
  false
);

-- Reset education_logs_table sequence (FIXES YOUR CURRENT ERROR)
SELECT setval(
  pg_get_serial_sequence('education_logs_table', 'Id'), 
  (SELECT COALESCE(MAX("Id"), 0) FROM education_logs_table) + 1,
  false
);

-- Verify all sequences are now correct
SELECT 
  'food_nutrition_data_table' as table_name,
  last_value as next_id
FROM pg_get_serial_sequence('food_nutrition_data_table', 'ID')::regclass
UNION ALL
SELECT 
  'weight_records_table',
  last_value
FROM pg_get_serial_sequence('weight_records_table', 'ID')::regclass
UNION ALL
SELECT 
  'ai_token_usage_table',
  last_value
FROM pg_get_serial_sequence('ai_token_usage_table', 'ID')::regclass
UNION ALL
SELECT 
  'education_logs_table',
  last_value
FROM pg_get_serial_sequence('education_logs_table', 'Id')::regclass;
