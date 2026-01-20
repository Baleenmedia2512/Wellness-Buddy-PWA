-- ========================================
-- RENAME COACH_TEAMS_TABLE COLUMNS TO MATCH SQL CLIENT
-- Run this in Supabase SQL Editor
-- ========================================

-- Check current columns first
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'coach_teams_table'
ORDER BY ordinal_position;

-- Rename columns to PascalCase (if they are lowercase)
-- Uncomment after checking current names above

-- ALTER TABLE coach_teams_table RENAME COLUMN id TO "Id";
-- ALTER TABLE coach_teams_table RENAME COLUMN team_id TO "TeamId";
-- ALTER TABLE coach_teams_table RENAME COLUMN coach_id TO "CoachId";
-- ALTER TABLE coach_teams_table RENAME COLUMN co_coach_id TO "CoCoachId";
-- ALTER TABLE coach_teams_table RENAME COLUMN status TO "Status";
-- ALTER TABLE coach_teams_table RENAME COLUMN created_at TO "CreatedAt";
-- ALTER TABLE coach_teams_table RENAME COLUMN updated_at TO "UpdatedAt";
