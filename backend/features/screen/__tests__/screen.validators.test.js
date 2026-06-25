/**
 * Pure unit tests for screen-time validators.
 * Coverage target: ≥ 95 % lines / 90 % branches (claude.md §9.1).
 */
import {
  validateSaveInput,
  validateHistoryInput,
} from '../screen.validators.js';

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

describe('validateSaveInput', () => {
  it('accepts a valid payload and coerces types', () => {
    const out = validateSaveInput({
      userId: '7',
      date: '2026-05-18',
      totalScreenTimeSeconds: '3600',
    });
    expect(out).toEqual({
      userId: 7,
      date: '2026-05-18',
      totalScreenTimeSeconds: 3600,
    });
  });

  it('clamps negative seconds to 0', () => {
    expect(
      validateSaveInput({ userId: 1, totalScreenTimeSeconds: -50 }).totalScreenTimeSeconds,
    ).toBe(0);
  });

  it('defaults date to today (IST) when missing or invalid', () => {
    const noDate = validateSaveInput({ userId: 1, totalScreenTimeSeconds: 0 });
    expect(noDate.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const badDate = validateSaveInput({
      userId: 1,
      date: '18-05-2026',
      totalScreenTimeSeconds: 0,
    });
    expect(badDate.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('rejects missing userId', () => {
    expectValidationError(
      () => validateSaveInput({ totalScreenTimeSeconds: 0 }),
      400,
      'userId',
    );
  });

  it('rejects missing totalScreenTimeSeconds (null/undefined only)', () => {
    expectValidationError(() => validateSaveInput({ userId: 1 }), 400, 'totalScreenTimeSeconds');
    expectValidationError(
      () => validateSaveInput({ userId: 1, totalScreenTimeSeconds: null }),
      400,
      'totalScreenTimeSeconds',
    );
  });

  it.each(['abc', -1])('rejects invalid userId %p (non-zero invalid)', (uid) => {
    expectValidationError(
      () => validateSaveInput({ userId: uid, totalScreenTimeSeconds: 0 }),
      400,
      'Invalid userId',
    );
  });

  it('treats userId=0 as missing (handled by the !userId guard first)', () => {
    expectValidationError(
      () => validateSaveInput({ userId: 0, totalScreenTimeSeconds: 0 }),
      400,
      'Missing required fields',
    );
  });

  it.each([null, undefined])('rejects %p body', (body) => {
    expectValidationError(() => validateSaveInput(body), 400);
  });
});

describe('validateHistoryInput', () => {
  it('returns defaults when only userId provided', () => {
    const out = validateHistoryInput({ userId: '5' });
    expect(out.userId).toBe(5);
    expect(out.days).toBe(7);
    expect(out.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('clamps days to [1, 90] and defaults falsy/NaN to 7', () => {
    // parseInt('0', 10) || 7 === 7 → 0 falls through to the default.
    expect(validateHistoryInput({ userId: '1', days: '0' }).days).toBe(7);
    expect(validateHistoryInput({ userId: '1', days: '1' }).days).toBe(1);
    expect(validateHistoryInput({ userId: '1', days: '500' }).days).toBe(90);
    expect(validateHistoryInput({ userId: '1', days: 'abc' }).days).toBe(7);
  });

  it('preserves a valid targetDate, falls back when invalid', () => {
    expect(validateHistoryInput({ userId: '1', targetDate: '2026-04-30' }).endDate).toBe(
      '2026-04-30',
    );
    expect(
      validateHistoryInput({ userId: '1', targetDate: 'not-a-date' }).endDate,
    ).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('rejects missing or invalid userId', () => {
    expectValidationError(() => validateHistoryInput({}), 400, 'userId');
    expectValidationError(() => validateHistoryInput({ userId: 'abc' }), 400, 'userId');
    expectValidationError(() => validateHistoryInput({ userId: '0' }), 400, 'userId');
    expectValidationError(() => validateHistoryInput(null), 400, 'userId');
  });
});
