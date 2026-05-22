/**
 * Pure unit tests for activity validators.
 * Coverage target: ≥ 95 % lines / 90 % branches (claude.md §9.1).
 */
import {
  validateGetDaily,
  validateSaveDaily,
  validateWatchCalories,
  validateTimeReport,
  toDateKey,
} from '../activity.validators.js';

function expectValidationError(fn, status, messageSubstring) {
  try {
    fn();
  } catch (err) {
    expect(err.name).toBe('ValidationError');
    expect(err.status).toBe(status);
    if (messageSubstring) expect(err.message).toContain(messageSubstring);
    return;
  }
  throw new Error('Expected ValidationError to be thrown');
}

describe('toDateKey', () => {
  it('formats a Date as YYYY-MM-DD', () => {
    expect(toDateKey(new Date('2026-01-09T10:00:00Z'))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('uses now by default', () => {
    expect(toDateKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('validateGetDaily', () => {
  it('returns defaults when only userId provided', () => {
    const out = validateGetDaily({ userId: '7' });
    expect(out.userId).toBe('7');
    expect(out.trendDays).toBe(7);
    expect(out.activityType).toBeNull();
    expect(out.targetDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('clamps trendDays to [1, 30] and defaults falsy/NaN to 7', () => {
    // parseInt('0', 10) || 7 === 7 → falsy values fall through to the default,
    // documenting current behavior so any change is intentional.
    expect(validateGetDaily({ userId: '1', days: '0' }).trendDays).toBe(7);
    expect(validateGetDaily({ userId: '1', days: '1' }).trendDays).toBe(1);
    expect(validateGetDaily({ userId: '1', days: '15' }).trendDays).toBe(15);
    expect(validateGetDaily({ userId: '1', days: '999' }).trendDays).toBe(30);
    expect(validateGetDaily({ userId: '1', days: 'abc' }).trendDays).toBe(7);
  });

  it('accepts walking activityType in any case', () => {
    expect(validateGetDaily({ userId: '1', activityType: 'WALKING' }).activityType).toBe(
      'walking',
    );
  });

  it('rejects unsupported activityType', () => {
    expectValidationError(
      () => validateGetDaily({ userId: '1', activityType: 'running' }),
      400,
      'Invalid activityType',
    );
  });

  it('only accepts targetDate in strict YYYY-MM-DD form', () => {
    expect(validateGetDaily({ userId: '1', targetDate: '2026-05-18' }).targetDate).toBe(
      '2026-05-18',
    );
    expect(validateGetDaily({ userId: '1', targetDate: '18/05/2026' }).targetDate).not.toBe(
      '18/05/2026',
    );
  });

  it('rejects missing userId', () => {
    expectValidationError(() => validateGetDaily({}), 400, 'userId');
    expectValidationError(() => validateGetDaily(null), 400, 'userId');
  });
});

describe('validateSaveDaily', () => {
  it('accepts a minimal valid payload, defaulting activityType=walking', () => {
    const out = validateSaveDaily({ userId: 1, steps: 1000 });
    expect(out).toMatchObject({
      userId: 1,
      steps: 1000,
      activityType: 'walking',
      currentSensorTotal: null,
    });
    expect(out.activityDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('preserves caloriesBurned and currentSensorTotal', () => {
    const out = validateSaveDaily({
      userId: 1,
      steps: 500,
      caloriesBurned: 42,
      currentSensorTotal: 9001,
    });
    expect(out.caloriesBurned).toBe(42);
    expect(out.currentSensorTotal).toBe(9001);
  });

  it('accepts steps=0 (a valid no-activity log)', () => {
    expect(validateSaveDaily({ userId: 1, steps: 0 }).steps).toBe(0);
  });

  it.each([null, undefined])('rejects %p body', (body) => {
    expectValidationError(() => validateSaveDaily(body), 400);
  });

  it('rejects missing userId or steps', () => {
    expectValidationError(() => validateSaveDaily({ steps: 100 }), 400, 'userId');
    expectValidationError(() => validateSaveDaily({ userId: 1 }), 400, 'steps');
    expectValidationError(
      () => validateSaveDaily({ userId: 1, steps: null }),
      400,
      'steps',
    );
  });

  it('rejects unsupported activityType', () => {
    expectValidationError(
      () => validateSaveDaily({ userId: 1, steps: 1, activityType: 'cycling' }),
      400,
      'Invalid activityType',
    );
  });
});

describe('validateWatchCalories', () => {
  it('uses today when date missing', () => {
    expect(validateWatchCalories({ userId: '1' }).targetDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('preserves provided date', () => {
    expect(validateWatchCalories({ userId: '1', date: '2026-04-01' }).targetDate).toBe(
      '2026-04-01',
    );
  });

  it('rejects missing userId', () => {
    expectValidationError(() => validateWatchCalories({}), 400, 'userId');
    expectValidationError(() => validateWatchCalories(null), 400, 'userId');
  });
});

describe('validateTimeReport', () => {
  const base = { userId: '1', dateRange: 'today' };

  it('coerces userId to int and returns defaults', () => {
    const out = validateTimeReport(base);
    expect(out).toMatchObject({
      userId: 1,
      role: 'member',
      dateRange: 'today',
      tzOffset: 0,
    });
  });

  it('accepts each non-custom range', () => {
    ['today', 'yesterday', 'last7days', 'last30days'].forEach((r) => {
      expect(validateTimeReport({ ...base, dateRange: r }).dateRange).toBe(r);
    });
  });

  it('accepts a custom range with both dates', () => {
    const out = validateTimeReport({
      ...base,
      dateRange: 'custom',
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    });
    expect(out.dateRange).toBe('custom');
    expect(out.startDate).toBe('2026-01-01');
  });

  it('rejects custom range missing dates', () => {
    expectValidationError(
      () => validateTimeReport({ ...base, dateRange: 'custom', startDate: '2026-01-01' }),
      400,
      'endDate',
    );
    expectValidationError(
      () => validateTimeReport({ ...base, dateRange: 'custom', endDate: '2026-01-31' }),
      400,
      'startDate',
    );
  });

  it('parses userTimezoneOffset', () => {
    expect(validateTimeReport({ ...base, userTimezoneOffset: '-330' }).tzOffset).toBe(-330);
  });

  it.each([
    [{}, 'userId'],
    [null, 'userId'],
    [{ userId: 'abc', dateRange: 'today' }, 'must be a valid number'],
    [{ userId: '1' }, 'dateRange is required'],
    [{ userId: '1', dateRange: 'forever' }, 'must be one of'],
    [{ userId: '1', dateRange: 'today', role: 'ghost' }, 'role must be one of'],
  ])('rejects %p', (input, expected) => {
    expectValidationError(() => validateTimeReport(input), 400, expected);
  });
});
