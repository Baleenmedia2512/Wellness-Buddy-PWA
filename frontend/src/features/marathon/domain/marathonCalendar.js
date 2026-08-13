/**
 * Monthly marathon calendar (IST business date in, no I/O).
 *
 * Two marathons every month: start on calendar day 1 and day 15.
 * Each runs Day 0 (start) through Day 10 (last day).
 * Detox Days are marathon Days 4 and 9; the Home reminder is the day before.
 */

/** Calendar day-of-month (1-indexed) when each monthly marathon starts. */
export const MARATHON_START_DAYS_OF_MONTH = Object.freeze([1, 15]);

/** Inclusive last marathon day index. Day 0 + this value = 11 calendar days. */
export const MARATHON_LAST_DAY_INDEX = 10;

/** Marathon day indexes that are Detox Days. */
export const DETOX_MARATHON_DAYS = Object.freeze([4, 9]);

/** One calendar day before each Detox Day. */
export const DETOX_REMINDER_MARATHON_DAYS = Object.freeze(
  DETOX_MARATHON_DAYS.map((day) => day - 1),
);

export const DETOX_REMINDER_TITLE = 'Tomorrow is Detox Day';
export const DETOX_REMINDER_SUBTITLE = 'Prepare for your Detox Day tomorrow.';

/** DevTools override: `localStorage.setItem('marathon.testDate', 'YYYY-MM-DD')` then refresh. */
export const MARATHON_TEST_DATE_STORAGE_KEY = 'marathon.testDate';

/**
 * Prefer a valid YYYY-MM-DD test override, otherwise the live business date.
 * @param {unknown} liveToday
 * @param {unknown} storedYmd
 * @returns {unknown}
 */
export function resolveMarathonToday(liveToday, storedYmd) {
  if (typeof storedYmd === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(storedYmd)) {
    return storedYmd;
  }
  return liveToday;
}

const EMPTY_STATE = Object.freeze({
  inMarathon: false,
  marathonNumber: null,
  marathonDay: null,
  isDetoxDay: false,
  showDetoxReminder: false,
});

/**
 * @param {unknown} ymd
 * @returns {number|null} Day of month 1–31
 */
function parseDayOfMonth(ymd) {
  if (typeof ymd !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const day = Number.parseInt(ymd.slice(8, 10), 10);
  if (!Number.isInteger(day) || day < 1 || day > 31) return null;
  return day;
}

/**
 * @typedef {object} MarathonCalendarState
 * @property {boolean} inMarathon
 * @property {number|null} marathonNumber 1 or 2 when in a marathon
 * @property {number|null} marathonDay 0–10 when in a marathon
 * @property {boolean} isDetoxDay
 * @property {boolean} showDetoxReminder
 */

/**
 * Resolve marathon position from a business-calendar YYYY-MM-DD.
 * Applies automatically every month; start days are rules, not specific dates.
 *
 * @param {unknown} ymd
 * @returns {MarathonCalendarState}
 */
export function getMarathonCalendarState(ymd) {
  const dayOfMonth = parseDayOfMonth(ymd);
  if (dayOfMonth == null) return EMPTY_STATE;

  for (let i = 0; i < MARATHON_START_DAYS_OF_MONTH.length; i += 1) {
    const marathonDay = dayOfMonth - MARATHON_START_DAYS_OF_MONTH[i];
    if (marathonDay >= 0 && marathonDay <= MARATHON_LAST_DAY_INDEX) {
      return {
        inMarathon: true,
        marathonNumber: i + 1,
        marathonDay,
        isDetoxDay: DETOX_MARATHON_DAYS.includes(marathonDay),
        showDetoxReminder: DETOX_REMINDER_MARATHON_DAYS.includes(marathonDay),
      };
    }
  }

  return EMPTY_STATE;
}

/**
 * Home-screen copy when the user should be reminded that tomorrow is Detox Day.
 * Returns null on every other day (including Detox Days themselves).
 *
 * @param {unknown} ymd YYYY-MM-DD
 * @returns {{ title: string, subtitle: string, marathonDay: number, marathonNumber: number }|null}
 */
export function getDetoxReminder(ymd) {
  const state = getMarathonCalendarState(ymd);
  if (!state.showDetoxReminder) return null;
  return {
    title: DETOX_REMINDER_TITLE,
    subtitle: DETOX_REMINDER_SUBTITLE,
    marathonDay: state.marathonDay,
    marathonNumber: state.marathonNumber,
  };
}
