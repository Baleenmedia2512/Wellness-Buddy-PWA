-- Migration: Remove Age and Gender columns from team_table
-- Date: 2025-12-01
-- Description: Only keep Height column for user profile

-- Remove Age column
ALTER TABLE team_table DROP COLUMN Age;

-- Remove Gender column
ALTER TABLE team_table DROP COLUMN Gender;

-- Note: Height column is retained for user profile
