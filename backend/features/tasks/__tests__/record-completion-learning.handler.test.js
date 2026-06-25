import {
  inferFoodTaskTypesFromTodayLogs,
} from '../api/record-completion-learning.handler.js';
import { buildServerIstTimestamp } from '../domain/completion-learning.rules.js';

const ACTIVITY_TIME_WINDOWS_MAP = {
  breakfast: { WindowStartTime: '05:30:00', WindowEndTime: '08:30:00' },
  lunch:     { WindowStartTime: '12:00:00', WindowEndTime: '16:00:00' },
  dinner:    { WindowStartTime: '17:30:00', WindowEndTime: '20:30:00' },
};

describe('buildServerIstTimestamp', () => {
  it('formats upload-time IST timestamp', () => {
    const ts = buildServerIstTimestamp(new Date('2026-06-23T10:00:00.000Z'));
    expect(ts).toBe('2026-06-23 15:30:00');
  });
});

describe('inferFoodTaskTypesFromTodayLogs', () => {
  it('maps gap-time breakfast food rows to breakfast (e.g. 9:16 AM)', () => {
    const types = inferFoodTaskTypesFromTodayLogs(
      [{
        CreatedAt: '2026-06-23 09:16:00',
        AnalysisData: JSON.stringify({ foods: [{ name: 'sambar', weight_g: 200 }] }),
      }],
      ACTIVITY_TIME_WINDOWS_MAP,
      { date: '2026-06-23', time: '21:44:00' },
      new Set(['breakfast']),
    );
    expect(types.has('breakfast')).toBe(true);
  });

  it('maps a lunch food row to lunch', () => {
    const types = inferFoodTaskTypesFromTodayLogs(
      [{
        CreatedAt: '2026-06-23 13:00:00',
        AnalysisData: JSON.stringify({ foods: [{ name: 'rice', weight_g: 200 }] }),
      }],
      ACTIVITY_TIME_WINDOWS_MAP,
      { date: '2026-06-23', time: '13:00:00' },
      new Set(['lunch']),
    );
    expect(types.has('lunch')).toBe(true);
  });

  it('falls back to active lunch window when EXIF time is outside windows', () => {
    const types = inferFoodTaskTypesFromTodayLogs(
      [{
        CreatedAt: '2026-06-23 09:00:00',
        AnalysisData: JSON.stringify({ foods: [{ name: 'rice', weight_g: 200 }] }),
      }],
      ACTIVITY_TIME_WINDOWS_MAP,
      { date: '2026-06-23', time: '13:00:00' },
      new Set(['lunch']),
    );
    expect(types.has('lunch')).toBe(true);
  });

  it('maps beverage-only rows to water', () => {
    const types = inferFoodTaskTypesFromTodayLogs(
      [{
        CreatedAt: '2026-06-23 10:00:00',
        AnalysisData: JSON.stringify({ foods: [{ name: 'water', volume_ml: 250 }] }),
      }],
      ACTIVITY_TIME_WINDOWS_MAP,
      { date: '2026-06-23', time: '10:00:00' },
      new Set(['water']),
    );
    expect(types.has('water')).toBe(true);
  });
});
