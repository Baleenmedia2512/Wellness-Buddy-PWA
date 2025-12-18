-- AI Token Monitor - Test Data Setup
-- This script creates sample token usage records for testing the dashboard

-- ============================================
-- STEP 1: Verify Table Exists
-- ============================================
SELECT 'Checking if ai_token_usage_table exists...' as Status;

SELECT 
  TABLE_NAME,
  TABLE_ROWS,
  CREATE_TIME
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'wellness_buddy'
  AND TABLE_NAME = 'ai_token_usage_table';

-- ============================================
-- STEP 2: View Current Data
-- ============================================
SELECT 'Current data in ai_token_usage_table:' as Status;

SELECT 
  COUNT(*) as total_records,
  MIN(CreatedAt) as oldest_record,
  MAX(CreatedAt) as newest_record,
  SUM(TotalTokens) as total_tokens,
  SUM(TotalTokenCost) as total_cost
FROM ai_token_usage_table;

-- ============================================
-- STEP 3: Insert Test Data (Optional)
-- ============================================
-- Uncomment and run if you need test data

/*
-- Test data for food_analysis operations
INSERT INTO ai_token_usage_table 
(UserId, Email, OperationType, ModelName, InputTokens, OutputTokens, TotalTokens, InputTokenCost, OutputTokenCost, TotalTokenCost, CreatedAt)
VALUES
-- Today's records
(1, 'test@example.com', 'food_analysis', 'gemini-2.5-flash-lite', 1037, 146, 1183, 0.0070, 0.0397, 0.0467, NOW()),
(1, 'test@example.com', 'food_analysis', 'gemini-2.5-flash-lite', 950, 130, 1080, 0.0065, 0.0353, 0.0418, NOW() - INTERVAL 2 HOUR),
(1, 'test@example.com', 'weight_detection', 'gemini-2.5-flash-lite', 850, 120, 970, 0.0058, 0.0326, 0.0384, NOW() - INTERVAL 1 HOUR),

-- Yesterday's records
(1, 'test@example.com', 'food_analysis', 'gemini-2.5-flash-lite', 1100, 150, 1250, 0.0075, 0.0408, 0.0483, NOW() - INTERVAL 1 DAY),
(1, 'test@example.com', 'weight_detection', 'gemini-2.5-flash-lite', 800, 110, 910, 0.0055, 0.0299, 0.0354, NOW() - INTERVAL 1 DAY - INTERVAL 3 HOUR),

-- Last week's records
(1, 'test@example.com', 'food_analysis', 'gemini-2.5-flash-lite', 980, 140, 1120, 0.0067, 0.0380, 0.0447, NOW() - INTERVAL 3 DAY),
(1, 'test@example.com', 'food_analysis', 'gemini-2.5-flash-lite', 1050, 145, 1195, 0.0072, 0.0394, 0.0466, NOW() - INTERVAL 5 DAY),
(1, 'test@example.com', 'weight_detection', 'gemini-2.5-flash-lite', 820, 115, 935, 0.0056, 0.0313, 0.0369, NOW() - INTERVAL 6 DAY),

-- Last month's records
(1, 'test@example.com', 'food_analysis', 'gemini-2.5-flash-lite', 1000, 135, 1135, 0.0068, 0.0367, 0.0435, NOW() - INTERVAL 15 DAY),
(1, 'test@example.com', 'food_analysis', 'gemini-2.5-flash-lite', 1080, 148, 1228, 0.0074, 0.0402, 0.0476, NOW() - INTERVAL 20 DAY),
(1, 'test@example.com', 'weight_detection', 'gemini-2.5-flash-lite', 870, 125, 995, 0.0059, 0.0340, 0.0399, NOW() - INTERVAL 25 DAY);
*/

-- ============================================
-- STEP 4: Verify Test Data Insertion
-- ============================================
SELECT 'Verifying test data by time range:' as Status;

-- Today's data
SELECT 
  'Today' as time_range,
  COUNT(*) as request_count,
  SUM(TotalTokens) as total_tokens,
  SUM(TotalTokenCost) as total_cost
FROM ai_token_usage_table
WHERE DATE(CreatedAt) = CURDATE();

-- Last 7 days
SELECT 
  'Last 7 Days' as time_range,
  COUNT(*) as request_count,
  SUM(TotalTokens) as total_tokens,
  SUM(TotalTokenCost) as total_cost
FROM ai_token_usage_table
WHERE CreatedAt >= NOW() - INTERVAL 7 DAY;

-- Last 30 days
SELECT 
  'Last 30 Days' as time_range,
  COUNT(*) as request_count,
  SUM(TotalTokens) as total_tokens,
  SUM(TotalTokenCost) as total_cost
FROM ai_token_usage_table
WHERE CreatedAt >= NOW() - INTERVAL 30 DAY;

-- ============================================
-- STEP 5: Test Query - By Operation Type
-- ============================================
SELECT 'Data breakdown by operation type:' as Status;

SELECT 
  OperationType,
  COUNT(*) as request_count,
  SUM(TotalTokens) as total_tokens,
  SUM(InputTokens) as input_tokens,
  SUM(OutputTokens) as output_tokens,
  SUM(TotalTokenCost) as total_cost,
  ROUND((SUM(TotalTokens) / (SELECT SUM(TotalTokens) FROM ai_token_usage_table) * 100), 1) as percentage
FROM ai_token_usage_table
GROUP BY OperationType
ORDER BY total_tokens DESC;

-- ============================================
-- STEP 6: Test Query - By Model
-- ============================================
SELECT 'Data breakdown by model:' as Status;

SELECT 
  ModelName,
  COUNT(*) as request_count,
  SUM(TotalTokens) as total_tokens,
  SUM(TotalTokenCost) as total_cost
FROM ai_token_usage_table
GROUP BY ModelName
ORDER BY total_tokens DESC;

-- ============================================
-- STEP 7: Test Query - Daily Statistics
-- ============================================
SELECT 'Daily statistics (last 7 days):' as Status;

SELECT 
  DATE(CreatedAt) as date,
  COUNT(*) as request_count,
  SUM(TotalTokens) as total_tokens,
  SUM(TotalTokenCost) as total_cost
FROM ai_token_usage_table
WHERE CreatedAt >= NOW() - INTERVAL 7 DAY
GROUP BY DATE(CreatedAt)
ORDER BY date DESC;

-- ============================================
-- STEP 8: Test Query - Recent Activity
-- ============================================
SELECT 'Recent 10 activities:' as Status;

SELECT 
  ID,
  OperationType,
  ModelName,
  TotalTokens,
  TotalTokenCost,
  CreatedAt
FROM ai_token_usage_table
ORDER BY CreatedAt DESC
LIMIT 10;

-- ============================================
-- STEP 9: Test Query - Summary Stats
-- ============================================
SELECT 'Overall summary statistics:' as Status;

SELECT 
  COUNT(*) as total_requests,
  SUM(InputTokens) as total_input_tokens,
  SUM(OutputTokens) as total_output_tokens,
  SUM(TotalTokens) as total_tokens,
  SUM(InputTokenCost) as total_input_cost,
  SUM(OutputTokenCost) as total_output_cost,
  SUM(TotalTokenCost) as total_cost,
  AVG(TotalTokenCost) as avg_cost_per_request,
  MIN(CreatedAt) as first_request,
  MAX(CreatedAt) as last_request
FROM ai_token_usage_table;

-- ============================================
-- STEP 10: Cleanup (Optional)
-- ============================================
-- Uncomment to delete test data

/*
-- Delete test records (be careful!)
DELETE FROM ai_token_usage_table 
WHERE Email = 'test@example.com';

-- Verify deletion
SELECT COUNT(*) as remaining_records FROM ai_token_usage_table;
*/

-- ============================================
-- USEFUL QUERIES FOR DEVELOPMENT
-- ============================================

-- Check specific user's data
-- SELECT * FROM ai_token_usage_table WHERE Email = 'your-email@example.com' ORDER BY CreatedAt DESC LIMIT 10;

-- Check data for specific date
-- SELECT * FROM ai_token_usage_table WHERE DATE(CreatedAt) = '2025-12-16';

-- Check total cost by date
-- SELECT DATE(CreatedAt) as date, SUM(TotalTokenCost) as daily_cost FROM ai_token_usage_table GROUP BY DATE(CreatedAt) ORDER BY date DESC;

-- Find most expensive requests
-- SELECT OperationType, TotalTokens, TotalTokenCost, CreatedAt FROM ai_token_usage_table ORDER BY TotalTokenCost DESC LIMIT 10;

-- Find requests with high token usage
-- SELECT OperationType, TotalTokens, TotalTokenCost, CreatedAt FROM ai_token_usage_table WHERE TotalTokens > 1000 ORDER BY TotalTokens DESC;

-- Check average tokens per operation type
-- SELECT OperationType, COUNT(*) as count, AVG(TotalTokens) as avg_tokens, AVG(TotalTokenCost) as avg_cost FROM ai_token_usage_table GROUP BY OperationType;

-- ============================================
-- PERFORMANCE OPTIMIZATION
-- ============================================

-- Add indexes for better query performance
-- CREATE INDEX idx_email ON ai_token_usage_table(Email);
-- CREATE INDEX idx_created_at ON ai_token_usage_table(CreatedAt);
-- CREATE INDEX idx_operation_type ON ai_token_usage_table(OperationType);
-- CREATE INDEX idx_model_name ON ai_token_usage_table(ModelName);

-- Check existing indexes
SHOW INDEXES FROM ai_token_usage_table;

-- ============================================
-- END OF SCRIPT
-- ============================================
SELECT 'Test data setup complete!' as Status;
