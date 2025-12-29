-- =====================================================
-- Discipline Report Test Data
-- Wellness Valley PWA
-- Date: December 29, 2025
-- =====================================================
-- 
-- This file creates realistic test data for two users:
-- - UserId 300: Easy2Work Tester (Good discipline, 80-90% score)
-- - UserId 349: Logesh Office (Poor discipline, 0-20% score)
--
-- Test scenarios:
-- ✅ Today (Dec 29, 2025) - both users have activity
-- ✅ Yesterday (Dec 28, 2025) - mixed results
-- ✅ Last 7 days - varying patterns
-- ✅ Last 30 days - full history
-- ✅ On-time vs Late posts
-- ✅ Missing activities
-- ✅ All activity types (weight, education, meals)
-- =====================================================

-- Set timezone for consistent timestamps
SET time_zone = '+00:00';

-- =====================================================
-- STEP 1: Verify Users Exist
-- =====================================================

-- Verify users 300 and 349 exist in team_table
SELECT UserId, UserName, Email, Status, TeamId, UplineCoachId
FROM team_table 
WHERE UserId IN (300, 349);

-- =====================================================
-- STEP 2: Verify Time Windows Exist
-- =====================================================

-- Check time windows are configured
SELECT * FROM activity_time_windows_table 
WHERE EffectiveToDate IS NULL 
ORDER BY ActivityType;

-- =====================================================
-- STEP 3: Insert Weight Tracking Data
-- =====================================================

-- User 300 (GOOD DISCIPLINE) - Weight tracking
-- Posts consistently on-time (3:00-6:30 AM)

-- TODAY (Dec 29) - ON-TIME
INSERT INTO weight_records_table (UserId, Weight, Bmi, CreatedAt, IsDeleted)
VALUES (300, 72.5, 23.1, '2025-12-29 04:15:00', 0);

-- YESTERDAY (Dec 28) - ON-TIME
INSERT INTO weight_records_table (UserId, Weight, Bmi, CreatedAt, IsDeleted)
VALUES (300, 72.8, 23.2, '2025-12-28 05:00:00', 0);

-- Dec 27 - ON-TIME
INSERT INTO weight_records_table (UserId, Weight, Bmi, CreatedAt, IsDeleted)
VALUES (300, 73.0, 23.3, '2025-12-27 04:30:00', 0);

-- Dec 26 - ON-TIME
INSERT INTO weight_records_table (UserId, Weight, Bmi, CreatedAt, IsDeleted)
VALUES (300, 73.2, 23.4, '2025-12-26 05:15:00', 0);

-- Dec 25 - ON-TIME (Christmas!)
INSERT INTO weight_records_table (UserId, Weight, Bmi, CreatedAt, IsDeleted)
VALUES (300, 73.5, 23.5, '2025-12-25 04:45:00', 0);

-- Dec 24 - ON-TIME
INSERT INTO weight_records_table (UserId, Weight, Bmi, CreatedAt, IsDeleted)
VALUES (300, 73.3, 23.4, '2025-12-24 05:30:00', 0);

-- Dec 23 - LATE (missed window by 1 hour - shows 1 late post)
INSERT INTO weight_records_table (UserId, Weight, Bmi, CreatedAt, IsDeleted)
VALUES (300, 73.1, 23.3, '2025-12-23 07:45:00', 0);

-- Older dates (for Last 30 Days test)
INSERT INTO weight_records_table (UserId, Weight, Bmi, CreatedAt, IsDeleted)
VALUES 
(300, 74.0, 23.6, '2025-12-20 04:20:00', 0),
(300, 74.2, 23.7, '2025-12-18 05:10:00', 0),
(300, 74.5, 23.8, '2025-12-15 04:55:00', 0),
(300, 75.0, 23.9, '2025-12-10 05:20:00', 0),
(300, 75.3, 24.0, '2025-12-05 04:30:00', 0),
(300, 75.5, 24.1, '2025-12-01 05:00:00', 0);


-- User 349 (POOR DISCIPLINE) - Weight tracking
-- Rarely posts, mostly late or missing

-- TODAY (Dec 29) - MISSED (no entry)

-- YESTERDAY (Dec 28) - MISSED (no entry)

-- Dec 26 - LATE (posted at 9 AM, way after window)
INSERT INTO weight_records_table (UserId, Weight, Bmi, CreatedAt, IsDeleted)
VALUES (349, 68.0, 22.1, '2025-12-26 09:00:00', 0);

-- Dec 20 - LATE (posted at 10 AM)
INSERT INTO weight_records_table (UserId, Weight, Bmi, CreatedAt, IsDeleted)
VALUES (349, 68.5, 22.2, '2025-12-20 10:30:00', 0);

-- Dec 10 - ON-TIME (rare good day!)
INSERT INTO weight_records_table (UserId, Weight, Bmi, CreatedAt, IsDeleted)
VALUES (349, 69.0, 22.4, '2025-12-10 05:00:00', 0);

SELECT 'Weight tracking data inserted successfully' AS Status;

-- =====================================================
-- STEP 4: Insert Education Meeting Data
-- =====================================================

-- User 300 (GOOD DISCIPLINE) - Education attendance
-- Attends meetings consistently (7:15-8:45 AM)

-- TODAY (Dec 29) - ON-TIME
INSERT INTO education_logs_table (UserId, Platform, Topic, CreatedAt, Confidence, IsDeleted)
VALUES (300, 'Zoom', 'Wellness Team Meeting', '2025-12-29 07:30:00', 0.95, 0);

-- YESTERDAY (Dec 28) - ON-TIME
INSERT INTO education_logs_table (UserId, Platform, Topic, CreatedAt, Confidence, IsDeleted)
VALUES (300, 'Google Meet', 'Nutrition Workshop', '2025-12-28 08:00:00', 0.92, 0);

-- Dec 27 - ON-TIME
INSERT INTO education_logs_table (UserId, Platform, Topic, CreatedAt, Confidence, IsDeleted)
VALUES (300, 'Zoom', 'Health & Fitness Webinar', '2025-12-27 07:45:00', 0.90, 0);

-- Dec 26 - ON-TIME
INSERT INTO education_logs_table (UserId, Platform, Topic, CreatedAt, Confidence, IsDeleted)
VALUES (300, 'Zoom', 'Holiday Health Tips', '2025-12-26 08:15:00', 0.88, 0);

-- Dec 25 - MISSED (Christmas day, no meeting)

-- Dec 24 - ON-TIME
INSERT INTO education_logs_table (UserId, Platform, Topic, CreatedAt, Confidence, IsDeleted)
VALUES (300, 'Google Meet', 'Year-End Review', '2025-12-24 07:50:00', 0.91, 0);

-- Dec 23 - ON-TIME
INSERT INTO education_logs_table (UserId, Platform, Topic, CreatedAt, Confidence, IsDeleted)
VALUES (300, 'Zoom', 'Weekly Team Sync', '2025-12-23 08:20:00', 0.89, 0);

-- Older dates
INSERT INTO education_logs_table (UserId, Platform, Topic, CreatedAt, Confidence, IsDeleted)
VALUES 
(300, 'Zoom', 'Wellness Strategy', '2025-12-20 07:35:00', 0.93, 0),
(300, 'Google Meet', 'Goal Setting Workshop', '2025-12-18 08:10:00', 0.87, 0),
(300, 'Zoom', 'Mid-Month Review', '2025-12-15 07:55:00', 0.94, 0);


-- User 349 (POOR DISCIPLINE) - Education attendance
-- Rarely attends meetings

-- TODAY (Dec 29) - MISSED

-- YESTERDAY (Dec 28) - MISSED

-- Dec 26 - LATE (joined at 10 AM, meeting ended)
INSERT INTO education_logs_table (UserId, Platform, Topic, CreatedAt, Confidence, IsDeleted)
VALUES (349, 'Zoom', 'Holiday Health Tips', '2025-12-26 10:00:00', 0.70, 0);

-- Dec 15 - LATE
INSERT INTO education_logs_table (UserId, Platform, Topic, CreatedAt, Confidence, IsDeleted)
VALUES (349, 'Google Meet', 'Mid-Month Review', '2025-12-15 09:30:00', 0.65, 0);

SELECT 'Education data inserted successfully' AS Status;

-- =====================================================
-- STEP 5: Insert Food/Nutrition Data (Meals)
-- =====================================================

-- User 300 (GOOD DISCIPLINE) - Meal tracking
-- Posts all 3 meals consistently on-time

-- ===== TODAY (Dec 29) =====

-- Breakfast (5:30-8:30) - ON-TIME
INSERT INTO food_nutrition_data_table (UserID, AnalysisData, TotalCalories, TotalProtein, TotalCarbs, TotalFat, CreatedAt, IsDeleted)
VALUES ('300', '{"foods":[{"name":"Breakfast"}]}', 400, 15, 50, 12, '2025-12-29 06:30:00', 0);

-- Lunch (12:00-16:00) - ON-TIME
INSERT INTO food_nutrition_data_table (UserID, AnalysisData, TotalCalories, TotalProtein, TotalCarbs, TotalFat, CreatedAt, IsDeleted)
VALUES ('300', '{"foods":[{"name":"Lunch"}]}', 600, 25, 70, 20, '2025-12-29 13:15:00', 0);

-- Dinner (17:30-20:30) - ON-TIME
INSERT INTO food_nutrition_data_table (UserID, AnalysisData, TotalCalories, TotalProtein, TotalCarbs, TotalFat, CreatedAt, IsDeleted)
VALUES ('300', '{"foods":[{"name":"Dinner"}]}', 500, 30, 45, 18, '2025-12-29 18:45:00', 0);


-- ===== YESTERDAY (Dec 28) =====

-- Breakfast - ON-TIME
INSERT INTO food_nutrition_data_table (UserID, AnalysisData, TotalCalories, TotalProtein, TotalCarbs, TotalFat, CreatedAt, IsDeleted)
VALUES ('300', '{"foods":[{"name":"Breakfast"}]}', 420, 16, 52, 13, '2025-12-28 07:00:00', 0);

-- Lunch - ON-TIME
INSERT INTO food_nutrition_data_table (UserID, AnalysisData, TotalCalories, TotalProtein, TotalCarbs, TotalFat, CreatedAt, IsDeleted)
VALUES ('300', '{"foods":[{"name":"Lunch"}]}', 580, 24, 68, 19, '2025-12-28 12:30:00', 0);

-- Dinner - ON-TIME
INSERT INTO food_nutrition_data_table (UserID, AnalysisData, TotalCalories, TotalProtein, TotalCarbs, TotalFat, CreatedAt, IsDeleted)
VALUES ('300', '{"foods":[{"name":"Dinner"}]}', 520, 28, 48, 20, '2025-12-28 19:00:00', 0);


-- ===== Dec 27 =====

-- Breakfast - ON-TIME
INSERT INTO food_nutrition_data_table (UserID, AnalysisData, TotalCalories, TotalProtein, TotalCarbs, TotalFat, CreatedAt, IsDeleted)
VALUES ('300', '{"foods":[{"name":"Breakfast"}]}', 410, 14, 51, 12, '2025-12-27 06:45:00', 0);

-- Lunch - ON-TIME
INSERT INTO food_nutrition_data_table (UserID, AnalysisData, TotalCalories, TotalProtein, TotalCarbs, TotalFat, CreatedAt, IsDeleted)
VALUES ('300', '{"foods":[{"name":"Lunch"}]}', 590, 26, 69, 18, '2025-12-27 13:00:00', 0);

-- Dinner - LATE (posted at 21:00, after 20:30 window)
INSERT INTO food_nutrition_data_table (UserID, AnalysisData, TotalCalories, TotalProtein, TotalCarbs, TotalFat, CreatedAt, IsDeleted)
VALUES ('300', '{"foods":[{"name":"Dinner"}]}', 510, 29, 46, 19, '2025-12-27 21:00:00', 0);


-- ===== Dec 26 =====

-- Breakfast - ON-TIME
INSERT INTO food_nutrition_data_table (UserID, AnalysisData, TotalCalories, TotalProtein, TotalCarbs, TotalFat, CreatedAt, IsDeleted)
VALUES ('300', '{"foods":[{"name":"Breakfast"}]}', 400, 15, 50, 12, '2025-12-26 07:15:00', 0);

-- Lunch - ON-TIME
INSERT INTO food_nutrition_data_table (UserID, AnalysisData, TotalCalories, TotalProtein, TotalCarbs, TotalFat, CreatedAt, IsDeleted)
VALUES ('300', '{"foods":[{"name":"Lunch"}]}', 600, 25, 70, 20, '2025-12-26 12:45:00', 0);

-- Dinner - ON-TIME
INSERT INTO food_nutrition_data_table (UserID, AnalysisData, TotalCalories, TotalProtein, TotalCarbs, TotalFat, CreatedAt, IsDeleted)
VALUES ('300', '{"foods":[{"name":"Dinner"}]}', 500, 30, 45, 18, '2025-12-26 18:30:00', 0);


-- ===== Dec 25 (Christmas) =====

-- Breakfast - ON-TIME
INSERT INTO food_nutrition_data_table (UserID, AnalysisData, TotalCalories, TotalProtein, TotalCarbs, TotalFat, CreatedAt, IsDeleted)
VALUES ('300', '{"foods":[{"name":"Christmas Breakfast"}]}', 450, 17, 55, 14, '2025-12-25 08:00:00', 0);

-- Lunch - ON-TIME
INSERT INTO food_nutrition_data_table (UserID, AnalysisData, TotalCalories, TotalProtein, TotalCarbs, TotalFat, CreatedAt, IsDeleted)
VALUES ('300', '{"foods":[{"name":"Christmas Lunch"}]}', 700, 35, 75, 25, '2025-12-25 13:30:00', 0);

-- Dinner - ON-TIME
INSERT INTO food_nutrition_data_table (UserID, AnalysisData, TotalCalories, TotalProtein, TotalCarbs, TotalFat, CreatedAt, IsDeleted)
VALUES ('300', '{"foods":[{"name":"Christmas Dinner"}]}', 650, 40, 60, 22, '2025-12-25 19:15:00', 0);


-- ===== Dec 24 =====

-- Breakfast - ON-TIME
INSERT INTO food_nutrition_data_table (UserID, AnalysisData, TotalCalories, TotalProtein, TotalCarbs, TotalFat, CreatedAt, IsDeleted)
VALUES ('300', '{"foods":[{"name":"Breakfast"}]}', 405, 15, 51, 12, '2025-12-24 06:50:00', 0);

-- Lunch - ON-TIME
INSERT INTO food_nutrition_data_table (UserID, AnalysisData, TotalCalories, TotalProtein, TotalCarbs, TotalFat, CreatedAt, IsDeleted)
VALUES ('300', '{"foods":[{"name":"Lunch"}]}', 595, 24, 69, 19, '2025-12-24 14:00:00', 0);

-- Dinner - ON-TIME
INSERT INTO food_nutrition_data_table (UserID, AnalysisData, TotalCalories, TotalProtein, TotalCarbs, TotalFat, CreatedAt, IsDeleted)
VALUES ('300', '{"foods":[{"name":"Dinner"}]}', 515, 31, 47, 19, '2025-12-24 18:00:00', 0);


-- ===== Dec 23 =====

-- Breakfast - ON-TIME
INSERT INTO food_nutrition_data_table (UserID, AnalysisData, TotalCalories, TotalProtein, TotalCarbs, TotalFat, CreatedAt, IsDeleted)
VALUES ('300', '{"foods":[{"name":"Breakfast"}]}', 415, 16, 52, 13, '2025-12-23 07:30:00', 0);

-- Lunch - ON-TIME
INSERT INTO food_nutrition_data_table (UserID, AnalysisData, TotalCalories, TotalProtein, TotalCarbs, TotalFat, CreatedAt, IsDeleted)
VALUES ('300', '{"foods":[{"name":"Lunch"}]}', 585, 25, 68, 20, '2025-12-23 12:15:00', 0);

-- Dinner - ON-TIME
INSERT INTO food_nutrition_data_table (UserID, AnalysisData, TotalCalories, TotalProtein, TotalCarbs, TotalFat, CreatedAt, IsDeleted)
VALUES ('300', '{"foods":[{"name":"Dinner"}]}', 505, 29, 46, 18, '2025-12-23 19:30:00', 0);

-- Older dates (bulk insert for Last 30 Days)
INSERT INTO food_nutrition_data_table (UserID, AnalysisData, TotalCalories, TotalProtein, TotalCarbs, TotalFat, CreatedAt, IsDeleted)
VALUES 
-- Dec 20
('300', '{"foods":[{"name":"Breakfast"}]}', 410, 15, 51, 12, '2025-12-20 07:00:00', 0),
('300', '{"foods":[{"name":"Lunch"}]}', 590, 25, 69, 19, '2025-12-20 13:00:00', 0),
('300', '{"foods":[{"name":"Dinner"}]}', 505, 30, 46, 18, '2025-12-20 18:30:00', 0),
-- Dec 18
('300', '{"foods":[{"name":"Breakfast"}]}', 405, 14, 50, 12, '2025-12-18 06:45:00', 0),
('300', '{"foods":[{"name":"Lunch"}]}', 585, 24, 68, 20, '2025-12-18 12:30:00', 0),
('300', '{"foods":[{"name":"Dinner"}]}', 510, 29, 47, 19, '2025-12-18 19:00:00', 0),
-- Dec 15
('300', '{"foods":[{"name":"Breakfast"}]}', 415, 16, 52, 13, '2025-12-15 07:15:00', 0),
('300', '{"foods":[{"name":"Lunch"}]}', 595, 26, 70, 19, '2025-12-15 13:15:00', 0),
('300', '{"foods":[{"name":"Dinner"}]}', 515, 30, 48, 20, '2025-12-15 18:45:00', 0),
-- Dec 10
('300', '{"foods":[{"name":"Breakfast"}]}', 400, 15, 50, 12, '2025-12-10 06:30:00', 0),
('300', '{"foods":[{"name":"Lunch"}]}', 600, 25, 70, 20, '2025-12-10 12:45:00', 0),
('300', '{"foods":[{"name":"Dinner"}]}', 520, 31, 49, 19, '2025-12-10 19:15:00', 0),
-- Dec 5
('300', '{"foods":[{"name":"Breakfast"}]}', 410, 15, 51, 12, '2025-12-05 07:00:00', 0),
('300', '{"foods":[{"name":"Lunch"}]}', 590, 25, 69, 19, '2025-12-05 13:00:00', 0),
('300', '{"foods":[{"name":"Dinner"}]}', 505, 29, 46, 18, '2025-12-05 18:30:00', 0),
-- Dec 1
('300', '{"foods":[{"name":"Breakfast"}]}', 405, 14, 50, 12, '2025-12-01 06:50:00', 0),
('300', '{"foods":[{"name":"Lunch"}]}', 580, 24, 68, 19, '2025-12-01 12:30:00', 0),
('300', '{"foods":[{"name":"Dinner"}]}', 510, 30, 47, 19, '2025-12-01 19:00:00', 0);


-- User 349 (POOR DISCIPLINE) - Meal tracking
-- Rarely posts meals, mostly late or missing

-- ===== TODAY (Dec 29) =====
-- ALL MISSED (no entries)

-- ===== YESTERDAY (Dec 28) =====
-- ALL MISSED (no entries)

-- ===== Dec 26 =====

-- Breakfast - MISSED
-- Lunch - LATE (posted at 17:00, after 16:00 window)
INSERT INTO food_nutrition_data_table (UserID, AnalysisData, TotalCalories, TotalProtein, TotalCarbs, TotalFat, CreatedAt, IsDeleted)
VALUES ('349', '{"foods":[{"name":"Late Lunch"}]}', 550, 20, 65, 18, '2025-12-26 17:00:00', 0);

-- Dinner - LATE (posted at 22:00, after 20:30 window)
INSERT INTO food_nutrition_data_table (UserID, AnalysisData, TotalCalories, TotalProtein, TotalCarbs, TotalFat, CreatedAt, IsDeleted)
VALUES ('349', '{"foods":[{"name":"Late Dinner"}]}', 480, 22, 55, 16, '2025-12-26 22:00:00', 0);


-- ===== Dec 23 =====

-- Breakfast - MISSED
-- Lunch - ON-TIME (rare!)
INSERT INTO food_nutrition_data_table (UserID, AnalysisData, TotalCalories, TotalProtein, TotalCarbs, TotalFat, CreatedAt, IsDeleted)
VALUES ('349', '{"foods":[{"name":"Lunch"}]}', 570, 23, 67, 19, '2025-12-23 13:30:00', 0);

-- Dinner - MISSED


-- ===== Dec 20 =====

-- Breakfast - LATE
INSERT INTO food_nutrition_data_table (UserID, AnalysisData, TotalCalories, TotalProtein, TotalCarbs, TotalFat, CreatedAt, IsDeleted)
VALUES ('349', '{"foods":[{"name":"Late Breakfast"}]}', 390, 13, 48, 11, '2025-12-20 10:00:00', 0);

-- Lunch - MISSED
-- Dinner - LATE
INSERT INTO food_nutrition_data_table (UserID, AnalysisData, TotalCalories, TotalProtein, TotalCarbs, TotalFat, CreatedAt, IsDeleted)
VALUES ('349', '{"foods":[{"name":"Late Dinner"}]}', 460, 20, 52, 15, '2025-12-20 21:30:00', 0);


-- ===== Dec 15 =====

-- Breakfast - MISSED
-- Lunch - LATE
INSERT INTO food_nutrition_data_table (UserID, AnalysisData, TotalCalories, TotalProtein, TotalCarbs, TotalFat, CreatedAt, IsDeleted)
VALUES ('349', '{"foods":[{"name":"Late Lunch"}]}', 540, 21, 64, 17, '2025-12-15 16:30:00', 0);

-- Dinner - MISSED


-- ===== Dec 10 =====

-- Breakfast - ON-TIME (good day)
INSERT INTO food_nutrition_data_table (UserID, AnalysisData, TotalCalories, TotalProtein, TotalCarbs, TotalFat, CreatedAt, IsDeleted)
VALUES ('349', '{"foods":[{"name":"Breakfast"}]}', 410, 15, 51, 12, '2025-12-10 07:30:00', 0);

-- Lunch - ON-TIME
INSERT INTO food_nutrition_data_table (UserID, AnalysisData, TotalCalories, TotalProtein, TotalCarbs, TotalFat, CreatedAt, IsDeleted)
VALUES ('349', '{"foods":[{"name":"Lunch"}]}', 590, 24, 69, 19, '2025-12-10 12:30:00', 0);

-- Dinner - ON-TIME
INSERT INTO food_nutrition_data_table (UserID, AnalysisData, TotalCalories, TotalProtein, TotalCarbs, TotalFat, CreatedAt, IsDeleted)
VALUES ('349', '{"foods":[{"name":"Dinner"}]}', 510, 28, 47, 18, '2025-12-10 19:00:00', 0);


-- ===== Sporadic older entries =====
INSERT INTO food_nutrition_data_table (UserID, AnalysisData, TotalCalories, TotalProtein, TotalCarbs, TotalFat, CreatedAt, IsDeleted)
VALUES 
('349', '{"foods":[{"name":"Late Breakfast"}]}', 380, 12, 47, 10, '2025-12-05 10:30:00', 0),  -- Late breakfast
('349', '{"foods":[{"name":"Late Dinner"}]}', 470, 21, 53, 16, '2025-12-01 21:00:00', 0);  -- Late dinner

SELECT 'Food/nutrition data inserted successfully' AS Status;

-- =====================================================
-- STEP 6: Verification Queries
-- =====================================================

-- Count posts per user per activity type
SELECT 
  'User 300 (Good)' as User,
  'Weight' as Activity,
  COUNT(*) as TotalPosts,
  SUM(CASE WHEN TIME(CreatedAt) BETWEEN '03:00:00' AND '06:30:00' THEN 1 ELSE 0 END) as OnTimePosts,
  SUM(CASE WHEN TIME(CreatedAt) NOT BETWEEN '03:00:00' AND '06:30:00' THEN 1 ELSE 0 END) as LatePosts
FROM weight_records_table
WHERE UserId = 300 AND IsDeleted = 0

UNION ALL

SELECT 
  'User 300 (Good)' as User,
  'Education' as Activity,
  COUNT(*) as TotalPosts,
  SUM(CASE WHEN TIME(CreatedAt) BETWEEN '07:15:00' AND '08:45:00' THEN 1 ELSE 0 END) as OnTimePosts,
  SUM(CASE WHEN TIME(CreatedAt) NOT BETWEEN '07:15:00' AND '08:45:00' THEN 1 ELSE 0 END) as LatePosts
FROM education_logs_table
WHERE UserId = 300 AND IsDeleted = 0

UNION ALL

SELECT 
  'User 300 (Good)' as User,
  CASE
    WHEN TIME(CreatedAt) BETWEEN '05:30:00' AND '08:30:00' THEN 'Breakfast'
    WHEN TIME(CreatedAt) BETWEEN '12:00:00' AND '16:00:00' THEN 'Lunch'
    WHEN TIME(CreatedAt) BETWEEN '17:30:00' AND '20:30:00' THEN 'Dinner'
    ELSE 'Other'
  END as Activity,
  COUNT(*) as TotalPosts,
  COUNT(*) as OnTimePosts,
  0 as LatePosts
FROM food_nutrition_data_table
WHERE CAST(UserID AS UNSIGNED) = 300 
  AND IsDeleted = 0
  AND TIME(CreatedAt) BETWEEN '05:30:00' AND '20:30:00'
GROUP BY Activity

UNION ALL

SELECT 
  'User 349 (Poor)' as User,
  'Weight' as Activity,
  COUNT(*) as TotalPosts,
  SUM(CASE WHEN TIME(CreatedAt) BETWEEN '03:00:00' AND '06:30:00' THEN 1 ELSE 0 END) as OnTimePosts,
  SUM(CASE WHEN TIME(CreatedAt) NOT BETWEEN '03:00:00' AND '06:30:00' THEN 1 ELSE 0 END) as LatePosts
FROM weight_records_table
WHERE UserId = 349 AND IsDeleted = 0

UNION ALL

SELECT 
  'User 349 (Poor)' as User,
  'Education' as Activity,
  COUNT(*) as TotalPosts,
  SUM(CASE WHEN TIME(CreatedAt) BETWEEN '07:15:00' AND '08:45:00' THEN 1 ELSE 0 END) as OnTimePosts,
  SUM(CASE WHEN TIME(CreatedAt) NOT BETWEEN '07:15:00' AND '08:45:00' THEN 1 ELSE 0 END) as LatePosts
FROM education_logs_table
WHERE UserId = 349 AND IsDeleted = 0

UNION ALL

SELECT 
  'User 349 (Poor)' as User,
  'Meals' as Activity,
  COUNT(*) as TotalPosts,
  SUM(CASE 
    WHEN (TIME(CreatedAt) BETWEEN '05:30:00' AND '08:30:00')
      OR (TIME(CreatedAt) BETWEEN '12:00:00' AND '16:00:00')
      OR (TIME(CreatedAt) BETWEEN '17:30:00' AND '20:30:00')
    THEN 1 ELSE 0 
  END) as OnTimePosts,
  SUM(CASE 
    WHEN TIME(CreatedAt) NOT BETWEEN '05:30:00' AND '20:30:00'
      OR (TIME(CreatedAt) NOT BETWEEN '05:30:00' AND '08:30:00'
          AND TIME(CreatedAt) NOT BETWEEN '12:00:00' AND '16:00:00'
          AND TIME(CreatedAt) NOT BETWEEN '17:30:00' AND '20:30:00')
    THEN 1 ELSE 0 
  END) as LatePosts
FROM food_nutrition_data_table
WHERE CAST(UserID AS UNSIGNED) = 349 AND IsDeleted = 0;


-- Show today's activity (Dec 29, 2025)
SELECT 'TODAY ACTIVITY (Dec 29, 2025)' as Report;

SELECT 
  300 as UserId,
  'User 300 (Good)' as User,
  'Weight' as Activity,
  CreatedAt,
  CASE WHEN TIME(CreatedAt) BETWEEN '03:00:00' AND '06:30:00' THEN '✅ ON-TIME' ELSE '⚠️ LATE' END as Status
FROM weight_records_table
WHERE UserId = 300 AND DATE(CreatedAt) = '2025-12-29' AND IsDeleted = 0

UNION ALL

SELECT 
  300 as UserId,
  'User 300 (Good)' as User,
  'Education' as Activity,
  CreatedAt,
  CASE WHEN TIME(CreatedAt) BETWEEN '07:15:00' AND '08:45:00' THEN '✅ ON-TIME' ELSE '⚠️ LATE' END as Status
FROM education_logs_table
WHERE UserId = 300 AND DATE(CreatedAt) = '2025-12-29' AND IsDeleted = 0

UNION ALL

SELECT 
  300 as UserId,
  'User 300 (Good)' as User,
  CONCAT('Meal (', 
    CASE
      WHEN TIME(CreatedAt) BETWEEN '05:30:00' AND '08:30:00' THEN 'Breakfast'
      WHEN TIME(CreatedAt) BETWEEN '12:00:00' AND '16:00:00' THEN 'Lunch'
      WHEN TIME(CreatedAt) BETWEEN '17:30:00' AND '20:30:00' THEN 'Dinner'
      ELSE 'Unknown'
    END, 
  ')') as Activity,
  CAST(CreatedAt AS DATETIME) as CreatedAt,
  '✅ ON-TIME' as Status
FROM food_nutrition_data_table
WHERE CAST(UserID AS UNSIGNED) = 300 
  AND DATE(CreatedAt) = '2025-12-29' 
  AND IsDeleted = 0

ORDER BY UserId, CreatedAt;

-- Check if User 349 has any activity today (should be none)
SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN '❌ User 349 (Poor) - NO ACTIVITY TODAY'
    ELSE CONCAT('User 349 has ', COUNT(*), ' activities today')
  END as TodayStatus
FROM (
  SELECT CreatedAt FROM weight_records_table 
  WHERE UserId = 349 AND DATE(CreatedAt) = '2025-12-29' AND IsDeleted = 0
  UNION ALL
  SELECT CreatedAt FROM education_logs_table 
  WHERE UserId = 349 AND DATE(CreatedAt) = '2025-12-29' AND IsDeleted = 0
  UNION ALL
  SELECT CreatedAt FROM food_nutrition_data_table 
  WHERE CAST(UserID AS UNSIGNED) = 349 AND DATE(CreatedAt) = '2025-12-29' AND IsDeleted = 0
) as combined;

-- =====================================================
-- FINAL STATUS
-- =====================================================

SELECT '✅ TEST DATA CREATED SUCCESSFULLY!' as Status;
SELECT 'Users 300 (Good Discipline) and 349 (Poor Discipline) are ready for testing' as Message;
SELECT 'Test scenarios: Today, Yesterday, Last 7 Days, Last 30 Days' as Coverage;
SELECT 'Activity types: Weight, Education, Breakfast, Lunch, Dinner' as Activities;
SELECT 'Expected results:' as '';
SELECT '- User 300 should score 80-90% (mostly on-time posts)' as '';
SELECT '- User 349 should score 0-20% (mostly late/missing posts)' as '';
SELECT '- Both users share the same coach (UserId 1) and TeamId (TEST123001)' as '';
