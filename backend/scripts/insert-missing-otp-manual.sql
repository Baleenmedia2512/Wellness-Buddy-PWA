-- Find and Insert Missing OTP Records
-- Run this in Supabase SQL Editor

-- Step 1: Find which IDs are missing
SELECT generate_series(1, 360) AS missing_id
EXCEPT
SELECT id FROM otp_table
ORDER BY missing_id;

-- Step 2: After identifying the missing IDs, insert them manually
-- You'll need to get the data for these specific IDs from otpTable.json
-- and insert them like this:

/*
Example for inserting a missing record:

INSERT INTO otp_table 
(id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES 
(123, 'example@email.com', 'email', '$2b$10$...', '2025-12-31 23:59:59', 0, 0, '2025-01-01 00:00:00');

-- Repeat for each missing ID
*/

-- Step 3: Verify the count
SELECT COUNT(*) as total_records FROM otp_table;
-- Should show 360
