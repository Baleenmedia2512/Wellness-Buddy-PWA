import { filterLogsByDay } from '../services/educationDashboardFormatter';
import { istToLocalDate } from '../../../shared/utils/timezoneUtils';

// Build a local Date whose Y/M/D matches how the log is displayed (its
// IST-local date). Deriving from the same conversion keeps the
// assertions stable regardless of the test runner's timezone.
const localDayOf = (createdAt) => {
  const d = istToLocalDate(createdAt);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

describe('filterLogsByDay', () => {
  const logA = { Id: 1, Platform: 'youtube', Topic: 'A', CreatedAt: '2026-06-10 12:00:00' };
  const logB = { Id: 2, Platform: 'youtube', Topic: 'B', CreatedAt: '2026-06-09 12:00:00' };
  const logs = [logA, logB];

  it('returns the full list unchanged when no date is provided', () => {
    expect(filterLogsByDay(logs, null)).toBe(logs);
  });

  it('keeps only logs whose IST-local day matches the selected date', () => {
    const result = filterLogsByDay(logs, localDayOf('2026-06-10 12:00:00'));
    expect(result).toEqual([logA]);
  });

  it('returns an empty array when no log falls on the selected day', () => {
    const result = filterLogsByDay(logs, localDayOf('2026-06-01 12:00:00'));
    expect(result).toEqual([]);
  });

  it('ignores logs without a CreatedAt timestamp', () => {
    const withBad = [...logs, { Id: 3, Platform: 'x', Topic: 'C', CreatedAt: null }];
    const result = filterLogsByDay(withBad, localDayOf('2026-06-10 12:00:00'));
    expect(result).toEqual([logA]);
  });

  it('handles a null/undefined list safely', () => {
    expect(filterLogsByDay(null, localDayOf('2026-06-10 12:00:00'))).toEqual([]);
    expect(filterLogsByDay(undefined, null)).toEqual([]);
  });
});
