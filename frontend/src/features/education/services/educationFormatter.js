/**
 * educationFormatter.js — pure helpers for the education slice.
 * No React, no fetch. Date/string formatting and small parsers only.
 */
import {
  formatUtcDate,
  formatBusinessTime,
  DEFAULT_BUSINESS_TIMEZONE,
} from '../../../shared/utils/datetimeUtils';

/** Long-form date used in the detail modal ("May 13, 2026") in business TZ. */
export function formatLogDate(dateString) {
  if (!dateString) return '';
  return formatUtcDate(dateString, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: DEFAULT_BUSINESS_TIMEZONE,
  });
}

/** Short clock time used everywhere ("09:42 AM") in business TZ. */
export function formatLogTime(dateString) {
  if (!dateString) return '';
  return formatBusinessTime(dateString, DEFAULT_BUSINESS_TIMEZONE, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Full timestamp for share/log card rows in business TZ. */
export function formatLoggedAtFull(loggedAt) {
  if (!loggedAt) return '';
  const dateStr = formatUtcDate(loggedAt, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: DEFAULT_BUSINESS_TIMEZONE,
  });
  const timeStr = formatBusinessTime(loggedAt, DEFAULT_BUSINESS_TIMEZONE, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return timeStr ? `${dateStr} at ${timeStr}` : dateStr;
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
