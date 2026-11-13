/**
 * Premium is a 30 India-calendar-day plan. Pure: no clock and no database.
 * Access ends at the exact ExpiresAt instant when nowMs / expiresAtMs are provided.
 */

export const PREMIUM_PERIOD_DAYS = 30;
/** Home banner when this many days (or fewer) remain, including the expiry day. */
export const PREMIUM_EXPIRY_WARN_DAYS = 2;

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
 * Whole calendar days from `fromYmd` to `toYmd`. Same day is 0.
 * @param {unknown} fromYmd
 * @param {unknown} toYmd
 * @returns {number|null}
 */
export function premiumCalendarDaysBetween(fromYmd, toYmd) {
  const from = civilDayUtc(fromYmd);
  const to = civilDayUtc(toYmd);
  if (from == null || to == null) return null;
  return Math.round((to - from) / 86400000);
}

/**
 * @param {unknown} ymd
 * @param {number} days
 * @returns {string|null}
 */
export function addPremiumCalendarDays(ymd, days) {
  const start = civilDayUtc(ymd);
  if (start == null || !Number.isFinite(Number(days))) return null;
  const next = new Date(start + Number(days) * 86400000);
  const year = next.getUTCFullYear();
  const month = String(next.getUTCMonth() + 1).padStart(2, '0');
  const day = String(next.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * @param {unknown} value
 * @returns {number|null}
 */
function asFiniteMs(value) {
  if (value == null || value === '') return null;
  const ms = Number(value);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Extend from current expiry when still active (by instant if given); otherwise from today.
 * @param {{
 *   currentExpiresYmd?: string|null,
 *   currentExpiresMs?: number|null,
 *   nowMs?: number|null,
 *   todayYmd?: string|null,
 *   periodDays?: number,
 * }} input
 * @returns {string|null}
 */
export function computeExtendedExpiresYmd({
  currentExpiresYmd = null,
  currentExpiresMs = null,
  nowMs = null,
  todayYmd = null,
  periodDays = PREMIUM_PERIOD_DAYS,
} = {}) {
  const today = String(todayYmd || '').trim();
  if (!YMD.test(today)) return null;
  const current = String(currentExpiresYmd || '').trim();
  const expiresMs = asFiniteMs(currentExpiresMs);
  const now = asFiniteMs(nowMs);
  let stillActive = false;
  if (expiresMs != null && now != null) {
    stillActive = now <= expiresMs;
  } else {
    stillActive = YMD.test(current)
      && premiumCalendarDaysBetween(today, current) != null
      && premiumCalendarDaysBetween(today, current) >= 0;
  }
  const base = stillActive ? current : today;
  return addPremiumCalendarDays(base, periodDays);
}

/**
 * @param {{
 *   expiresAtYmd?: string|null,
 *   expiresAtMs?: number|null,
 *   nowMs?: number|null,
 *   todayYmd?: string|null,
 *   warnDays?: number,
 * }} input
 * @returns {{
 *   premium: boolean,
 *   daysLeft: number|null,
 *   expiresAt: string|null,
 *   showExpiryWarning: boolean,
 * }}
 */
export function resolvePremiumMembership({
  expiresAtYmd = null,
  expiresAtMs = null,
  nowMs = null,
  todayYmd = null,
  warnDays = PREMIUM_EXPIRY_WARN_DAYS,
} = {}) {
  const expiresAt = String(expiresAtYmd || '').trim();
  const today = String(todayYmd || '').trim();
  if (!YMD.test(expiresAt) || !YMD.test(today)) {
    return { premium: false, daysLeft: null, expiresAt: null, showExpiryWarning: false };
  }

  const daysLeft = premiumCalendarDaysBetween(today, expiresAt);
  const expiresMs = asFiniteMs(expiresAtMs);
  const now = asFiniteMs(nowMs);

  let premium;
  if (expiresMs != null && now != null) {
    premium = now <= expiresMs;
  } else {
    premium = daysLeft != null && daysLeft >= 0;
  }

  if (!premium) {
    return {
      premium: false,
      daysLeft: daysLeft != null && daysLeft >= 0 ? daysLeft : 0,
      expiresAt,
      showExpiryWarning: false,
    };
  }

  return {
    premium: true,
    daysLeft: daysLeft ?? 0,
    expiresAt,
    showExpiryWarning: (daysLeft ?? 0) <= warnDays,
  };
}

/**
 * Normalize a DB ExpiresAt value to an India calendar YMD via injected converter.
 * @param {unknown} value
 * @param {(value: unknown) => string|null} toYmd
 * @returns {string|null}
 */
export function premiumExpiresAtToYmd(value, toYmd) {
  if (value == null || value === '') return null;
  if (typeof toYmd !== 'function') return null;
  try {
    const ymd = toYmd(value);
    const text = String(ymd || '').trim();
    return YMD.test(text) ? text : null;
  } catch {
    return null;
  }
}
