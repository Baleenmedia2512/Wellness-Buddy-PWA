/**
 * Export ai_token_usage_table data from MySQL to JSON
 * 
 * Run this in MySQL Workbench or command line:
 * 
 * mysql -u root -p wellness_buddy -e "SELECT * FROM ai_token_usage_table" > ai_token_export.txt
 * 
 * Or use this query in MySQL Workbench and export as JSON:
 */

-- Export all records as JSON-compatible format
SELECT 
  ID as id,
  UserId as user_id,
  Email as email,
  InputTokens as input_tokens,
  OutputTokens as output_tokens,
  TotalTokens as total_tokens,
  OperationType as operation_type,
  ModelName as model_name,
  DATE_FORMAT(CreatedAt, '%Y-%m-%d %H:%i:%s') as created_at,
  InputTokenCost as input_token_cost,
  OutputTokenCost as output_token_cost,
  TotalTokenCost as total_token_cost
FROM ai_token_usage_table
ORDER BY ID;

-- To export to CSV in MySQL:
-- SELECT * INTO OUTFILE 'C:/temp/ai_token_data.csv'
-- FIELDS TERMINATED BY ',' 
-- ENCLOSED BY '"'
-- LINES TERMINATED BY '\n'
-- FROM ai_token_usage_table;
