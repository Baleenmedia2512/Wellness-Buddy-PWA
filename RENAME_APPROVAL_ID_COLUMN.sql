-- ========================================
-- RENAME id TO Id IN APPROVAL_REQUESTS_TABLE
-- Run this in Supabase SQL Editor
-- ========================================

-- Rename id column to Id (PascalCase)
ALTER TABLE approval_requests_table RENAME COLUMN id TO "Id";

-- Verify the change
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'approval_requests_table'
ORDER BY ordinal_position;
