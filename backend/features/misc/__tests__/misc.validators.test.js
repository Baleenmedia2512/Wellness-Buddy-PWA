/**
 * Pure unit tests for misc validators.
 * Coverage target: ≥ 95 % lines / 90 % branches (claude.md §9.1).
 */
import {
  validateDetectFace,
  validateClubAttendance,
} from '../misc.validators.js';

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

describe('validateDetectFace', () => {
  it('accepts a base64 string', () => {
    expect(validateDetectFace({ imageBase64: 'iVBORw0KGgoAAAA...' })).toEqual({
      imageBase64: 'iVBORw0KGgoAAAA...',
    });
  });

  it.each([null, undefined, {}, { imageBase64: '' }, { imageBase64: 123 }])(
    'rejects %p',
    (input) => {
      expectValidationError(() => validateDetectFace(input), 400, 'imageBase64');
    },
  );
});

describe('validateClubAttendance', () => {
  it('coerces userId to int and returns defaults', () => {
    expect(validateClubAttendance({ userId: '5' })).toEqual({
      userId: 5,
      startDate: null,
      endDate: null,
    });
  });

  it('preserves provided dates', () => {
    expect(
      validateClubAttendance({ userId: '5', startDate: '2026-01-01', endDate: '2026-01-31' }),
    ).toEqual({ userId: 5, startDate: '2026-01-01', endDate: '2026-01-31' });
  });

  it('rejects missing userId', () => {
    expectValidationError(() => validateClubAttendance({}), 400, 'userId');
    expectValidationError(() => validateClubAttendance(null), 400, 'userId');
  });

  it('documents current behavior: non-numeric userId becomes NaN', () => {
    // Current source uses parseInt without validation. Documenting so any
    // future hardening is intentional. A follow-up PR should reject NaN.
    const out = validateClubAttendance({ userId: 'abc' });
    expect(Number.isNaN(out.userId)).toBe(true);
  });
});
