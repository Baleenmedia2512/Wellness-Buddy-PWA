/**
 * Timezone Conversion Utilities
 * Converts IST timestamps to user's local timezone for discipline checking
 */

/**
 * Convert IST timestamp to user's local time
 * @param {string} istTimestamp - Timestamp in IST format "YYYY-MM-DD HH:MM:SS"
 * @param {number} userTimezoneOffset - User's timezone offset in minutes (from Date.getTimezoneOffset())
 * @returns {string} Time in user's local timezone "HH:MM:SS"
 */
export function convertISTToUserLocalTime(istTimestamp, userTimezoneOffset) {
  if (!istTimestamp) return null;
  
  try {
    // Parse IST timestamp as if it were UTC (to avoid automatic conversion)
    // Format: "2026-03-10 15:55:00" or "2026-03-10T15:55:00"
    const cleanTimestamp = istTimestamp.replace(' ', 'T');
    
    // Create date object treating the timestamp as UTC
    const dateInUTC = new Date(cleanTimestamp + 'Z');
    
    // IST is UTC+5:30 (330 minutes ahead of UTC)
    const istOffsetMinutes = 330;
    
    // Convert to actual UTC by subtracting IST offset
    const actualUTC = new Date(dateInUTC.getTime() - (istOffsetMinutes * 60 * 1000));
    
    // Convert to user's local time by applying their timezone offset
    // Note: getTimezoneOffset() returns positive for west of UTC, negative for east
    const userLocalTime = new Date(actualUTC.getTime() - (userTimezoneOffset * 60 * 1000));
    
    // Extract time as HH:MM:SS
    const hours = String(userLocalTime.getUTCHours()).padStart(2, '0');
    const minutes = String(userLocalTime.getUTCMinutes()).padStart(2, '0');
    const seconds = String(userLocalTime.getUTCSeconds()).padStart(2, '0');
    
    return `${hours}:${minutes}:${seconds}`;
  } catch (error) {
    console.error('Error converting IST to user local time:', error);
    // Fallback: extract time directly from timestamp (assumes same timezone)
    const timeMatch = String(istTimestamp).match(/(\d{2}:\d{2}:\d{2})/);
    return timeMatch ? timeMatch[1] : null;
  }
}

/**
 * Get user's timezone offset in minutes
 * This should be sent from frontend: new Date().getTimezoneOffset()
 * @param {number} offsetMinutes - Timezone offset in minutes
 * @returns {string} Human readable timezone info
 */
export function getTimezoneInfo(offsetMinutes) {
  const hours = Math.abs(Math.floor(offsetMinutes / 60));
  const minutes = Math.abs(offsetMinutes % 60);
  const sign = offsetMinutes > 0 ? '-' : '+'; // getTimezoneOffset is opposite
  
  return `UTC${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}
