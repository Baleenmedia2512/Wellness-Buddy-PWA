-- Add diet_type column to team_table for AI personalization
-- Part of Day 2: Diet Profile & Context Loading System

ALTER TABLE team_table
ADD COLUMN DietType ENUM('Vegetarian', 'Non-Vegetarian', 'Vegan', 'Pescatarian') DEFAULT NULL
AFTER Email;

-- Add index for efficient filtering by diet type
CREATE INDEX idx_diet_type ON team_table(DietType);

-- Optional: View updated table structure
-- DESCRIBE team_table;

-- Optional: Test query
-- SELECT UserId, UserName, Email, DietType FROM team_table LIMIT 5;
