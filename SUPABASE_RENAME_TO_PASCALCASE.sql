-- ========================================
-- RENAME COLUMNS TO PascalCase in Supabase
-- Run this in Supabase SQL Editor
-- ========================================

-- team_table
ALTER TABLE team_table RENAME COLUMN entry_date_time TO "EntryDateTime";
ALTER TABLE team_table RENAME COLUMN entry_user TO "EntryUser";
ALTER TABLE team_table RENAME COLUMN user_id TO "UserId";
ALTER TABLE team_table RENAME COLUMN user_name TO "UserName";
ALTER TABLE team_table RENAME COLUMN password TO "Password";
ALTER TABLE team_table RENAME COLUMN target_weight_in_kg TO "TargetWeightInKg";
ALTER TABLE team_table RENAME COLUMN coach_name TO "CoachName";
ALTER TABLE team_table RENAME COLUMN co_coach_name TO "CoCoachName";
ALTER TABLE team_table RENAME COLUMN status TO "Status";
ALTER TABLE team_table RENAME COLUMN coach_approved TO "CoachApproved";
ALTER TABLE team_table RENAME COLUMN email TO "Email";
ALTER TABLE team_table RENAME COLUMN role TO "Role";
ALTER TABLE team_table RENAME COLUMN diet_type TO "DietType";
ALTER TABLE team_table RENAME COLUMN height TO "Height";
ALTER TABLE team_table RENAME COLUMN team_id TO "TeamId";
ALTER TABLE team_table RENAME COLUMN upline_coach_id TO "UplineCoachId";

-- weight_records_table
ALTER TABLE weight_records_table RENAME COLUMN user_id TO "UserId";
ALTER TABLE weight_records_table RENAME COLUMN weight TO "Weight";
ALTER TABLE weight_records_table RENAME COLUMN bmr TO "Bmr";
ALTER TABLE weight_records_table RENAME COLUMN created_at TO "CreatedAt";
ALTER TABLE weight_records_table RENAME COLUMN is_deleted TO "IsDeleted";

-- approval_requests_table
ALTER TABLE approval_requests_table RENAME COLUMN id TO "Id";
ALTER TABLE approval_requests_table RENAME COLUMN requester_id TO "RequesterId";
ALTER TABLE approval_requests_table RENAME COLUMN upline_coach_id TO "UplineCoachId";
ALTER TABLE approval_requests_table RENAME COLUMN status TO "Status";
ALTER TABLE approval_requests_table RENAME COLUMN otp_expires_at TO "OtpExpiresAt";
ALTER TABLE approval_requests_table RENAME COLUMN requested_at TO "RequestedAt";

-- food_corrections_table
ALTER TABLE food_corrections_table RENAME COLUMN user_id TO "UserId";
ALTER TABLE food_corrections_table RENAME COLUMN ai_detected TO "AiDetected";
ALTER TABLE food_corrections_table RENAME COLUMN user_corrected TO "UserCorrected";
ALTER TABLE food_corrections_table RENAME COLUMN times_corrected TO "TimesCorrected";
ALTER TABLE food_corrections_table RENAME COLUMN last_corrected TO "LastCorrected";

-- food_nutrition_data_table
ALTER TABLE food_nutrition_data_table RENAME COLUMN user_id TO "UserId";
ALTER TABLE food_nutrition_data_table RENAME COLUMN analysis_data TO "AnalysisData";
ALTER TABLE food_nutrition_data_table RENAME COLUMN created_at TO "CreatedAt";
ALTER TABLE food_nutrition_data_table RENAME COLUMN is_deleted TO "IsDeleted";

-- ========================================
-- VERIFICATION QUERIES
-- Run these to verify the changes
-- ========================================

-- Check team_table columns
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'team_table' 
ORDER BY ordinal_position;

-- Check all table columns
SELECT table_name, column_name 
FROM information_schema.columns 
WHERE table_schema = 'public' 
ORDER BY table_name, ordinal_position;
