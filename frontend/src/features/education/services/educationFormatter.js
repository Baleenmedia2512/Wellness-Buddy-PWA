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
export function formatLogDate(dateString, timezoneIana = DEFAULT_BUSINESS_TIMEZONE) {
  if (!dateString) return '';
  return formatUtcDate(dateString, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: timezoneIana,
  });
}

/** Short clock time used everywhere ("09:42 AM") in business TZ. */
export function formatLogTime(dateString, timezoneIana = DEFAULT_BUSINESS_TIMEZONE) {
  if (!dateString) return '';
  return formatBusinessTime(dateString, timezoneIana, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Full timestamp for share/log card rows in business TZ. */
export function formatLoggedAtFull(loggedAt, timezoneIana = DEFAULT_BUSINESS_TIMEZONE) {
  if (!loggedAt) return '';
  const dateStr = formatUtcDate(loggedAt, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: timezoneIana,
  });
  const timeStr = formatBusinessTime(loggedAt, timezoneIana, {
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

/**
 * Maps a diary timeline education or watch row to the log shape EducationCardModal expects.
 * Used when paginated education logs have not loaded the row yet.
 */
export function educationLogFromDiaryRow(diaryEntry) {
  const p = diaryEntry?.payload || {};
  if (p.id == null || p.id === '') return null;

  const kind = diaryEntry?.kind;
  const topic = p.topic
    || (kind === 'watch' && p.kcal != null ? `Calories Burned: ${p.kcal} kcal` : null)
    || (kind === 'watch' ? 'Calories Burned: 0 kcal' : 'Education');

  return {
    Id: p.id,
    Topic: topic,
    Platform: p.platform || (kind === 'watch' ? 'Smartwatch' : 'Online Meeting'),
    Confidence: p.confidence ?? null,
    ImageBase64: p.imageBase64 ?? null,
    CreatedAt: diaryEntry.capturedAt ?? null,
  };
}
