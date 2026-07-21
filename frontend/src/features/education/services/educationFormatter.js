/**
 * educationFormatter.js — pure helpers for the education slice.
 * No React, no fetch. Date/string formatting and small parsers only.
 */
import { formatUtcDate, formatUtcTime, formatUtcDateTime } from '../../../shared/utils/datetimeUtils';

/** Long-form date used in the detail modal ("May 13, 2026"). */
export function formatLogDate(dateString) {
  if (!dateString) return '';
  return formatUtcDate(dateString, {
    month: 'long', day: 'numeric', year: 'numeric',
  });
}

/** Short clock time used everywhere ("09:42 AM"). */
export function formatLogTime(dateString) {
  if (!dateString) return '';
  return formatUtcTime(dateString, { hour: '2-digit', minute: '2-digit' });
}

/** Full UTC timestamp for share/log card rows. */
export function formatLoggedAtFull(loggedAt) {
  if (!loggedAt) return '';
  return formatUtcDateTime(loggedAt, {
    month: 'short', day: 'numeric', year: 'numeric',
  }, {
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

/** Normalises a raw image string (or `null`) into a usable `<img src>`. */
export function resolveImageSrc(raw) {
  if (!raw) return null;
  return raw.startsWith('data:') ? raw : `data:image/jpeg;base64,${raw}`;
}

/** True when the topic is a smartwatch "Calories Burned: …" entry. */
export function isCaloriesBurnedTopic(topic) {
  return Boolean(topic && topic.toLowerCase().startsWith('calories burned:'));
}

/** Extracts the numeric portion from a "Calories Burned: …" topic string. */
export function extractCaloriesValue(topic) {
  if (!isCaloriesBurnedTopic(topic)) return '';
  return topic.replace(/^calories burned:\s*/i, '');
}
