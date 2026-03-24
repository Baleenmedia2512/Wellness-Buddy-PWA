-- Migration: Convert CoachTeamId from varchar to integer FK
-- This fixes the architecture to properly reference coach_teams_table.id instead of TeamId string

-- Step 1: Add new integer column for coach_teams_table.id foreign key
ALTER TABLE team_table 
ADD COLUMN coach_team_record_id INTEGER;

-- Step 2: Populate the new column by looking up coach_teams_table."Id" from TeamId
-- For each user, find their coach's TeamId, then get the coach_teams_table."Id"
UPDATE team_table t
SET coach_team_record_id = ct."Id"
FROM team_table coach
LEFT JOIN coach_teams_table ct ON ct."TeamId" = coach."TeamId" AND ct."Status" = 'active'
WHERE t."CoachId" = coach."UserId"
  AND coach."TeamId" IS NOT NULL;

-- Step 3: Add foreign key constraint
ALTER TABLE team_table
ADD CONSTRAINT fk_team_coach_teams
FOREIGN KEY (coach_team_record_id) 
REFERENCES coach_teams_table("Id")
ON DELETE SET NULL;

-- Step 4: (OPTIONAL - After verifying data is correct) Drop old varchar column
-- CAUTION: Only run this after confirming coach_team_record_id is populated correctly!
-- ALTER TABLE team_table DROP COLUMN "CoachTeamId";

-- Step 5: (OPTIONAL - After Step 4) Rename new column to CoachTeamId
-- ALTER TABLE team_table RENAME COLUMN coach_team_record_id TO "CoachTeamId";

-- Verification query to check the migration
SELECT 
    t."UserId",
    t."UserName",
    t."CoachId",
    t."CoachTeamId" as old_varchar_value,
    t.coach_team_record_id as new_integer_fk,
    ct."Id" as coach_teams_id,
    ct."TeamId" as coach_teams_teamid,
    ct."CoachId",
    ct."CoCoachId"
FROM team_table t
LEFT JOIN coach_teams_table ct ON ct."Id" = t.coach_team_record_id
WHERE t."CoachId" IS NOT NULL
ORDER BY t."UserId"
LIMIT 20;
