-- Migration: Add City and Village fields to education_logs_table
-- Date: 2026-04-27
-- Description: Add location tracking for attendance reports
-- City and Village are extracted from GPS coordinates using reverse geocoding
-- Format: Village (area, locality), City (main city)
-- Example: Village = "Gvl Nagar, perur chettipalayam", City = "coimbatore"

-- Add City and Village to education_logs_table (attendance logs)
ALTER TABLE education_logs_table
ADD COLUMN IF NOT EXISTS "City" VARCHAR(255),
ADD COLUMN IF NOT EXISTS "Village" VARCHAR(255);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_education_logs_city ON education_logs_table("City");
CREATE INDEX IF NOT EXISTS idx_education_logs_village ON education_logs_table("Village");

-- Add comments
COMMENT ON COLUMN team_table."City" IS 'User city for attendance tracking';
COMMENT ON COLUMN team_table."Village" IS 'User village for attendance tracking';
COMMENT ON COLUMN education_logs_table."City" IS 'City where attendance was logged';
COMMENT ON COLUMN education_logs_table."Village" IS 'Village where attendance was logged';
