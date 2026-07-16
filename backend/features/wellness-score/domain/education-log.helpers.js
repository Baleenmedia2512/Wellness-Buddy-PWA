/**
 * education-log.helpers.js — distinguish education vs smartwatch rows in education_logs_table.
 *
 * Both types share education_logs_table. Exercise/smartwatch rows use Platform values like
 * "Apple Watch", "Fitbit", "Smartwatch" and Topic like "Calories Burned: 200 kcal".
 * Education rows use platforms like "Zoom", "Google Meet", "In-person".
 */

const SMARTWATCH_TOPIC_PREFIX = 'calories burned:';

/** Platforms used by education manual entry (EducationFormFields). */
const EDUCATION_PLATFORMS = new Set([
  'zoom',
  'microsoft teams',
  'google meet',
  'in-person',
  'online meeting',
]);

/** Platforms used by smartwatch / fitness screenshot flows. */
const EXERCISE_PLATFORMS = new Set([
  'smartwatch',
  'fitbit',
  'apple watch',
  'samsung galaxy watch',
  'mi band / xiaomi',
  'mi band',
  'garmin',
  'google fit',
  'samsung health',
]);

const EXERCISE_PLATFORM_PATTERN = /watch|fitbit|garmin|mi band|samsung health|google fit/i;

function normalizePlatform(platform) {
  return String(platform || '').trim().toLowerCase();
}

function normalizeTopic(topic) {
  return String(topic || '').trim().toLowerCase();
}

/**
 * @param {{ Topic?: string|null, Platform?: string|null }} row
 * @returns {boolean}
 */
export function isSmartwatchEducationLogRow(row) {
  const topic = normalizeTopic(row?.Topic);
  const platform = normalizePlatform(row?.Platform);

  if (topic.startsWith(SMARTWATCH_TOPIC_PREFIX)) return true;
  if (EXERCISE_PLATFORMS.has(platform)) return true;
  if (platform && EXERCISE_PLATFORM_PATTERN.test(platform)) return true;

  return false;
}

/**
 * @param {{ Topic?: string|null, Platform?: string|null }} row
 * @returns {boolean}
 */
export function isEducationLogRow(row) {
  if (!row) return false;
  if (isSmartwatchEducationLogRow(row)) return false;

  const topic = String(row?.Topic || '').trim();
  const platform = normalizePlatform(row?.Platform);

  if (!topic && !platform) return false;

  if (EDUCATION_PLATFORMS.has(platform)) return true;

  // "Other" is shared — only education when topic is not exercise-style.
  if (platform === 'other') {
    return Boolean(topic) && !normalizeTopic(topic).startsWith(SMARTWATCH_TOPIC_PREFIX);
  }

  // Legacy / unknown platform: count as education only when topic is present and not exercise.
  if (topic) return true;

  return false;
}

/**
 * @param {Array<{ Topic?: string|null, Platform?: string|null, CreatedAt?: string }>|null|undefined} rows
 * @returns {Array<{ Topic?: string|null, Platform?: string|null, CreatedAt?: string }>}
 */
export function filterEducationLogsOnly(rows) {
  return (rows || []).filter(isEducationLogRow);
}
