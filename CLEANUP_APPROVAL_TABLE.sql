-- ========================================
-- DROP EXTRA COLUMNS FROM APPROVAL_REQUESTS_TABLE
-- Run this in Supabase SQL Editor
-- ========================================

-- Remove columns that are NOT in image 1
ALTER TABLE approval_requests_table DROP COLUMN IF EXISTS request_type;
ALTER TABLE approval_requests_table DROP COLUMN IF EXISTS requester_name;
ALTER TABLE approval_requests_table DROP COLUMN IF EXISTS target_id;
ALTER TABLE approval_requests_table DROP COLUMN IF EXISTS target_name;
ALTER TABLE approval_requests_table DROP COLUMN IF EXISTS request_data;
ALTER TABLE approval_requests_table DROP COLUMN IF EXISTS response_data;
ALTER TABLE approval_requests_table DROP COLUMN IF EXISTS processed_at;
ALTER TABLE approval_requests_table DROP COLUMN IF EXISTS processed_by;

-- Verify final structure matches image 1
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'approval_requests_table'
ORDER BY ordinal_position;
