/**
 * Monthly marathon calendar (IST business date in, no I/O).
 *
 * Two marathons every month: start on calendar day 1 and day 15.
 * Each runs Day 0 (start) through Day 10 (last day).
 * Home reminders fire one calendar day before:
 *   - Day 0 → "Tomorrow is Marathon Day 0"
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
});

/**
 * @param {number} year
 * @param {number} month 1–12
 * @param {number} day 1–31
 * @returns {string}
 */
function formatYmdParts(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Calendar day-of-month for Marathon N Day 10 (last day of that marathon).
 * @param {number} marathonNumber 1 or 2
 * @returns {number}
 */
function marathonEndCalendarDay(marathonNumber) {
  const startDay = MARATHON_START_DAYS_OF_MONTH[marathonNumber - 1];
  return startDay + MARATHON_LAST_DAY_INDEX;
}

/**
 * Previous marathon end date for Marathon 1 (Day 10 of prior month's Marathon 1).
 * @param {{ year: number, month: number }} parts
 * @returns {string}
 */
function previousMarathon1EndYmd(parts) {
  const endDay = marathonEndCalendarDay(1);
  const { year, month } = parts;
  if (month === 1) return formatYmdParts(year - 1, 12, endDay);
  return formatYmdParts(year, month - 1, endDay);
}

/**
 * Previous marathon end date for Marathon 2 (Day 10 of same month's Marathon 2).
 * @param {{ year: number, month: number }} parts
 * @returns {string}
 */
function previousMarathon2EndYmd(parts) {
  const endDay = marathonEndCalendarDay(2);
  return formatYmdParts(parts.year, parts.month, endDay);
}

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
    };
  }

  return EMPTY_STATE;
}

/**
 * Home-screen copy for tomorrow's Detox Day or Marathon Day 0.
 * Returns null on every other day (including Detox Days / Day 0 themselves).
 *
 * @param {unknown} ymd YYYY-MM-DD
 * @returns {{ title: string, subtitle: string, marathonDay: number|null, marathonNumber: number, kind: 'detox'|'marathon-start' }|null}
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

  if (!state.showDetoxReminder) return null;
  return {
    title: DETOX_REMINDER_TITLE,
    subtitle: DETOX_REMINDER_SUBTITLE,
    marathonDay: state.marathonDay,
    marathonNumber: state.marathonNumber,
    kind: 'detox',
  };
}

/**
 * @typedef {object} MarathonWeightComparisonDates
 * @property {string} currentDay0Ymd YYYY-MM-DD for the current marathon Day 0
 * @property {string} previousDay10Ymd YYYY-MM-DD for the previous marathon Day 10
 * @property {number} marathonNumber 1 or 2 for the current marathon
 */

/**
 * Resolve calendar dates for marathon weight comparison during the active marathon.
 * Returns null outside Day 0–10 or in the gap between monthly marathons.
 *
 * Marathon 1 (starts 1st): previous end = prior month Day 10 (11th).
 * Marathon 2 (starts 15th): previous end = same month Day 10 (25th).
 *
 * @param {unknown} ymd YYYY-MM-DD
 * @returns {MarathonWeightComparisonDates|null}
 */
export function getMarathonWeightComparisonDates(ymd) {
  const state = getMarathonCalendarState(ymd);
  if (!state.inMarathon || state.marathonDay == null) return null;

  const parts = parseYmdParts(ymd);
  if (parts == null) return null;

  const startDay = MARATHON_START_DAYS_OF_MONTH[state.marathonNumber - 1];
  const currentDay0Ymd = formatYmdParts(parts.year, parts.month, startDay);
  const previousDay10Ymd = state.marathonNumber === 1
    ? previousMarathon1EndYmd(parts)
    : previousMarathon2EndYmd(parts);

  return {
    currentDay0Ymd,
    previousDay10Ymd,
    marathonNumber: state.marathonNumber,
  };
}

/**
 * Add whole calendar days to a YYYY-MM-DD (UTC date math).
 * @param {unknown} ymd
 * @param {number} deltaDays
 * @returns {string}
 */
export function addCalendarDaysYmd(ymd, deltaDays) {
  if (typeof ymd !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return '';
  if (!Number.isInteger(deltaDays)) return '';
  const year = Number.parseInt(ymd.slice(0, 4), 10);
  const month = Number.parseInt(ymd.slice(5, 7), 10);
  const day = Number.parseInt(ymd.slice(8, 10), 10);
  const utc = new Date(Date.UTC(year, month - 1, day + deltaDays));
  return utc.toISOString().slice(0, 10);
}

/**
 * YYYY-MM-DD for each marathon day index from Day 0 through Day 10.
 * @param {unknown} currentDay0Ymd
 * @returns {string[]}
 */
export function listMarathonDayYmds(currentDay0Ymd) {
  if (typeof currentDay0Ymd !== 'string' || !currentDay0Ymd) return [];
  return Array.from({ length: MARATHON_LAST_DAY_INDEX + 1 }, (_, day) => (
    addCalendarDaysYmd(currentDay0Ymd, day)
  ));
}

/**
 * Gap-day marathon weight anchors (not in an active marathon window).
 * @param {unknown} ymd YYYY-MM-DD
 * @returns {{ previousDay10Ymd: string, upcomingDay0Ymd: string, upcomingMarathonNumber: number }|null}
 */
export function getMarathonGapComparisonDates(ymd) {
  const state = getMarathonCalendarState(ymd);
  if (state.inMarathon) return null;

  const parts = parseYmdParts(ymd);
  if (parts == null) return null;

  const { year, month, day: dayOfMonth } = parts;

  if (state.showMarathonStartReminder) {
    const tomorrowYmd = addCalendarDaysYmd(ymd, 1);
    const tomorrowState = getMarathonCalendarState(tomorrowYmd);
    const tomorrowParts = parseYmdParts(tomorrowYmd);
    if (
      tomorrowState.inMarathon
      && tomorrowState.marathonDay === 0
      && tomorrowParts != null
      && tomorrowState.marathonNumber != null
    ) {
      const previousDay10Ymd = tomorrowState.marathonNumber === 1
        ? previousMarathon1EndYmd(tomorrowParts)
        : previousMarathon2EndYmd(tomorrowParts);
      return {
        previousDay10Ymd,
        upcomingDay0Ymd: tomorrowYmd,
        upcomingMarathonNumber: tomorrowState.marathonNumber,
      };
    }
    return null;
  }

  if (dayOfMonth >= 12 && dayOfMonth <= 14) {
    return {
      previousDay10Ymd: previousMarathon2EndYmd(parts),
      upcomingDay0Ymd: formatYmdParts(year, month, MARATHON_START_DAYS_OF_MONTH[1]),
      upcomingMarathonNumber: 2,
    };
  }

  if (dayOfMonth >= 26) {
    let nextMonth = month + 1;
    let nextYear = year;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear += 1;
    }
    const upcomingParts = { year: nextYear, month: nextMonth };
    return {
      previousDay10Ymd: previousMarathon1EndYmd(upcomingParts),
      upcomingDay0Ymd: formatYmdParts(nextYear, nextMonth, MARATHON_START_DAYS_OF_MONTH[0]),
      upcomingMarathonNumber: 1,
    };
  }

  return null;
}
