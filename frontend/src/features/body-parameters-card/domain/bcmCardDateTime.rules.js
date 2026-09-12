/**
 * bcmCardDateTime.rules.js — BCM card date+time display in the viewer's timezone.
 * India → Asia/Kolkata; USA → device/profile America/*; else profile/device IANA.
 */
import {
  DEFAULT_BUSINESS_TIMEZONE,
  parseUtcTimestamp,
  resolveBusinessTimezone,
} from '../../../shared/utils/datetimeUtils.js';
import { getDeviceTimezoneIana } from '../../../shared/utils/deviceTimezone.js';

/**
 * @param {unknown} [userOrTimezone]
 * @returns {string} IANA timezone
 */
export function resolveBcmDisplayTimezone(userOrTimezone) {
  if (typeof userOrTimezone === 'string' && userOrTimezone.trim()) {
    return resolveBusinessTimezone(userOrTimezone);
  }
  if (userOrTimezone && typeof userOrTimezone === 'object') {
    const fromProfile =
      userOrTimezone.timezoneIana
      || userOrTimezone.timezone
      || userOrTimezone.Timezone
      || null;
    if (fromProfile) return resolveBusinessTimezone(fromProfile);
  }
  const device = getDeviceTimezoneIana();
  if (device) return device;
  return DEFAULT_BUSINESS_TIMEZONE;
}

/**
 * Share-card Date row: `YYYY-MM-DD HH:mm` in viewer timezone.
 * @param {string|null|undefined} recordedDate
 * @param {string|null|undefined} createdAt
 * @param {string} [timezoneIana]
 * @returns {string}
 */
export function formatBcmShareCardDateTime(
  recordedDate,
  createdAt,
  timezoneIana = DEFAULT_BUSINESS_TIMEZONE,
) {
  const tz = resolveBusinessTimezone(timezoneIana);
  const instant = parseUtcTimestamp(createdAt);
  if (instant) {
    const ymd = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(instant);
    const hm = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(instant);
    return `${ymd} ${hm}`;
  }
  if (!recordedDate) return '—';
  const str = String(recordedDate);
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  if (/^\d{8}$/.test(str)) {
    return `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}`;
  }
  return str;
}

/**
 * List tile Date line: `d MMM yyyy HH:mm` in viewer timezone.
 * @param {{ recordedDate?: string|null, createdAt?: string|null }} card
 * @param {string} [timezoneIana]
 * @returns {string}
 */
export function formatBcmListCardDateTime(card, timezoneIana = DEFAULT_BUSINESS_TIMEZONE) {
  const tz = resolveBusinessTimezone(timezoneIana);
  const instant = parseUtcTimestamp(card?.createdAt);
  if (instant) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(instant);
    const get = (type) => parts.find((p) => p.type === type)?.value || '';
    return `${get('day')} ${get('month')} ${get('year')} ${get('hour')}:${get('minute')}`;
  }
  if (!card?.recordedDate) return 'N/A';
  const d = parseUtcTimestamp(card.recordedDate) || new Date(card.recordedDate);
  if (Number.isNaN(d.getTime())) return 'N/A';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).formatToParts(d);
  const get = (type) => parts.find((p) => p.type === type)?.value || '';
  return `${get('day')} ${get('month')} ${get('year')}`;
}
