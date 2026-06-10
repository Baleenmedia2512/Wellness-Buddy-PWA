import { filterHistoryByDay } from '../services/weightDashboardFormatter';
import { istToLocalDate } from '../../../shared/utils/timezoneUtils';

// Build a local Date whose Y/M/D matches how the entry is displayed
// (its IST-local date). Deriving from the same conversion keeps the
// assertions stable regardless of the test runner's timezone.
const localDayOf = (createdAt) => {
  const d = istToLocalDate(createdAt);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

describe('filterHistoryByDay', () => {
  const entryA = { ID: 1, Weight: 70.0, CreatedAt: '2026-06-10 12:00:00' };
  const entryB = { ID: 2, Weight: 71.5, CreatedAt: '2026-06-09 12:00:00' };
  const history = [entryA, entryB];

  it('returns the full list unchanged when no date is provided', () => {
    expect(filterHistoryByDay(history, null)).toBe(history);
  });

  it('keeps only entries whose IST-local day matches the selected date', () => {
    const result = filterHistoryByDay(history, localDayOf('2026-06-10 12:00:00'));
    expect(result).toEqual([entryA]);
  });

  it('returns an empty array when no entry falls on the selected day', () => {
    const result = filterHistoryByDay(history, localDayOf('2026-06-01 12:00:00'));
    expect(result).toEqual([]);
  });

  it('ignores entries without a CreatedAt timestamp', () => {
    const withBad = [...history, { ID: 3, Weight: 69, CreatedAt: null }];
    const result = filterHistoryByDay(withBad, localDayOf('2026-06-10 12:00:00'));
    expect(result).toEqual([entryA]);
  });

  it('handles a null/undefined history safely', () => {
    expect(filterHistoryByDay(null, localDayOf('2026-06-10 12:00:00'))).toEqual([]);
    expect(filterHistoryByDay(undefined, null)).toEqual([]);
  });
});
