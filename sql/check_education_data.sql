-- =====================================================
-- Check Education Data for User 300
-- Debug why Education shows 200%
-- =====================================================

-- Check all education posts for User 300 TODAY (Dec 29, 2025)
SELECT 
    Id,
    UserId,
    Platform,
    Topic,
    CreatedAt,
    TIME(CreatedAt) as PostTime,
    CASE 
        WHEN TIME(CreatedAt) BETWEEN '07:15:00' AND '08:45:00' THEN '✅ ON-TIME'
        ELSE '⚠️ LATE'
    END as Status,
    Confidence,
    IsDeleted
FROM education_logs_table
WHERE UserId = 300 
    AND DATE(CreatedAt) = '2025-12-29'
ORDER BY CreatedAt;

-- Check for duplicate education posts today
SELECT 
    DATE(CreatedAt) as Date,
    COUNT(*) as PostCount,
    GROUP_CONCAT(TIME(CreatedAt)) as PostTimes
FROM education_logs_table
WHERE UserId = 300 
    AND DATE(CreatedAt) = '2025-12-29'
    AND IsDeleted = 0
GROUP BY DATE(CreatedAt);

-- Check all education posts for User 300 YESTERDAY (Dec 28, 2025)
SELECT 
    Id,
    UserId,
    Platform,
    Topic,
    CreatedAt,
    TIME(CreatedAt) as PostTime,
    CASE 
        WHEN TIME(CreatedAt) BETWEEN '07:15:00' AND '08:45:00' THEN '✅ ON-TIME'
        ELSE '⚠️ LATE'
    END as Status,
    Confidence,
    IsDeleted
FROM education_logs_table
WHERE UserId = 300 
    AND DATE(CreatedAt) = '2025-12-28'
ORDER BY CreatedAt;

-- Count education posts per day for last 7 days
SELECT 
    DATE(CreatedAt) as Date,
    COUNT(*) as TotalPosts,
    SUM(CASE WHEN TIME(CreatedAt) BETWEEN '07:15:00' AND '08:45:00' THEN 1 ELSE 0 END) as OnTimePosts,
    SUM(CASE WHEN TIME(CreatedAt) NOT BETWEEN '07:15:00' AND '08:45:00' THEN 1 ELSE 0 END) as LatePosts,
    GROUP_CONCAT(TIME(CreatedAt) ORDER BY CreatedAt) as AllPostTimes
FROM education_logs_table
WHERE UserId = 300 
    AND DATE(CreatedAt) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
    AND IsDeleted = 0
GROUP BY DATE(CreatedAt)
ORDER BY Date DESC;

-- Check if there are any duplicate entries (same user, same timestamp)
SELECT 
    UserId,
    CreatedAt,
    COUNT(*) as DuplicateCount,
    GROUP_CONCAT(Id) as DuplicateIds
FROM education_logs_table
WHERE UserId = 300
    AND IsDeleted = 0
GROUP BY UserId, CreatedAt
HAVING COUNT(*) > 1;

-- Summary: Total education posts for User 300
SELECT 
    'Total Education Posts' as Metric,
    COUNT(*) as Value
FROM education_logs_table
WHERE UserId = 300 AND IsDeleted = 0

UNION ALL

SELECT 
    'Today (Dec 29)' as Metric,
    COUNT(*) as Value
FROM education_logs_table
WHERE UserId = 300 
    AND DATE(CreatedAt) = '2025-12-29' 
    AND IsDeleted = 0

UNION ALL

SELECT 
    'Yesterday (Dec 28)' as Metric,
    COUNT(*) as Value
FROM education_logs_table
WHERE UserId = 300 
    AND DATE(CreatedAt) = '2025-12-28' 
    AND IsDeleted = 0;
