/**
 * Monthly marathon calendar (business YYYY-MM-DD in, no I/O).
 * Mirrors frontend/src/features/marathon/domain/marathonCalendar.js.
 */

export const MARATHON_START_DAYS_OF_MONTH = Object.freeze([1, 15]);
export const MARATHON_LAST_DAY_INDEX = 10;
export const DETOX_MARATHON_DAYS = Object.freeze([4, 9]);

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
    !Number.isInteger(year)
    || !Number.isInteger(month)
    || !Number.isInteger(day)
    || month < 1
    || month > 12
    || day < 1
    || day > 31
  ) {
    return null;
  }
  return { year, month, day };
}

/**
 * @param {unknown} ymd
 * @returns {typeof EMPTY_STATE & { marathonNumber: number|null, marathonDay: number|null }}
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
        showDetoxReminder: DETOX_MARATHON_DAYS.map((d) => d - 1).includes(marathonDay),
        showMarathonStartReminder: false,
      };
    }
  }

  return EMPTY_STATE;
}

/**
 * @param {unknown} ymd YYYY-MM-DD
 * @returns {{ currentDay0Ymd: string, previousDay10Ymd: string, marathonNumber: number }|null}
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
