import {
  parseDailyState,
  incrementDailyState,
  serializeDailyState,
  isFirstCaptureOfDay,
  getTodayIST,
} from '../domain/daily-capture.rules.js';

describe('daily-capture.rules', () => {
  const TODAY = '2026-01-15';

  describe('parseDailyState', () => {
    it('returns zero count when raw is null', () => {
      expect(parseDailyState(null, TODAY)).toEqual({ date: TODAY, count: 0 });
    });

    it('returns stored count when date matches today', () => {
      const raw = JSON.stringify({ date: TODAY, count: 3 });
      expect(parseDailyState(raw, TODAY)).toEqual({ date: TODAY, count: 3 });
    });

    it('resets to zero when stored date differs from today', () => {
      const raw = JSON.stringify({ date: '2026-01-14', count: 5 });
      expect(parseDailyState(raw, TODAY)).toEqual({ date: TODAY, count: 0 });
    });

    it('resets to zero on malformed JSON', () => {
      expect(parseDailyState('{broken', TODAY)).toEqual({ date: TODAY, count: 0 });
    });

    it('resets to zero when stored count is not a number', () => {
      const raw = JSON.stringify({ date: TODAY, count: 'many' });
      expect(parseDailyState(raw, TODAY)).toEqual({ date: TODAY, count: 0 });
    });
  });

  describe('incrementDailyState', () => {
    it('increments count by 1', () => {
      const result = incrementDailyState({ date: TODAY, count: 2 });
      expect(result).toEqual({ date: TODAY, count: 3 });
    });

    it('does not mutate the original state', () => {
      const original = { date: TODAY, count: 2 };
      incrementDailyState(original);
      expect(original.count).toBe(2);
    });
  });

  describe('serializeDailyState', () => {
    it('round-trips through parseDailyState', () => {
      const state = { date: TODAY, count: 4 };
      const serialized = serializeDailyState(state);
      expect(parseDailyState(serialized, TODAY)).toEqual(state);
    });
  });

  describe('isFirstCaptureOfDay', () => {
    it('returns true when count is 0', () => {
      expect(isFirstCaptureOfDay({ date: TODAY, count: 0 })).toBe(true);
    });

    it('returns false when count is 1 or more', () => {
      expect(isFirstCaptureOfDay({ date: TODAY, count: 1 })).toBe(false);
      expect(isFirstCaptureOfDay({ date: TODAY, count: 99 })).toBe(false);
    });
  });

  describe('getTodayIST', () => {
    it('returns a YYYY-MM-DD string', () => {
      const result = getTodayIST(new Date('2026-06-15T10:00:00Z'));
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('accounts for the IST +5:30 offset', () => {
      // 2026-01-14 UTC 22:00 → 2026-01-15 IST 03:30
      const result = getTodayIST(new Date('2026-01-14T22:00:00Z'));
      expect(result).toBe('2026-01-15');
    });
  });
});
