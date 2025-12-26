/**
 * Core Discipline Calculation Functions
 * Calculates discipline percentages from activity data
 */

import { formatDateForMySQL, getDaysBetween } from './disciplineHelpers.js';

/**
 * Calculate discipline for a single team member
 * @param {Object} connection - MySQL connection
 * @param {number} userId - User ID
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Object} Discipline data for all activities
 */
export async function calculateMemberDiscipline(connection, userId, startDate, endDate) {
  const startDateStr = formatDateForMySQL(startDate);
  const endDateStr = formatDateForMySQL(endDate);
  
  // Query 1: Weight posts
  const [weightRows] = await connection.execute(`
    SELECT 
      COUNT(*) as totalPosts,
      COUNT(CASE 
        WHEN TIME(w.CreatedAt) BETWEEN tw.WindowStartTime AND tw.WindowEndTime 
        THEN 1 
      END) as onTimePosts
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
  const [educationRows] = await connection.execute(`
    SELECT 
      COUNT(*) as totalPosts,
      COUNT(CASE 
        WHEN TIME(e.CreatedAt) BETWEEN tw.WindowStartTime AND tw.WindowEndTime 
        THEN 1 
      END) as onTimePosts
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
  // Note: food_nutrition_data_table.UserID is VARCHAR, must cast to UNSIGNED
  const [mealRows] = await connection.execute(`
    SELECT 
      CASE
        WHEN TIME(f.CreatedAt) BETWEEN '05:30:00' AND '08:30:00' THEN 'breakfast'
        WHEN TIME(f.CreatedAt) BETWEEN '12:00:00' AND '16:00:00' THEN 'lunch'
        WHEN TIME(f.CreatedAt) BETWEEN '17:30:00' AND '20:30:00' THEN 'dinner'
      END as MealType,
      COUNT(*) as totalPosts,
      COUNT(CASE 
        WHEN TIME(f.CreatedAt) BETWEEN tw.WindowStartTime AND tw.WindowEndTime 
        THEN 1 
      END) as onTimePosts
    FROM food_nutrition_data_table f
    LEFT JOIN activity_time_windows_table tw ON (
      tw.ActivityType = CASE
        WHEN TIME(f.CreatedAt) BETWEEN '05:30:00' AND '08:30:00' THEN 'breakfast'
        WHEN TIME(f.CreatedAt) BETWEEN '12:00:00' AND '16:00:00' THEN 'lunch'
        WHEN TIME(f.CreatedAt) BETWEEN '17:30:00' AND '20:30:00' THEN 'dinner'
      END
      AND f.CreatedAt >= tw.EffectiveFromDate
      AND (f.CreatedAt < tw.EffectiveToDate OR tw.EffectiveToDate IS NULL)
    )
    WHERE CAST(f.UserID AS UNSIGNED) = ?
      AND DATE(f.CreatedAt) BETWEEN ? AND ?
      AND f.IsDeleted = 0
      AND TIME(f.CreatedAt) BETWEEN '05:30:00' AND '20:30:00'
    GROUP BY MealType
  `, [userId, startDateStr, endDateStr]);
  
  // Organize meal data
  const mealData = {
    breakfast: { totalPosts: 0, onTimePosts: 0 },
    lunch: { totalPosts: 0, onTimePosts: 0 },
    dinner: { totalPosts: 0, onTimePosts: 0 }
  };
  
  mealRows.forEach(row => {
    if (row.MealType) {
      mealData[row.MealType] = {
        totalPosts: row.totalPosts,
        onTimePosts: row.onTimePosts
      };
    }
  });
  
  // Calculate expected posts per activity
  const daysInPeriod = getDaysBetween(startDate, endDate);
  const expectedPostsPerActivity = daysInPeriod;
  
  // Return structured data
  return {
    weight: {
      totalPosts: weightRows[0].totalPosts,
      onTimePosts: weightRows[0].onTimePosts,
      expectedPosts: expectedPostsPerActivity
    },
    education: {
      totalPosts: educationRows[0].totalPosts,
      onTimePosts: educationRows[0].onTimePosts,
      expectedPosts: expectedPostsPerActivity
    },
    breakfast: {
      ...mealData.breakfast,
      expectedPosts: expectedPostsPerActivity
    },
    lunch: {
      ...mealData.lunch,
      expectedPosts: expectedPostsPerActivity
    },
    dinner: {
      ...mealData.dinner,
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
  
  // Process all members
  for (const memberId of memberIds) {
    try {
      const disciplineData = await calculateMemberDiscipline(
        connection, 
        memberId, 
        startDate, 
        endDate
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
