-- ========================================
-- ADD AUTO-INCREMENT ID TO team_table
-- ========================================
-- Run this in Supabase Dashboard > SQL Editor
-- This adds a new auto-increment id column and assigns IDs to all existing records
-- ========================================

-- Step 1: Add new id column (nullable initially to allow updating existing rows)
ALTER TABLE team_table 
ADD COLUMN IF NOT EXISTS id SERIAL;

-- Step 2: Update all existing records to have sequential IDs (if they don't already)
DO $$
DECLARE
  row_record RECORD;
  counter INTEGER := 1;
BEGIN
  -- Only update rows where id is NULL
  FOR row_record IN 
    SELECT ctid FROM team_table WHERE id IS NULL ORDER BY "UserId"
  LOOP
    UPDATE team_table SET id = counter WHERE ctid = row_record.ctid;
    counter := counter + 1;
  END LOOP;
END $$;

-- Step 3: Make id NOT NULL (now that all rows have values)
ALTER TABLE team_table 
ALTER COLUMN id SET NOT NULL;

-- Step 4: Drop existing primary key constraint on UserId if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'team_table'::regclass 
    AND contype = 'p'
  ) THEN
    ALTER TABLE team_table DROP CONSTRAINT team_table_pkey;
  END IF;
END $$;

-- Step 5: Set id as PRIMARY KEY
ALTER TABLE team_table ADD PRIMARY KEY (id);

-- Step 6: Create unique index on UserId to maintain uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS idx_team_table_userid_unique ON team_table("UserId");

-- Step 7: Get the sequence name and reset it to max id + 1
SELECT setval(
  pg_get_serial_sequence('team_table', 'id'),
  (SELECT COALESCE(MAX(id), 0) FROM team_table) + 1,
  false
);

-- Step 8: Verify the setup
SELECT 
  column_name, 
  column_default, 
  is_nullable,
  data_type
FROM information_schema.columns 
WHERE table_name = 'team_table' 
  AND column_name = 'id';

-- Step 9: Check current records with new id column
SELECT id, "UserId", "UserName", "Email" 
FROM team_table 
ORDER BY id 
LIMIT 10;

-- Expected result: 
-- - id is the PRIMARY KEY with auto-increment
-- - UserId has unique constraint
-- - All records have sequential id values starting from 1
-- - Future inserts will automatically get the next id value
