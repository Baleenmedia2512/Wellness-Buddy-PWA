import { getDateRangeBounds, formatLocalDate } from '../dateRangeUtils';

/** Helper: build a midnight-normalised date N days from today */
const daysAgo = (n) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
};

describe('getDateRangeBounds', () => {
  test('"today" returns from === to === today midnight', () => {
    const { from, to } = getDateRangeBounds('today');
    const today = daysAgo(0);
    expect(from).toEqual(today);
    expect(to).toEqual(today);
  });

  test('"yesterday" returns from === to === yesterday midnight', () => {
    const { from, to } = getDateRangeBounds('yesterday');
    const yesterday = daysAgo(1);
    expect(from).toEqual(yesterday);
    expect(to).toEqual(yesterday);
  });

  test('"week" spans from 6 days ago to today', () => {
    const { from, to } = getDateRangeBounds('week');
    expect(from).toEqual(daysAgo(6));
    expect(to).toEqual(daysAgo(0));
  });

  test('"month" spans from 29 days ago to today', () => {
    const { from, to } = getDateRangeBounds('month');
    expect(from).toEqual(daysAgo(29));
    expect(to).toEqual(daysAgo(0));
  });

  test('"all" returns null from and to', () => {
    const { from, to } = getDateRangeBounds('all');
    expect(from).toBeNull();
    expect(to).toBeNull();
  });

  test('"custom" with both dates passes them through unchanged', () => {
    const start = new Date('2025-01-01');
    const end = new Date('2025-01-31');
    const { from, to } = getDateRangeBounds('custom', start, end);
    expect(from).toBe(start);
    expect(to).toBe(end);
  });

  test('"custom" with missing dates falls back to null/null', () => {
    const { from, to } = getDateRangeBounds('custom', null, null);
    expect(from).toBeNull();
    expect(to).toBeNull();
  });

  test('unknown time range returns null/null', () => {
    const { from, to } = getDateRangeBounds('unknown_value');
    expect(from).toBeNull();
    expect(to).toBeNull();
  });
});

describe('formatLocalDate', () => {
  test('formats a date as YYYY-MM-DD', () => {
    expect(formatLocalDate(new Date(2025, 0, 5))).toBe('2025-01-05');
  });

  test('returns null for falsy input', () => {
    expect(formatLocalDate(null)).toBeNull();
    expect(formatLocalDate(undefined)).toBeNull();
  });
});
