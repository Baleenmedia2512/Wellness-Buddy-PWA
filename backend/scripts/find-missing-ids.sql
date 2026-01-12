-- Step 1: Find the 4 missing IDs
SELECT generate_series(1, 360) AS missing_id
EXCEPT
SELECT id FROM otp_table
ORDER BY missing_id;
