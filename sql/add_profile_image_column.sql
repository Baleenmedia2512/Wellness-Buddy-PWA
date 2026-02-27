-- Migration: Add ProfileImage column to team_table
-- Date: 2026-02-27
-- Description: Adds ProfileImage column for storing Base64 encoded user profile images

-- Add ProfileImage column to team_table
ALTER TABLE team_table 
ADD COLUMN IF NOT EXISTS "ProfileImage" TEXT NULL;

-- Add comment for documentation
COMMENT ON COLUMN team_table."ProfileImage" IS 'Base64 encoded profile image data (format: data:image/png;base64,...)';

-- Verify the column was added successfully
SELECT column_name, data_type, is_nullable, character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'team_table' AND column_name = 'ProfileImage';

-- Check sample data (should show NULL for existing users)
SELECT "UserId", "UserName", "Email", 
       CASE 
         WHEN "ProfileImage" IS NULL THEN 'No Image'
         ELSE 'Has Image'
       END as image_status
FROM team_table 
LIMIT 5;
