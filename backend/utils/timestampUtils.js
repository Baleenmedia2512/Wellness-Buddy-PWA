/**
 * Timestamp Utility Functions
 * Functions for normalizing and handling timestamps from different sources
 */

/**
 * Normalize timestamp to ISO string format
 * Handles various timestamp formats from database
 * @param {string|Date} timestamp - Timestamp to normalize
 * @returns {string} ISO formatted timestamp string (YYYY-MM-DDTHH:mm:ss.sssZ)
 */
export function normalizeTimestamp(timestamp) {
  if (!timestamp) {
    return new Date().toISOString();
  }
  
  // If already a Date object, convert to ISO
  if (timestamp instanceof Date) {
    return timestamp.toISOString();
  }
  
  // If string, parse and convert to ISO
  if (typeof timestamp === 'string') {
    const date = new Date(timestamp);
    return date.toISOString();
  }
  
  // Fallback: return current time
  return new Date().toISOString();
}

/**
 * Extract date portion from timestamp (YYYY-MM-DD)
 * @param {string|Date} timestamp - Timestamp
 * @returns {string} Date in YYYY-MM-DD format
 */
export function extractDate(timestamp) {
  const normalized = normalizeTimestamp(timestamp);
  return normalized.split('T')[0];
}

/**
 * Check if timestamp is valid
 * @param {string|Date} timestamp - Timestamp to validate
 * @returns {boolean} True if valid
 */
export function isValidTimestamp(timestamp) {
  if (!timestamp) return false;
  
  const date = new Date(timestamp);
  return !isNaN(date.getTime());
}
