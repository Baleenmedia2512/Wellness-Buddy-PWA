/**
 * Discipline Report Helper Functions
 * Common utilities for date parsing and calculations
 */

/**
 * Parse date range string to actual dates
 */
export function parseDateRange(range, customStart, customEnd) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  switch(range) {
    case 'today':
      return { start: today, end: today };
      
    case 'yesterday':
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return { start: yesterday, end: yesterday };
      
    case 'last7days':
      const last7 = new Date(today);
      last7.setDate(last7.getDate() - 6);
      return { start: last7, end: today };
      
    case 'last30days':
      const last30 = new Date(today);
      last30.setDate(last30.getDate() - 29);
      return { start: last30, end: today };
      
    case 'current_month':
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: monthStart, end: today };
      
    case 'custom':
      return { 
        start: new Date(customStart), 
        end: new Date(customEnd) 
      };
      
    default:
      const defaultStart = new Date(today);
      defaultStart.setDate(defaultStart.getDate() - 6);
      return { start: defaultStart, end: today };
  }
}

/**
 * Calculate expected posts for a date range
 */
export function calculateExpectedPosts(startDate, endDate) {
  const oneDay = 24 * 60 * 60 * 1000;
  const days = Math.round(Math.abs((endDate - startDate) / oneDay)) + 1;
  const activitiesPerDay = 5; // Weight, Education, Breakfast, Lunch, Dinner
  return days * activitiesPerDay;
}

/**
 * Format date for MySQL query (YYYY-MM-DD)
 * Uses local timezone to avoid UTC conversion issues
 */
export function formatDateForMySQL(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calculate discipline percentage
 */
export function calculateDisciplinePercentage(onTimePosts, expectedPosts) {
  if (expectedPosts === 0) return 0;
  return Math.round((onTimePosts / expectedPosts) * 1000) / 10; // Round to 1 decimal
}

/**
 * Get days between two dates (inclusive)
 */
export function getDaysBetween(startDate, endDate) {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round(Math.abs((endDate - startDate) / oneDay)) + 1;
}
