/**
 * Discipline Report Helper Functions
 * Common utilities for date parsing and calculations
 */

/**
 * Calculate expected posts for a date range
 */
export function calculateExpectedPosts(startDate, endDate) {
  const oneDay = 24 * 60 * 60 * 1000;
  const days = Math.round(Math.abs((endDate - startDate) / oneDay)) + 1;
  const activitiesPerDay = 7; // Weight, Education, Breakfast, Lunch, Dinner, Water Intake, Calories Burned
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
