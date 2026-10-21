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
 * Timestamp shown on BCM list / share / form.
 * Prefer create/session time — Override or metric edits stamp `updatedAt` to now,
 * but the card Date should stay the counselling session time unless createdAt is missing.
 * @param {{ updatedAt?: string|null, createdAt?: string|null }|null|undefined} card
 * @returns {string|null}
 */
export function resolveBcmCardDisplayTimestamp(card) {
  if (!card || typeof card !== 'object') return null;
  return card.createdAt || card.updatedAt || null;
}

/**
 * Share-card Date row: `YYYY-MM-DD h:mm AM/PM` in viewer timezone.
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
    return `${ymd} ${formatBcm12HourTime(instant, tz)}`;
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
 * 12-hour clock: `1:35 PM`
 * @param {Date} instant
 * @param {string} timezoneIana
 * @returns {string}
 */
function formatBcm12HourTime(instant, timezoneIana) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezoneIana,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(instant);
  const get = (type) => parts.find((p) => p.type === type)?.value || '';
  return `${get('hour')}:${get('minute')} ${get('dayPeriod')}`;
}

/**
 * List tile Date line: `d MMM yyyy h:mm AM/PM` in viewer timezone.
 * @param {{ recordedDate?: string|null, createdAt?: string|null }} card
 * @param {string} [timezoneIana]
 * @returns {string}
 */
export function formatBcmListCardDateTime(card, timezoneIana = DEFAULT_BUSINESS_TIMEZONE) {
  const tz = resolveBusinessTimezone(timezoneIana);
  const instant = parseUtcTimestamp(resolveBcmCardDisplayTimestamp(card));
  if (instant) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).formatToParts(instant);
    const get = (type) => parts.find((p) => p.type === type)?.value || '';
    return `${get('day')} ${get('month')} ${get('year')} ${formatBcm12HourTime(instant, tz)}`;
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

/**
 * HH:mm in viewer timezone — for the create/edit form Time field.
 * @param {string|null|undefined} createdAt
 * @param {string} [timezoneIana]
 * @param {Date} [now]
 * @returns {string}
 */
export function formatBcmFormTime(
  createdAt,
  timezoneIana = DEFAULT_BUSINESS_TIMEZONE,
  now = new Date(),
) {
  const tz = resolveBusinessTimezone(timezoneIana);
  const instant = parseUtcTimestamp(createdAt) || now;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(instant);
  const get = (type) => parts.find((p) => p.type === type)?.value || '00';
  return `${get('hour')}:${get('minute')}`;
}

/**
 * Interpret YYYY-MM-DD + HH:mm as wall clock in timezoneIana → UTC ISO.
 * @param {string|null|undefined} ymd
 * @param {string|null|undefined} hm
 * @param {string} [timezoneIana]
 * @param {Date} [fallbackNow]
 * @returns {string}
 */
export function bcmWallClockToIso(
  ymd,
  hm,
  timezoneIana = DEFAULT_BUSINESS_TIMEZONE,
  fallbackNow = new Date(),
) {
  const datePart = String(ymd || '').trim().slice(0, 10);
  const timePart = String(hm || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart) || !/^\d{1,2}:\d{2}$/.test(timePart)) {
    return fallbackNow.toISOString();
  }
  const [y, mo, d] = datePart.split('-').map(Number);
  const [hhRaw, mi] = timePart.split(':').map(Number);
  const hh = hhRaw;
  const tz = resolveBusinessTimezone(timezoneIana);

  let utcMs = Date.UTC(y, mo - 1, d, hh, mi, 0);
  for (let i = 0; i < 3; i += 1) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date(utcMs));
    const get = (type) => Number(parts.find((p) => p.type === type)?.value || 0);
    const gotY = get('year');
    const gotM = get('month');
    const gotD = get('day');
    let gotH = get('hour');
    if (gotH === 24) gotH = 0;
    const gotMi = get('minute');
    const wanted = Date.UTC(y, mo - 1, d, hh, mi);
    const got = Date.UTC(gotY, gotM - 1, gotD, gotH, gotMi);
    const diff = wanted - got;
    if (diff === 0) break;
    utcMs += diff;
  }
  return new Date(utcMs).toISOString();
}

/**
 * Compute the default appointment date based on a BCM card creation date.
 * - Default: next day (+1 day)
 * - Sunday rule: if the next day falls on Sunday, roll forward to Monday (+2 days)
 *
 * @param {string|Date|null|undefined} baseDate
 * @returns {string} YYYY-MM-DD
 */
export function computeDefaultAppointmentDate(baseDate) {
  if (!baseDate) return '';
  let y;
  let m;
  let d;
  if (typeof baseDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(baseDate)) {
    const parts = baseDate.substring(0, 10).split('-');
    y = parseInt(parts[0], 10);
    m = parseInt(parts[1], 10) - 1;
    d = parseInt(parts[2], 10);
  } else {
    const dt = baseDate instanceof Date ? baseDate : new Date(baseDate);
    if (Number.isNaN(dt.getTime())) return '';
    y = dt.getFullYear();
    m = dt.getMonth();
    d = dt.getDate();
  }

  // Next day (+1 day)
  const target = new Date(y, m, d + 1);
  // Sunday is 0: if target day falls on Sunday, roll forward to Monday (+1 more day)
  if (target.getDay() === 0) {
    target.setDate(target.getDate() + 1);
  }

  const resY = target.getFullYear();
  const resM = String(target.getMonth() + 1).padStart(2, '0');
  const resD = String(target.getDate()).padStart(2, '0');
  return `${resY}-${resM}-${resD}`;
}

/**
 * Resolve the appointment date for a BCM card.
 * Priority:
 * 1. card.appointmentDate or card.appointment_date if present.
 * 2. Fall back to computing default appointment date from card.createdAt / card.created_at / card.recordedDate / card.recorded_date.
 * 3. Default to next day (+1 day, or +2 days for Sunday->Monday) from today.
 *
 * @param {object|null|undefined} card
 * @returns {string} YYYY-MM-DD
 */
export function resolveBcmCardAppointmentDate(card) {
  if (!card || typeof card !== 'object') return '';
  const direct = card.appointmentDate || card.appointment_date;
  if (direct && typeof direct === 'string') {
    const trimmed = direct.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      return trimmed.slice(0, 10);
    }
    const d = new Date(trimmed);
    if (!Number.isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
  }
  const base = card.createdAt || card.created_at || card.recordedDate || card.recorded_date;
  return computeDefaultAppointmentDate(base || new Date());
}
