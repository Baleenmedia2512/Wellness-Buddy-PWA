-- ========================================
-- CREATE OTP TABLE IN SUPABASE
-- Run this in Supabase SQL Editor FIRST
-- ========================================

CREATE TABLE IF NOT EXISTS otp_tokens_table (
  "Id" SERIAL PRIMARY KEY,
  "Recipient" VARCHAR(255) NOT NULL,
  "ContactType" VARCHAR(50) NOT NULL DEFAULT 'email',
  "OtpHash" VARCHAR(255) NOT NULL,
  "ExpiresAt" TIMESTAMP NOT NULL,
  "Verified" INTEGER DEFAULT 0,
  "IsActive" INTEGER DEFAULT 0,
  "CreatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_otp_recipient ON otp_tokens_table("Recipient");
CREATE INDEX IF NOT EXISTS idx_otp_expires ON otp_tokens_table("ExpiresAt");
CREATE INDEX IF NOT EXISTS idx_otp_active ON otp_tokens_table("IsActive");

-- Add comments
COMMENT ON TABLE otp_tokens_table IS 'Stores OTP tokens for email verification';
COMMENT ON COLUMN otp_tokens_table."Id" IS 'Auto-incrementing primary key';
COMMENT ON COLUMN otp_tokens_table."Recipient" IS 'Email address receiving the OTP';
COMMENT ON COLUMN otp_tokens_table."ContactType" IS 'Contact method (email, sms, etc.)';
COMMENT ON COLUMN otp_tokens_table."OtpHash" IS 'Bcrypt hash of the OTP code';
COMMENT ON COLUMN otp_tokens_table."ExpiresAt" IS 'When the OTP expires';
COMMENT ON COLUMN otp_tokens_table."Verified" IS '0=not verified, 1=verified';
COMMENT ON COLUMN otp_tokens_table."IsActive" IS '0=inactive, 1=active';
COMMENT ON COLUMN otp_tokens_table."CreatedAt" IS 'When the OTP was created';

-- ========================================
-- VERIFICATION QUERIES
-- ========================================

-- Check table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'otp_tokens_table'
ORDER BY ordinal_position;

-- Check if table is empty
SELECT COUNT(*) as record_count FROM otp_tokens_table;
