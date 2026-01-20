-- Fix TeamId column type from INTEGER to VARCHAR
ALTER TABLE coach_teams_table ALTER COLUMN "TeamId" TYPE VARCHAR(50);

-- Verify the change
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'coach_teams_table'
ORDER BY ordinal_position;
