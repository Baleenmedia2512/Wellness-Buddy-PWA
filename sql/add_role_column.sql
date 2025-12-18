-- Add Role column to team_table for role-based access control
-- Created: December 18, 2025
-- Purpose: Enable admin/developer access restrictions for AI Monitor

-- Step 1: Add Role column with enum values
ALTER TABLE team_table 
ADD COLUMN Role ENUM('user', 'developer', 'admin') NOT NULL DEFAULT 'user' 
AFTER Email;

-- Step 2: Add index for faster role-based queries
CREATE INDEX idx_role ON team_table(Role);

-- Step 3: Update existing users to assign roles (CUSTOMIZE THESE)
-- Example: Set specific users as admin (update with actual admin emails)
UPDATE team_table 
SET Role = 'admin' 
WHERE Email IN (
    'admin@wellness.com',
    'loges@example.com'  -- Replace with actual admin email
);

-- Example: Set specific users as developer (update with actual developer emails)
UPDATE team_table 
SET Role = 'developer' 
WHERE Email IN (
    'dev@wellness.com',
    'developer@wellness.com'  -- Replace with actual developer emails
);

-- Verify the changes
SELECT UserId, UserName, Email, Role, Status 
FROM team_table 
ORDER BY Role DESC, UserName;

-- Show role distribution
SELECT Role, COUNT(*) as UserCount 
FROM team_table 
GROUP BY Role;
