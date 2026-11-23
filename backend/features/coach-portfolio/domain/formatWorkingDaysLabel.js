/**
 * Compact working-days label for public portfolio Contact hours.
 * e.g. Mon - Fri, or Mon, Wed, Fri
 */

const DAY_ORDER = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

const DAY_SHORT = {
  Monday: 'Mon',
  Tuesday: 'Tue',
  Wednesday: 'Wed',
  Thursday: 'Thu',
  Friday: 'Fri',
  Saturday: 'Sat',
  Sunday: 'Sun',
};

/**
 * @param {string[]} [workingDays]
 * @returns {string}
 */
export function formatWorkingDaysLabel(workingDays = []) {
  const selected = DAY_ORDER.filter((d) => (workingDays || []).includes(d));
  if (!selected.length) return '';
  if (selected.length === 1) return DAY_SHORT[selected[0]];

  const indexes = selected.map((d) => DAY_ORDER.indexOf(d));
  let contiguous = true;
  for (let i = 1; i < indexes.length; i += 1) {
    if (indexes[i] !== indexes[i - 1] + 1) {
      contiguous = false;
      break;
    }
  }
  if (contiguous) {
    return `${DAY_SHORT[selected[0]]} - ${DAY_SHORT[selected[selected.length - 1]]}`;
  }
  return selected.map((d) => DAY_SHORT[d]).join(', ');
}
