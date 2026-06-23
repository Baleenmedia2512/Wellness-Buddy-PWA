/**
 * completion-learning.rules.test.js — unit tests for habit learning rules.
 */

import {
  getISTPartsFromDate,
  extractIstParts,
  inferMealTaskType,
  normalizeActivityWindow,
  buildActivityWindowsMap,
  resolveFoodSaveTaskType,
  normalizeTaskTypeHint,
  formatAverageTimeLabel,
  buildPersonalisedReminderBody,
  buildSecondReminderBody,
  getReminderTitle,
  isAtReminderMinute,
  addMinutesToTime,
  appendCompletionHistory,
  computeAverageFromHistory,
  resolveEffectiveReminderTime,
  resolveDisplayAverageLabel,
  buildWindowStartReminderBody,
  buildGroupedPendingTasksBody,
  DEFAULT_COMPLETION_TIMES,
  MIN_SAMPLES_FOR_PERSONALIZED,
} from '../domain/completion-learning.rules.js';
import {
  ACTIVITY_TIME_WINDOWS_TABLE_ROWS,
  ACTIVITY_TIME_WINDOWS_MAP,
} from './fixtures/activity-time-windows.fixture.js';

describe('getISTPartsFromDate', () => {
  it('converts UTC midnight to IST morning same calendar day offset', () => {
    // 2026-06-15 00:00 UTC → 2026-06-15 05:30 IST
    const parts = getISTPartsFromDate(new Date('2026-06-15T00:00:00.000Z'));
    expect(parts.date).toBe('2026-06-15');
    expect(parts.time).toBe('05:30:00');
    expect(parts.timeHm).toBe('05:30');
  });
});

describe('extractIstParts', () => {
  it('parses space-separated IST timestamp', () => {
    expect(extractIstParts('2026-06-15 08:10:00')).toEqual({
      date: '2026-06-15',
      time: '08:10:00',
    });
  });

  it('returns null for invalid input', () => {
    expect(extractIstParts('')).toBeNull();
    expect(extractIstParts('bad')).toBeNull();
  });
});

describe('normalizeActivityWindow', () => {
  it('reads activity_time_windows_table PascalCase columns', () => {
    expect(normalizeActivityWindow(ACTIVITY_TIME_WINDOWS_TABLE_ROWS[2])).toEqual({
      start: '05:30:00',
      end:   '08:30:00',
    });
  });

  it('reads task-repo snake_case aliases', () => {
    expect(normalizeActivityWindow(ACTIVITY_TIME_WINDOWS_MAP.lunch)).toEqual({
      start: '12:00:00',
      end:   '16:00:00',
    });
  });
});

describe('buildActivityWindowsMap', () => {
  it('indexes table rows by ActivityType', () => {
    const map = buildActivityWindowsMap(ACTIVITY_TIME_WINDOWS_TABLE_ROWS);
    expect(map.breakfast.WindowStartTime).toBe('05:30:00');
    expect(map.dinner.WindowEndTime).toBe('20:30:00');
  });
});

describe('inferMealTaskType — activity_time_windows_table', () => {
  it('returns breakfast inside configured breakfast window', () => {
    expect(inferMealTaskType('08:05:00', ACTIVITY_TIME_WINDOWS_TABLE_ROWS)).toBe('breakfast');
  });

  it('returns lunch inside configured lunch window (12:00 PM – 4:00 PM)', () => {
    expect(inferMealTaskType('12:45:00', ACTIVITY_TIME_WINDOWS_TABLE_ROWS)).toBe('lunch');
  });

  it('returns dinner inside configured dinner window (5:30 PM – 8:30 PM)', () => {
    expect(inferMealTaskType('20:02:00', ACTIVITY_TIME_WINDOWS_TABLE_ROWS)).toBe('dinner');
  });

  it('attributes gap after breakfast to breakfast (late logging grace)', () => {
    expect(inferMealTaskType('09:16:00', ACTIVITY_TIME_WINDOWS_TABLE_ROWS)).toBe('breakfast');
    expect(inferMealTaskType('10:00:00', ACTIVITY_TIME_WINDOWS_TABLE_ROWS)).toBe('breakfast');
  });

  it('attributes gap after lunch to lunch', () => {
    expect(inferMealTaskType('16:30:00', ACTIVITY_TIME_WINDOWS_TABLE_ROWS)).toBe('lunch');
  });

  it('attributes late evening logs after dinner window to dinner', () => {
    expect(inferMealTaskType('21:30:00', ACTIVITY_TIME_WINDOWS_TABLE_ROWS)).toBe('dinner');
  });

  it('attributes early morning before breakfast window to breakfast', () => {
    expect(inferMealTaskType('04:00:00', ACTIVITY_TIME_WINDOWS_TABLE_ROWS)).toBe('breakfast');
  });

  it('returns null when table rows are missing — no hardcoded fallback', () => {
    expect(inferMealTaskType('08:05:00', [])).toBeNull();
    expect(inferMealTaskType('12:45:00', null)).toBeNull();
  });

  it('works with pre-built map from task-repo query', () => {
    expect(inferMealTaskType('12:50:00', ACTIVITY_TIME_WINDOWS_MAP)).toBe('lunch');
  });
});

describe('resolveFoodSaveTaskType', () => {
  it('maps water-only saves to water task', () => {
    expect(resolveFoodSaveTaskType({
      istTimeOnly: '14:00:00',
      analysisResult: { foods: [{ name: 'water', volume_ml: 250 }] },
      timeWindows: ACTIVITY_TIME_WINDOWS_TABLE_ROWS,
    })).toBe('water');
  });

  it('maps meal food to lunch using activity_time_windows_table', () => {
    expect(resolveFoodSaveTaskType({
      istTimeOnly: '12:50:00',
      analysisResult: { foods: [{ name: 'rice', weight_g: 200 }] },
      timeWindows: ACTIVITY_TIME_WINDOWS_TABLE_ROWS,
    })).toBe('lunch');
  });
});

describe('normalizeTaskTypeHint', () => {
  it('accepts valid meal hints', () => {
    expect(normalizeTaskTypeHint('lunch')).toBe('lunch');
    expect(normalizeTaskTypeHint('Breakfast')).toBe('breakfast');
  });

  it('rejects invalid hints', () => {
    expect(normalizeTaskTypeHint('weight')).toBeNull();
    expect(normalizeTaskTypeHint('')).toBeNull();
    expect(normalizeTaskTypeHint(null)).toBeNull();
  });
});

describe('formatAverageTimeLabel', () => {
  it('formats morning time', () => {
    expect(formatAverageTimeLabel('04:30:00')).toBe('4:30 AM');
  });

  it('formats evening time', () => {
    expect(formatAverageTimeLabel('20:02:00')).toBe('8:02 PM');
  });
});

describe('buildPersonalisedReminderBody', () => {
  it('uses weight-specific copy', () => {
    const body = buildPersonalisedReminderBody('weight', '4:30 AM');
    expect(body).toContain('upload your weight around 4:30 AM');
    expect(body).toContain("Today's upload is still pending");
  });

  it('uses breakfast-specific copy', () => {
    expect(buildPersonalisedReminderBody('breakfast', '8:10 AM')).toContain('log breakfast');
  });

  it('falls back for unknown types', () => {
    expect(buildPersonalisedReminderBody('custom', '9:00 AM')).toContain('usually complete this');
  });
});

describe('buildSecondReminderBody', () => {
  it('uses weight-specific second reminder copy', () => {
    expect(buildSecondReminderBody('weight')).toContain('weight upload is still pending');
  });
});

describe('getReminderTitle', () => {
  it('returns product title for weight', () => {
    expect(getReminderTitle('weight')).toBe('Weight Upload Pending');
  });
});

describe('isAtReminderMinute', () => {
  it('matches HH:mm regardless of seconds', () => {
    expect(isAtReminderMinute('04:30:15', '04:30:00')).toBe(true);
    expect(isAtReminderMinute('04:31:00', '04:30:00')).toBe(false);
  });
});

describe('addMinutesToTime', () => {
  it('adds 30 minutes for reminder 2 scheduling', () => {
    expect(addMinutesToTime('04:30:00', 30)).toBe('05:00:00');
  });
});

describe('appendCompletionHistory', () => {
  it('keeps only the last 7 completion times', () => {
    let history = [];
    for (let i = 0; i < 10; i += 1) {
      history = appendCompletionHistory(history, `0${i % 10}:00:00`);
    }
    expect(history).toHaveLength(7);
    expect(history[0]).toBe('03:00:00');
    expect(history[6]).toBe('09:00:00');
  });
});

describe('computeAverageFromHistory', () => {
  it('averages the last completion times', () => {
    const avg = computeAverageFromHistory(['04:28:00', '04:32:00', '04:30:00']);
    expect(avg).toBe('04:30:00');
  });
});

describe('resolveEffectiveReminderTime', () => {
  it('uses default times when sample_count < 3', () => {
    expect(resolveEffectiveReminderTime('weight', {
      average_completion_time: '04:31:00',
      sample_count: 2,
    })).toBe(DEFAULT_COMPLETION_TIMES.weight);
  });

  it('uses personalised average when sample_count >= 3', () => {
    expect(resolveEffectiveReminderTime('weight', {
      average_completion_time: '04:31:00',
      sample_count: 3,
    })).toBe('04:31:00');
  });

  it('falls back to default when no row exists', () => {
    expect(resolveEffectiveReminderTime('breakfast', null)).toBe(DEFAULT_COMPLETION_TIMES.breakfast);
  });
});

describe('buildWindowStartReminderBody', () => {
  it('uses spec copy for weight window start', () => {
    expect(buildWindowStartReminderBody('weight')).toContain("have not uploaded today's weight yet");
  });
});

describe('buildGroupedPendingTasksBody', () => {
  it('mentions multiple pending tasks', () => {
    expect(buildGroupedPendingTasksBody(3)).toContain('3 pending wellness tasks');
  });
});

describe('resolveDisplayAverageLabel', () => {
  it('shows default label before personalised threshold', () => {
    expect(resolveDisplayAverageLabel('weight', { sample_count: 1 })).toBe('6:00 AM');
  });

  it('shows personalised label after threshold', () => {
    expect(resolveDisplayAverageLabel('weight', {
      average_completion_time: '04:31:00',
      sample_count: 4,
    })).toBe('4:31 AM');
  });
});
