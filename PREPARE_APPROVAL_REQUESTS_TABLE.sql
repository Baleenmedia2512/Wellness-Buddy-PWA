-- ========================================
-- RECREATE APPROVAL_REQUESTS_TABLE TO MATCH IMAGE 1
-- Run this in Supabase SQL Editor FIRST
-- ========================================

-- Drop existing table if it has wrong structure
DROP TABLE IF EXISTS approval_requests_table CASCADE;

-- Create table with exact columns from image 1 (PascalCase)
CREATE TABLE approval_requests_table (
  "Id" SERIAL PRIMARY KEY,
  "RequesterId" INTEGER NOT NULL,
  "UplineCoachId" INTEGER NOT NULL,
  "Status" VARCHAR(50) NOT NULL DEFAULT 'pending',
  "OtpHash" VARCHAR(255),
  "OtpExpiresAt" TIMESTAMP,
  "OtpAttempts" INTEGER DEFAULT 0,
  "OtpSentAt" TIMESTAMP,
  "RequestedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "ProcessedAt" TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_approval_requester ON approval_requests_table("RequesterId");
CREATE INDEX idx_approval_coach ON approval_requests_table("UplineCoachId");
CREATE INDEX idx_approval_status ON approval_requests_table("Status");
CREATE INDEX idx_approval_expires ON approval_requests_table("OtpExpiresAt");

-- Add comments
COMMENT ON TABLE approval_requests_table IS 'Stores approval requests with OTP validation';
COMMENT ON COLUMN approval_requests_table."Id" IS 'Auto-incrementing primary key';
COMMENT ON COLUMN approval_requests_table."RequesterId" IS 'User ID requesting approval';
COMMENT ON COLUMN approval_requests_table."UplineCoachId" IS 'Coach ID to approve request';
COMMENT ON COLUMN approval_requests_table."Status" IS 'Request status: pending, approved, cancelled';
COMMENT ON COLUMN approval_requests_table."OtpHash" IS 'Bcrypt hash of OTP sent to coach';
COMMENT ON COLUMN approval_requests_table."OtpExpiresAt" IS 'When the OTP expires (24 hours)';
COMMENT ON COLUMN approval_requests_table."OtpAttempts" IS 'Number of failed OTP attempts';
COMMENT ON COLUMN approval_requests_table."OtpSentAt" IS 'When OTP was sent to coach email';
COMMENT ON COLUMN approval_requests_table."RequestedAt" IS 'When request was created';
COMMENT ON COLUMN approval_requests_table."ProcessedAt" IS 'When request was approved/cancelled';

-- ========================================
-- VERIFICATION QUERIES
-- ========================================

-- Check table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'approval_requests_table'
ORDER BY ordinal_position;

-- Check if table is empty
SELECT COUNT(*) as record_count FROM approval_requests_table;
