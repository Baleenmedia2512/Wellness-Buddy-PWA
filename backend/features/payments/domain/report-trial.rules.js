/**
 * Report detail access. Pure: no clock and no database.
 * The trial is 14 India calendar days, and the start date is day 1.
 * Apps older than 3.5.5, and requests with no version, keep the full report.
 */
import { isAtLeastVersion } from '../../app-version/domain/version.rules.js';
import { timestampToCalendarYmd, IANA_IST } from '../../../shared/lib/datetime/datetime.js';

export const REPORT_TRIAL_LENGTH_DAYS = 14;
/** First app version whose report payloads hide unpaid detail. */
export const REPORT_DETAILS_MIN_VERSION = '3.5.5';

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * @param {unknown} ymd
 * @returns {number|null} UTC midnight millis for that civil date
 */
function civilDayUtc(ymd) {
  const match = YMD.exec(String(ymd || '').trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = Date.UTC(year, month - 1, day);
  const check = new Date(utc);
  if (
    check.getUTCFullYear() !== year
    || check.getUTCMonth() !== month - 1
    || check.getUTCDate() !== day
  ) {
    return null;
  }
  return utc;
}

/**
 * Whole India dates from the start date to today. Same day is 0.
 * @param {unknown} startYmd
 * @param {unknown} todayYmd
 * @returns {number|null}
 */
export function calendarDaysBetween(startYmd, todayYmd) {
  const start = civilDayUtc(startYmd);
  const today = civilDayUtc(todayYmd);
  if (start == null || today == null) return null;
  return Math.round((today - start) / 86400000);
}

/**
 * @param {unknown} startYmd India date the trial started
 * @param {unknown} todayYmd India date now
 * @returns {{ active: boolean, daysLeft: number, ended: boolean }}
 */
export function reportTrialWindow(startYmd, todayYmd) {
  const elapsed = calendarDaysBetween(startYmd, todayYmd);
  if (elapsed == null) return { active: false, daysLeft: 0, ended: false };
  if (elapsed < 0) {
    return { active: true, daysLeft: REPORT_TRIAL_LENGTH_DAYS, ended: false };
  }
  if (elapsed >= REPORT_TRIAL_LENGTH_DAYS) {
    return { active: false, daysLeft: 0, ended: true };
  }
  return {
    active: true,
    daysLeft: REPORT_TRIAL_LENGTH_DAYS - elapsed,
    ended: false,
  };
}

/**
 * @param {{ premium?: boolean, startYmd?: string|null, todayYmd?: string|null }} input
 * @returns {{ access: 'premium'|'trial'|'ended'|'none', daysLeft: number|null }}
 */
export function resolveReportAccess({ premium = false, startYmd = null, todayYmd = null } = {}) {
  if (premium) return { access: 'premium', daysLeft: null };
  if (!startYmd) return { access: 'none', daysLeft: null };
  const window = reportTrialWindow(startYmd, todayYmd);
  if (window.active) return { access: 'trial', daysLeft: window.daysLeft };
  if (window.ended) return { access: 'ended', daysLeft: 0 };
  return { access: 'none', daysLeft: null };
}

/**
 * @param {unknown} access
 * @returns {boolean}
 */
export function canSeeReportDetails(access) {
  return access === 'premium' || access === 'trial';
}

/**
 * Gate only the new app. Missing and older versions stay on the full report.
 * The flag is a kill switch: off means nobody is gated.
 * @param {{ flagEnabled?: boolean, appVersion?: string|null }} input
 * @returns {boolean}
 */
export function shouldGateReportDetails({ flagEnabled = false, appVersion = null } = {}) {
  if (!flagEnabled) return false;
  return isAtLeastVersion(appVersion, REPORT_DETAILS_MIN_VERSION) === true;
}

/**
 * This table is written with UTC_TIMESTAMP(), so a zone-less value is UTC.
 * @param {unknown} value
 * @returns {string|null}
 */
export function trialStartToUtcIso(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw)) return raw;
  const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
  return `${normalized}Z`;
}

/**
 * @param {unknown} value
 * @returns {string|null} YYYY-MM-DD in India
 */
export function trialStartIstYmd(value) {
  const iso = trialStartToUtcIso(value);
  if (!iso) return null;
  try {
    return timestampToCalendarYmd(iso, IANA_IST);
  } catch {
    return null;
  }
}
