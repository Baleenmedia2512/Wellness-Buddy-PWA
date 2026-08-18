/**
 * Monthly marathon calendar (IST business date in, no I/O).
 *
 * Two marathons every month: start on calendar day 1 and day 15.
 * Each runs Day 0 (start) through Day 10 (last day).
 * Home reminders fire one calendar day before:
 *   - Day 0 → "Tomorrow is Marathon Day 0"
 *   - Day 1 → "Tomorrow is Marathon Day 1" (shown on Day 0)
 *   - Detox Days 4 and 9 → "Tomorrow is Detox Day"
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

/** User-facing label for Marathon Day 0 (eve-of-start reminder). */
export const MARATHON_START_REMINDER_TITLE = 'Tomorrow is Marathon Day 0';
export const MARATHON_START_REMINDER_SUBTITLE = 'Prepare for Marathon Day 0 tomorrow.';

/** User-facing label for Marathon Day 1 (shown on Day 0). */
export const MARATHON_DAY_1_REMINDER_TITLE = 'Tomorrow is Marathon Day 1';
export const MARATHON_DAY_1_REMINDER_SUBTITLE = 'Prepare for Marathon Day 1 tomorrow.';

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
  showMarathonStartReminder: false,
  showDay1Reminder: false,
});

/**
 * @param {unknown} ymd
 * @returns {{ year: number, month: number, day: number }|null}
 */
function parseYmdParts(ymd) {
  if (typeof ymd !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const year = Number.parseInt(ymd.slice(0, 4), 10);
  const month = Number.parseInt(ymd.slice(5, 7), 10);
  const day = Number.parseInt(ymd.slice(8, 10), 10);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }
  return { year, month, day };
}

/**
 * Days in a calendar month (UTC math — business YYYY-MM-DD has no TZ).
 * @param {number} year
 * @param {number} month 1–12
 * @returns {number}
 */
function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getDate();
}

/**
 * Eve of Marathon Day 0: day before each start day-of-month.
 * Start on the 1st → last day of previous month; start on the 15th → the 14th.
 *
 * @param {{ year: number, month: number, day: number }} parts
 * @returns {{ marathonNumber: number }|null}
 */
function getMarathonStartReminderMeta(parts) {
  const { year, month, day } = parts;
  for (let i = 0; i < MARATHON_START_DAYS_OF_MONTH.length; i += 1) {
    const startDay = MARATHON_START_DAYS_OF_MONTH[i];
    if (startDay === 1) {
      if (day === daysInMonth(year, month)) {
        return { marathonNumber: i + 1 };
      }
    } else if (day === startDay - 1) {
      return { marathonNumber: i + 1 };
    }
  }
  return null;
}

/**
 * @typedef {object} MarathonCalendarState
 * @property {boolean} inMarathon
 * @property {number|null} marathonNumber 1 or 2 when in a marathon (or eve of start)
 * @property {number|null} marathonDay 0–10 when in a marathon
 * @property {boolean} isDetoxDay
 * @property {boolean} showDetoxReminder
 * @property {boolean} showMarathonStartReminder
 * @property {boolean} showDay1Reminder
 */

/**
 * Resolve marathon position from a business-calendar YYYY-MM-DD.
 * Applies automatically every month; start days are rules, not specific dates.
 *
 * @param {unknown} ymd
 * @returns {MarathonCalendarState}
 */
export function getMarathonCalendarState(ymd) {
  const parts = parseYmdParts(ymd);
  if (parts == null) return EMPTY_STATE;

  const { day: dayOfMonth } = parts;

  for (let i = 0; i < MARATHON_START_DAYS_OF_MONTH.length; i += 1) {
    const marathonDay = dayOfMonth - MARATHON_START_DAYS_OF_MONTH[i];
    if (marathonDay >= 0 && marathonDay <= MARATHON_LAST_DAY_INDEX) {
      return {
        inMarathon: true,
        marathonNumber: i + 1,
        marathonDay,
        isDetoxDay: DETOX_MARATHON_DAYS.includes(marathonDay),
        showDetoxReminder: DETOX_REMINDER_MARATHON_DAYS.includes(marathonDay),
        showMarathonStartReminder: false,
        showDay1Reminder: marathonDay === 0,
      };
    }
  }

  const startReminder = getMarathonStartReminderMeta(parts);
  if (startReminder) {
    return {
      inMarathon: false,
      marathonNumber: startReminder.marathonNumber,
      marathonDay: null,
      isDetoxDay: false,
      showDetoxReminder: false,
      showMarathonStartReminder: true,
      showDay1Reminder: false,
    };
  }

  return EMPTY_STATE;
}

/**
 * Home-screen copy for tomorrow's Detox Day, Marathon Day 0, or Day 1.
 * Returns null on every other day (including Detox Days / Day 1 themselves).
 *
 * @param {unknown} ymd YYYY-MM-DD
 * @returns {{ title: string, subtitle: string, marathonDay: number|null, marathonNumber: number, kind: 'detox'|'marathon-start'|'day-1' }|null}
 */
export function getDetoxReminder(ymd) {
  const state = getMarathonCalendarState(ymd);

  if (state.showMarathonStartReminder) {
    return {
      title: MARATHON_START_REMINDER_TITLE,
      subtitle: MARATHON_START_REMINDER_SUBTITLE,
      marathonDay: null,
      marathonNumber: state.marathonNumber,
      kind: 'marathon-start',
    };
  }

  if (state.showDay1Reminder) {
    return {
      title: MARATHON_DAY_1_REMINDER_TITLE,
      subtitle: MARATHON_DAY_1_REMINDER_SUBTITLE,
      marathonDay: 0,
      marathonNumber: state.marathonNumber,
      kind: 'day-1',
    };
  }

  if (!state.showDetoxReminder) return null;
  return {
    title: DETOX_REMINDER_TITLE,
    subtitle: DETOX_REMINDER_SUBTITLE,
    marathonDay: state.marathonDay,
    marathonNumber: state.marathonNumber,
    kind: 'detox',
  };
}
