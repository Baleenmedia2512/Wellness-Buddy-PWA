/**
 * Discipline Report Helper Functions
 * Common utilities for date parsing and calculations
 */

/**
 * Parse date range string to actual dates
 * ⚠️ CRITICAL FIX: Use IST timezone for date calculations since DB stores timestamps in IST
 */
export function parseDateRange(range, customStart, customEnd) {
  // Get current time in IST (UTC + 5:30)
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000; // 5 hours 30 minutes in milliseconds
  const istTime = new Date(now.getTime() + istOffset);
  
  // Extract IST date parts using UTC methods (since we've already added the offset)
  const year = istTime.getUTCFullYear();
  const month = istTime.getUTCMonth();
  const day = istTime.getUTCDate();
  
  // Create a date object representing today at midnight IST (using UTC to avoid timezone shifts)
  const today = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  
  console.log('📅 Date Range Calculation (IST):', {
    serverNow: now.toISOString(),
    istTime: istTime.toISOString(),
    todayIST: today.toISOString(),
    istDateParts: { year, month: month + 1, day },
    range
  });
  
  switch(range) {
    case 'today':
      return { start: today, end: today };
      
    case 'yesterday':
      const yesterday = new Date(today);
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      return { start: yesterday, end: yesterday };
      
    case 'last7days':
      const last7 = new Date(today);
      last7.setUTCDate(last7.getUTCDate() - 6);
      return { start: last7, end: today };
      
    case 'last10days':
      const last10 = new Date(today);
      last10.setUTCDate(last10.getUTCDate() - 9);
      return { start: last10, end: today };
      
    case 'last30days':
      const last30 = new Date(today);
      last30.setUTCDate(last30.getUTCDate() - 29);
      return { start: last30, end: today };
      
    case 'current_month':
      const monthStart = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
      return { start: monthStart, end: today };
      
    case 'custom':
      return { 
        start: new Date(customStart), 
        end: new Date(customEnd) 
      };
      
    default:
      const defaultStart = new Date(today);
      defaultStart.setUTCDate(defaultStart.getUTCDate() - 6);
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
