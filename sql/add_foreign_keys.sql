-- =====================================================
-- Add Foreign Keys to Coach Team Setup Tables
-- Run this AFTER tables are created
-- Database: baleed5_wellness
-- =====================================================

-- Add foreign keys for coach_teams_table
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

-- Add foreign keys for approval_requests_table
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
