-- Add TimeRange and Date Range columns to token_correction_table
-- These columns enable time-range specific corrections

-- Add TimeRange column (today, yesterday, week, month, all, custom)
ALTER TABLE token_correction_table 
ADD COLUMN IF NOT EXISTS "TimeRange" VARCHAR(50) DEFAULT 'all';

-- Add StartDate column for custom date ranges
ALTER TABLE token_correction_table 
ADD COLUMN IF NOT EXISTS "StartDate" DATE DEFAULT NULL;

-- Add EndDate column for custom date ranges
ALTER TABLE token_correction_table 
ADD COLUMN IF NOT EXISTS "EndDate" DATE DEFAULT NULL;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_time_range ON token_correction_table ("UserId", "TimeRange");

-- Verify columns were added
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'token_correction_table'
ORDER BY ordinal_position;
