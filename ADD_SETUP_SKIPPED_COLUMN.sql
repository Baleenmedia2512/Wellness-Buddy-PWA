-- Add SetupSkipped column to team_table
-- This column tracks whether a user chose to skip the setup wizard

-- Check if column exists, if not add it
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'team_table' 
        AND column_name = 'SetupSkipped'
    ) THEN
        ALTER TABLE team_table 
        ADD COLUMN "SetupSkipped" BOOLEAN DEFAULT FALSE;
        
        RAISE NOTICE 'Column SetupSkipped added to team_table';
    ELSE
        RAISE NOTICE 'Column SetupSkipped already exists in team_table';
    END IF;
END $$;

-- Add comment for documentation
COMMENT ON COLUMN team_table."SetupSkipped" IS 'TRUE if user chose to skip setup wizard, FALSE or NULL otherwise';

-- Verify the column was added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'team_table'
AND column_name = 'SetupSkipped';
