-- =====================================================
-- Coach Team Setup - Database Schema
-- Wellness Buddy PWA
-- Date: December 22, 2025
-- =====================================================

-- Database: baleed5_wellness
-- Naming Convention: PascalCase columns, _table suffix
-- Note: Coach-member relationships tracked via team_table.UplineCoachId (no separate junction table needed)
-- Note: Foreign keys are OPTIONAL - app works without them (validation in backend code)

-- IMPORTANT: Execute sections in order:
-- 1. Run Section 1 first (ALTER team_table)
-- 2. Then run Sections 2 & 3 (CREATE new tables)
-- 3. Verification queries at the end

-- =====================================================
-- 1. MODIFY EXISTING team_table (users table)
-- Add TeamId and UplineCoachId columns
-- SKIP THIS SECTION - COLUMNS ALREADY EXIST ✅
-- =====================================================

-- TeamId and UplineCoachId already added to team_table
-- If you need to re-add them, uncomment below:

/*
ALTER TABLE team_table
ADD COLUMN TeamId VARCHAR(10) NULL UNIQUE COMMENT 'User\'s unique Team ID (format: ABC123XYZ0)',
ADD COLUMN UplineCoachId INT NULL COMMENT 'Foreign key to coach\'s UserId',
ADD CONSTRAINT fk_upline_coach 
    FOREIGN KEY (UplineCoachId) REFERENCES team_table(UserId)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Add indexes for performance
CREATE INDEX idx_team_id ON team_table(TeamId);
CREATE INDEX idx_upline_coach_id ON team_table(UplineCoachId);
*/

-- =====================================================
-- 2. CREATE coach_teams_table
-- Tracks which coaches are assigned to each TeamId
-- Max 2 coaches per TeamId (CoachId and CoCoachId)
-- =====================================================

-- Drop table if it exists (allows re-running this script)
DROP TABLE IF EXISTS coach_teams_table;

CREATE TABLE coach_teams_table (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    TeamId VARCHAR(10) NOT NULL UNIQUE COMMENT 'Team identifier',
    CoachId INT NULL COMMENT 'Primary coach UserId',
    CoCoachId INT NULL COMMENT 'Secondary coach UserId (optional)',
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Stores coach assignments per TeamId (max 2 coaches)';

-- Indexes
CREATE INDEX idx_coach_id ON coach_teams_table(CoachId);
CREATE INDEX idx_cocoach_id ON coach_teams_table(CoCoachId);

-- =====================================================
-- 3. CREATE approval_requests_table
-- Stores OTP requests with 24-hour expiry
-- =====================================================

-- Drop table if it exists (allows re-running this script)
DROP TABLE IF EXISTS approval_requests_table;

CREATE TABLE approval_requests_table (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    RequesterId INT NOT NULL COMMENT 'UserId of person requesting approval',
    UplineCoachId INT NOT NULL COMMENT 'UserId of coach being requested',
    Status ENUM('pending', 'approved', 'rejected', 'expired') DEFAULT 'pending' COMMENT 'Request status',
    
    -- OTP fields
    OtpHash VARCHAR(255) NULL COMMENT 'Bcrypt hash of 6-digit OTP',
    OtpExpiresAt DATETIME NULL COMMENT 'OTP expiry timestamp (24 hours from generation)',
    OtpAttempts INT DEFAULT 0 COMMENT 'Number of failed validation attempts',
    OtpSentAt DATETIME NULL COMMENT 'When OTP email was sent to coach',
    
    -- Timestamps
    RequestedAt DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'When request was created',
    ProcessedAt DATETIME NULL COMMENT 'When request was approved/rejected'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Stores approval requests with OTP validation (24h expiry)';

-- Indexes for performance
CREATE INDEX idx_requester_pending ON approval_requests_table(RequesterId, Status);
CREATE INDEX idx_coach_pending ON approval_requests_table(UplineCoachId, Status);
CREATE INDEX idx_status_expiry ON approval_requests_table(Status, OtpExpiresAt);
CREATE INDEX idx_requested_at ON approval_requests_table(RequestedAt);

-- =====================================================
-- 4. ADD FOREIGN KEYS (OPTIONAL - Skip if permission errors)
-- Foreign keys provide database-level data integrity
-- App will work without them - validation handled in backend
-- =====================================================

-- Foreign keys for coach_teams_table
ALTER TABLE coach_teams_table
ADD CONSTRAINT fk_coach_teams_coach 
    FOREIGN KEY (CoachId) REFERENCES team_table(UserId)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

ALTER TABLE coach_teams_table
ADD CONSTRAINT fk_coach_teams_cocoach 
    FOREIGN KEY (CoCoachId) REFERENCES team_table(UserId)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Foreign keys for approval_requests_table
ALTER TABLE approval_requests_table
ADD CONSTRAINT fk_approval_requester 
    FOREIGN KEY (RequesterId) REFERENCES team_table(UserId)
    ON DELETE CASCADE
    ON UPDATE CASCADE;

ALTER TABLE approval_requests_table
ADD CONSTRAINT fk_approval_coach 
    FOREIGN KEY (UplineCoachId) REFERENCES team_table(UserId)
    ON DELETE CASCADE
    ON UPDATE CASCADE;

-- Check constraints (MySQL 8.0.16+)
ALTER TABLE coach_teams_table
ADD CONSTRAINT chk_team_id_format CHECK (LENGTH(TeamId) = 10);

ALTER TABLE coach_teams_table
ADD CONSTRAINT chk_different_coaches CHECK (CoachId != CoCoachId OR CoCoachId IS NULL);

-- Add CHECK constraints separately (MySQL 8.0.16+ compatibility)
ALTER TABLE approval_requests_table
ADD CONSTRAINT chk_not_self_approval CHECK (RequesterId != UplineCoachId);

ALTER TABLE approval_requests_table
ADD CONSTRAINT chk_otp_attempts CHECK (OtpAttempts >= 0 AND OtpAttempts <= 10);

-- =====================================================
-- 5. VERIFICATION QUERIES
-- Run these to verify schema is correct
-- =====================================================

-- Check team_table columns
DESCRIBE team_table;

-- Check all new tables exist
SHOW TABLES LIKE '%team%';

-- Verify constraints
SELECT 
    CONSTRAINT_NAME,
    TABLE_NAME,
    CONSTRAINT_TYPE
FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
WHERE TABLE_SCHEMA = 'baleed5_wellness'
  AND TABLE_NAME IN ('team_table', 'coach_teams_table', 'approval_requests_table');

-- Verify foreign keys
SELECT 
    CONSTRAINT_NAME,
    TABLE_NAME,
    COLUMN_NAME,
    REFERENCED_TABLE_NAME,
    REFERENCED_COLUMN_NAME
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = 'baleed5_wellness'
  AND REFERENCED_TABLE_NAME IS NOT NULL
  AND TABLE_NAME IN ('coach_teams_table', 'approval_requests_table');

-- =====================================================
-- 6. SAMPLE TEST DATA (Optional - for development)
-- =====================================================

-- Insert sample coach in team_table (assuming UserId 100 exists)
-- UPDATE team_table SET TeamId = 'ABC123XYZ0' WHERE UserId = 100;

-- Insert sample team assignment
-- INSERT INTO coach_teams_table (TeamId, CoachId) VALUES ('ABC123XYZ0', 100);

-- Insert sample approval request
-- INSERT INTO approval_requests_table (RequesterId, UplineCoachId, OtpHash, OtpExpiresAt, OtpSentAt)
-- VALUES (
--     101,  -- Requester UserId
--     100,  -- Coach UserId
--     '$2b$10$examplehash',  -- Replace with actual bcrypt hash
--     DATE_ADD(NOW(), INTERVAL 24 HOUR),  -- 24 hours from now
--     NOW()
-- );

-- =====================================================
-- 7. ROLLBACK SCRIPT (Use if you need to undo changes)
-- =====================================================

/*
-- WARNING: This will delete all data in these tables

-- Drop tables in reverse order (foreign keys)
DROP TABLE IF EXISTS approval_requests_table;
DROP TABLE IF EXISTS coach_teams_table;

-- Remove columns from team_table
ALTER TABLE team_table
DROP FOREIGN KEY IF EXISTS fk_upline_coach,
DROP COLUMN IF EXISTS UplineCoachId,
DROP COLUMN IF EXISTS TeamId;

-- Remove indexes
DROP INDEX IF EXISTS idx_team_id ON team_table;
DROP INDEX IF EXISTS idx_upline_coach_id ON team_table;
*/

-- =====================================================
-- END OF SCHEMA
-- =====================================================
