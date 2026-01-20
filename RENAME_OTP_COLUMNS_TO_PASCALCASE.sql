-- ========================================
-- RENAME OTP TABLE COLUMNS TO PascalCase
-- Run this in Supabase SQL Editor
-- ========================================

-- Rename columns to PascalCase to match your preference
ALTER TABLE otp_tokens_table RENAME COLUMN id TO "ID";
ALTER TABLE otp_tokens_table RENAME COLUMN identifier TO "Recipient";
ALTER TABLE otp_tokens_table RENAME COLUMN identifier_type TO "ContactType";
ALTER TABLE otp_tokens_table RENAME COLUMN token TO "OTPHash";
ALTER TABLE otp_tokens_table RENAME COLUMN expires_at TO "ExpiresAt";
ALTER TABLE otp_tokens_table RENAME COLUMN is_verified TO "Verified";
ALTER TABLE otp_tokens_table RENAME COLUMN password_reset TO "IsActive";
ALTER TABLE otp_tokens_table RENAME COLUMN created_at TO "CreatedAt";

-- ========================================
-- VERIFICATION QUERY
-- ========================================

-- Check the renamed columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'otp_tokens_table'
ORDER BY ordinal_position;

-- Verify data
SELECT "ID", "Recipient", "ContactType", "OTPHash", "ExpiresAt", "Verified", "IsActive", "CreatedAt"
FROM otp_tokens_table
LIMIT 5;
