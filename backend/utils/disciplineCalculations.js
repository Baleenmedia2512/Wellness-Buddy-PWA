/**
 * Core Discipline Calculation Functions
 * Calculates discipline percentages from activity data
 */

import { formatDateForMySQL, getDaysBetween } from './disciplineHelpers.js';
import { isExemptedBeverageOnly } from './foodTypeDetection.js';

/**
 * Calculate discipline for a single team member
 * @param {Object} connection - MySQL connection
 * @param {number} userId - User ID
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @param {Object} mealWindows - Pre-fetched meal time windows {breakfast, lunch, dinner}
 * @returns {Object} Discipline data for all activities
 */
export async function calculateMemberDiscipline(connection, userId, startDate, endDate, mealWindows = null) {
  const startDateStr = formatDateForMySQL(startDate);
  const endDateStr = formatDateForMySQL(endDate);
  
  // Use provided meal windows or fetch if not provided (backward compatibility)
  let breakfastWindow, lunchWindow, dinnerWindow;
  
  if (mealWindows) {
    // Use pre-fetched windows (optimized path)
    breakfastWindow = mealWindows.breakfast || { start: '05:30:00', end: '08:30:00' };
    lunchWindow = mealWindows.lunch || { start: '12:00:00', end: '16:00:00' };
    dinnerWindow = mealWindows.dinner || { start: '17:30:00', end: '20:30:00' };
  } else {
    // Fetch windows (legacy path for backward compatibility)
    const [timeWindows] = await connection.execute(`
      SELECT ActivityType, WindowStartTime, WindowEndTime
      FROM activity_time_windows_table
      WHERE EffectiveToDate IS NULL
        AND ActivityType IN ('breakfast', 'lunch', 'dinner')
    `);
    
    const mealWindowsMap = {};
    timeWindows.forEach(tw => {
      mealWindowsMap[tw.ActivityType] = {
        start: tw.WindowStartTime,
        end: tw.WindowEndTime
      };
    });
    
    breakfastWindow = mealWindowsMap.breakfast || { start: '05:30:00', end: '08:30:00' };
    lunchWindow = mealWindowsMap.lunch || { start: '12:00:00', end: '16:00:00' };
    dinnerWindow = mealWindowsMap.dinner || { start: '17:30:00', end: '20:30:00' };
  }
  
  // Query 1: Weight posts
  // Count distinct DAYS with at least one on-time post (not total posts)
  const [weightRows] = await connection.execute(`
    SELECT 
      COUNT(DISTINCT DATE(w.CreatedAt)) as daysWithPosts,
      COUNT(DISTINCT CASE 
        WHEN TIME(w.CreatedAt) BETWEEN tw.WindowStartTime AND tw.WindowEndTime 
        THEN DATE(w.CreatedAt)
      END) as daysWithOnTimePosts
    FROM weight_records_table w
    LEFT JOIN activity_time_windows_table tw ON (
      tw.ActivityType = 'weight'
      AND w.CreatedAt >= tw.EffectiveFromDate
      AND (w.CreatedAt < tw.EffectiveToDate OR tw.EffectiveToDate IS NULL)
    )
    WHERE w.UserId = ?
      AND DATE(w.CreatedAt) BETWEEN ? AND ?
      AND w.IsDeleted = 0
  `, [userId, startDateStr, endDateStr]);
  
  // Query 2: Education posts
  // Count distinct DAYS with at least one on-time post (not total posts)
  const [educationRows] = await connection.execute(`
    SELECT 
      COUNT(DISTINCT DATE(e.CreatedAt)) as daysWithPosts,
      COUNT(DISTINCT CASE 
        WHEN TIME(e.CreatedAt) BETWEEN tw.WindowStartTime AND tw.WindowEndTime 
        THEN DATE(e.CreatedAt)
      END) as daysWithOnTimePosts
    FROM education_logs_table e
    LEFT JOIN activity_time_windows_table tw ON (
      tw.ActivityType = 'education'
      AND e.CreatedAt >= tw.EffectiveFromDate
      AND (e.CreatedAt < tw.EffectiveToDate OR tw.EffectiveToDate IS NULL)
    )
    WHERE e.UserId = ?
      AND DATE(e.CreatedAt) BETWEEN ? AND ?
      AND e.IsDeleted = 0
  `, [userId, startDateStr, endDateStr]);
  
  // Query 3: Meal posts (breakfast, lunch, dinner)
  // Fetch individual records with AnalysisData to filter out beverage-only entries
  // Note: food_nutrition_data_table.UserID is VARCHAR, must cast to UNSIGNED
  const [mealRecords] = await connection.execute(`
    SELECT f.CreatedAt, f.AnalysisData
    FROM food_nutrition_data_table f
    WHERE CAST(f.UserID AS UNSIGNED) = ?
      AND DATE(f.CreatedAt) BETWEEN ? AND ?
      AND f.IsDeleted = 0
      AND (
        TIME(f.CreatedAt) BETWEEN ? AND ?
        OR TIME(f.CreatedAt) BETWEEN ? AND ?
        OR TIME(f.CreatedAt) BETWEEN ? AND ?
      )
  `, [
    userId,
    startDateStr, endDateStr,
    breakfastWindow.start, breakfastWindow.end,
    lunchWindow.start, lunchWindow.end,
    dinnerWindow.start, dinnerWindow.end
  ]);
  
  // Organize meal data — filter out records that contain ONLY exempted beverages
  const mealData = {
    breakfast: { daysWithPosts: 0, daysWithOnTimePosts: 0 },
    lunch: { daysWithPosts: 0, daysWithOnTimePosts: 0 },
    dinner: { daysWithPosts: 0, daysWithOnTimePosts: 0 }
  };
  
  const mealDates = {
    breakfast: new Set(),
    lunch: new Set(),
    dinner: new Set()
  };
  
  (mealRecords || []).forEach(row => {
    // Skip beverage-only entries (water, coffee, tea, afresh, etc.)
    if (isExemptedBeverageOnly(row.AnalysisData)) return;
    
    const timeMatch = String(row.CreatedAt).match(/(\d{2}:\d{2}:\d{2})/);
    if (!timeMatch) return;
    const time = timeMatch[1];
    const date = String(row.CreatedAt).split('T')[0] || new Date(row.CreatedAt).toISOString().split('T')[0];
    
    let mealType = null;
    if (time >= breakfastWindow.start && time <= breakfastWindow.end) mealType = 'breakfast';
    else if (time >= lunchWindow.start && time <= lunchWindow.end) mealType = 'lunch';
    else if (time >= dinnerWindow.start && time <= dinnerWindow.end) mealType = 'dinner';
    
    if (mealType) {
      mealDates[mealType].add(date);
    }
  });
  
  mealData.breakfast = { daysWithPosts: mealDates.breakfast.size, daysWithOnTimePosts: mealDates.breakfast.size };
  mealData.lunch = { daysWithPosts: mealDates.lunch.size, daysWithOnTimePosts: mealDates.lunch.size };
  mealData.dinner = { daysWithPosts: mealDates.dinner.size, daysWithOnTimePosts: mealDates.dinner.size };
  
  // Calculate expected posts per activity
  const daysInPeriod = getDaysBetween(startDate, endDate);
  const expectedPostsPerActivity = daysInPeriod;
  
  // Return structured data (using daysWithOnTimePosts as onTimePosts for backward compatibility)
  return {
    weight: {
      totalPosts: weightRows[0].daysWithPosts,
      onTimePosts: weightRows[0].daysWithOnTimePosts,
      expectedPosts: expectedPostsPerActivity
    },
    education: {
      totalPosts: educationRows[0].daysWithPosts,
      onTimePosts: educationRows[0].daysWithOnTimePosts,
      expectedPosts: expectedPostsPerActivity
    },
    breakfast: {
      ...mealData.breakfast,
      totalPosts: mealData.breakfast.daysWithPosts,
      onTimePosts: mealData.breakfast.daysWithOnTimePosts,
      expectedPosts: expectedPostsPerActivity
    },
    lunch: {
      ...mealData.lunch,
      totalPosts: mealData.lunch.daysWithPosts,
      onTimePosts: mealData.lunch.daysWithOnTimePosts,
      expectedPosts: expectedPostsPerActivity
    },
    dinner: {
      ...mealData.dinner,
      totalPosts: mealData.dinner.daysWithPosts,
      onTimePosts: mealData.dinner.daysWithOnTimePosts,
      expectedPosts: expectedPostsPerActivity
    }
  };
}

/**
 * Calculate discipline for entire team (batch processing)
 * @param {Object} connection - MySQL connection
 * @param {Array} memberIds - Array of user IDs
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Array} Discipline data for all members
 */
export async function calculateTeamDiscipline(connection, memberIds, startDate, endDate) {
  const results = [];
  
  // Fetch time windows ONCE for all members (optimization)
  const [timeWindows] = await connection.execute(`
    SELECT ActivityType, WindowStartTime, WindowEndTime
    FROM activity_time_windows_table
    WHERE EffectiveToDate IS NULL
      AND ActivityType IN ('breakfast', 'lunch', 'dinner')
  `);
  
  // Build meal windows map
  const mealWindows = {};
  timeWindows.forEach(tw => {
    mealWindows[tw.ActivityType] = {
      start: tw.WindowStartTime,
      end: tw.WindowEndTime
    };
  });
  
  // Process all members with pre-fetched time windows
  for (const memberId of memberIds) {
    try {
      const disciplineData = await calculateMemberDiscipline(
        connection, 
        memberId, 
        startDate, 
        endDate,
        mealWindows  // ← Pass pre-fetched windows
      );
      
      results.push({
        userId: memberId,
        ...disciplineData
      });
    } catch (error) {
      console.error(`❌ Error calculating discipline for user ${memberId}:`, error);
      // Continue with next member (don't break entire report)
    }
  }
  
  return results;
}
