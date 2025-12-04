z-- Migration: Add profile columns to team_table
-- Date: 2024-12-01
-- Description: Adds Height, Age, and Gender columns for user profile data

ALTER TABLE team_table
ADD COLUMN Height DECIMAL(5,2) NULL COMMENT 'User height in centimeters',
ADD COLUMN Age INT NULL COMMENT 'User age in years',
ADD COLUMN Gender ENUM('male', 'female') NULL COMMENT 'User gender';
