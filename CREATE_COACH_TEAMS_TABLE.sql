-- ========================================
-- CREATE COACH_TEAMS_TABLE IN SUPABASE
-- Run this in Supabase SQL Editor FIRST
-- ========================================

-- Drop existing table if it has wrong structure
DROP TABLE IF EXISTS coach_teams_table CASCADE;

-- Create table with columns from coachteamsTable.json (PascalCase)
CREATE TABLE coach_teams_table (
  "Id" SERIAL PRIMARY KEY,
  "TeamId" VARCHAR(50) NOT NULL UNIQUE,
  "CoachId" INTEGER NOT NULL,
  "CoCoachId" INTEGER DEFAULT 0,
  "Status" VARCHAR(20) NOT NULL DEFAULT 'active',
  "CreatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "UpdatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_coach_teams_coach ON coach_teams_table("CoachId");
CREATE INDEX idx_coach_teams_cocoach ON coach_teams_table("CoCoachId");
CREATE INDEX idx_coach_teams_status ON coach_teams_table("Status");
CREATE INDEX idx_coach_teams_teamid ON coach_teams_table("TeamId");

-- Add comments
COMMENT ON TABLE coach_teams_table IS 'Stores coach teams with coach and co-coach assignments';
COMMENT ON COLUMN coach_teams_table."Id" IS 'Auto-incrementing primary key';
COMMENT ON COLUMN coach_teams_table."TeamId" IS 'Unique team identifier';
COMMENT ON COLUMN coach_teams_table."CoachId" IS 'Primary coach user ID';
COMMENT ON COLUMN coach_teams_table."CoCoachId" IS 'Co-coach user ID (0 if none)';
COMMENT ON COLUMN coach_teams_table."Status" IS 'Team status: active, inactive';
COMMENT ON COLUMN coach_teams_table."CreatedAt" IS 'When the team was created';
COMMENT ON COLUMN coach_teams_table."UpdatedAt" IS 'Last update timestamp';

-- ========================================
-- VERIFICATION QUERIES
-- ========================================

-- Check table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'coach_teams_table'
ORDER BY ordinal_position;

-- Check if table is empty
SELECT COUNT(*) as record_count FROM coach_teams_table;
