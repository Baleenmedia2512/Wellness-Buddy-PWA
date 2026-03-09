/**
 * Timezone Utility Functions
 *
 * Database stores all timestamps in IST (Indian Standard Time, UTC+5:30)
 * These utilities convert IST timestamps to user's local timezone for display
 */

/**
 * Convert IST timestamp string to user's local Date object
 * @param {string} istTimestamp - Timestamp string in IST (e.g., "2026-03-06 14:00:00" or "2026-03-06T14:00:00")
 * @returns {Date} Date object in user's local timezone, or null if invalid
 *
 * ⚠️ DST Handling: This function correctly handles Daylight Saving Time (DST) transitions.
 * The browser's Date object automatically adjusts for DST in the user's timezone.
 * Note: India (IST) does not observe DST, so database timestamps remain stable.
 */
export function istToLocalDate(istTimestamp) {
  if (!istTimestamp) return null;

  // Normalize to string and remove timezone markers
  const cleanTimestamp = String(istTimestamp)
    .replace("Z", "")
    .replace("T", " ")
    .trim();

  // ✅ Validate timestamp format: YYYY-MM-DD HH:MM:SS
  // This prevents parsing errors from malformed data
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(cleanTimestamp)) {
    console.warn("[timezoneUtils] Invalid timestamp format:", istTimestamp);
    return null;
  }

  // Parse the IST timestamp (format: "2026-03-06 14:00:00")
  // Create a date treating it as UTC first
  const parsedDate = new Date(cleanTimestamp + "Z"); // Add Z to treat as UTC during parsing

  // Check if date is valid
  if (isNaN(parsedDate.getTime())) {
    console.warn("[timezoneUtils] Failed to parse timestamp:", istTimestamp);
    return null;
  }

  // IST is UTC+5:30, so subtract 5.5 hours to get actual UTC time
  const istOffsetMs = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
  const utcTime = parsedDate.getTime() - istOffsetMs;

  // Create a new Date object with the corrected UTC time
  // Browser will automatically handle conversion to user's local timezone
  // This includes automatic DST adjustments
  return new Date(utcTime);
}

/**
 * Format IST timestamp to user's local date string
 * @param {string} istTimestamp - Timestamp string in IST
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string in user's local timezone
 */
export function formatISTToLocalDate(istTimestamp, options = {}) {
  const localDate = istToLocalDate(istTimestamp);
  if (!localDate) return "";

  const defaultOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...options,
  };

  return localDate.toLocaleDateString("en-US", defaultOptions);
}

/**
 * Format IST timestamp to user's local time string
 * @param {string} istTimestamp - Timestamp string in IST
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted time string in user's local timezone
 */
export function formatISTToLocalTime(istTimestamp, options = {}) {
  const localDate = istToLocalDate(istTimestamp);
  if (!localDate) return "";

  const defaultOptions = {
    hour: "2-digit",
    minute: "2-digit",
    ...options,
  };

  return localDate.toLocaleTimeString("en-US", defaultOptions);
}

/**
 * Format IST timestamp to user's local date and time string
 * @param {string} istTimestamp - Timestamp string in IST
 * @param {object} dateOptions - Date format options
 * @param {object} timeOptions - Time format options
 * @returns {string} Formatted date and time string
 */
export function formatISTToLocalDateTime(
  istTimestamp,
  dateOptions = {},
  timeOptions = {},
) {
  const localDate = istToLocalDate(istTimestamp);
  if (!localDate) return "";

  const defaultDateOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...dateOptions,
  };

  const defaultTimeOptions = {
    hour: "2-digit",
    minute: "2-digit",
    ...timeOptions,
  };

  const dateStr = localDate.toLocaleDateString("en-US", defaultDateOptions);
  const timeStr = localDate.toLocaleTimeString("en-US", defaultTimeOptions);

  return `${dateStr} at ${timeStr}`;
}

/**
 * Get relative time description (e.g., "2 hours ago", "Yesterday")
 * @param {string} istTimestamp - Timestamp string in IST
 * @returns {string} Relative time description
 */
export function getRelativeTime(istTimestamp) {
  const localDate = istToLocalDate(istTimestamp);
  if (!localDate) return "";

  const now = new Date();
  const diffMs = now - localDate;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "Just now";
  if (diffMins < 60)
    return `${diffMins} minute${diffMins !== 1 ? "s" : ""} ago`;
  if (diffHours < 24)
    return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;

  // For older dates, return formatted date
  return formatISTToLocalDate(istTimestamp);
}

/**
 * Check if IST timestamp is today in user's local timezone
 * @param {string} istTimestamp - Timestamp string in IST
 * @returns {boolean} True if timestamp is today
 */
export function isToday(istTimestamp) {
  const localDate = istToLocalDate(istTimestamp);
  if (!localDate) return false;

  const today = new Date();
  return (
    localDate.getDate() === today.getDate() &&
    localDate.getMonth() === today.getMonth() &&
    localDate.getFullYear() === today.getFullYear()
  );
}

/**
 * Format Date object as YYYY-MM-DD string in local timezone
 * @param {Date} date - Date object to format
 * @returns {string} Date string in YYYY-MM-DD format
 *
 * ⚠️ Important: Use this instead of toISOString().split('T')[0] to avoid timezone shifting
 * toISOString() converts to UTC which can shift the date by +/- 1 day for users in timezones
 * with large UTC offsets (e.g., Asia/Pacific regions)
 *
 * @example
 * const date = new Date(); // March 9, 2026 at 11:30 PM JST
 * formatLocalDateString(date); // "2026-03-09" (correct)
 * date.toISOString().split('T')[0]; // "2026-03-10" (wrong - shifted to next day)
 */
export function formatLocalDateString(date) {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    console.warn(
      "[timezoneUtils] Invalid date provided to formatLocalDateString:",
      date,
    );
    return "";
  }

  return (
    date.getFullYear() +
    "-" +
    String(date.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(date.getDate()).padStart(2, "0")
  );
}

/**
 * Example usage:
 *
 * // Database returns: "2026-03-06 14:00:00" (IST)
 * const timestamp = "2026-03-06 14:00:00";
 *
 * // Convert to local Date object
 * const localDate = istToLocalDate(timestamp);
 *
 * // Format for display
 * formatISTToLocalDate(timestamp) // "Mar 6, 2026"
 * formatISTToLocalTime(timestamp) // "3:30 AM" (for Virginia user)
 * formatISTToLocalDateTime(timestamp) // "Mar 6, 2026 at 3:30 AM"
 * getRelativeTime(timestamp) // "2 hours ago"
 *
 * // Format Date for API calls (timezone-safe)
 * const today = new Date();
 * formatLocalDateString(today) // "2026-03-09" (always in local timezone)
 * // ❌ DON'T USE: today.toISOString().split('T')[0] (can shift dates!)
 */
