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
 * @param {{ year: number, month: number }} parts
 * @returns {string}
 */
function previousMarathonDay10FromMonthStart(parts) {
  const { year, month } = parts;
  if (month === 1) return formatYmdParts(year - 1, 12, 25);
  return formatYmdParts(year, month - 1, 25);
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
  if (!state.inMarathon || state.marathonDay !== 0) return null;

  const parts = parseYmdParts(ymd);
  if (parts == null) return null;

  const previousDay10Ymd = state.marathonNumber === 1
    ? previousMarathonDay10FromMonthStart(parts)
    : formatYmdParts(parts.year, parts.month, 11);

  return {
    currentDay0Ymd: ymd,
    previousDay10Ymd,
    marathonNumber: state.marathonNumber,
  };
}
