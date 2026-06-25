/**
 * Pure unit tests for food-corrections validators.
 * Coverage target: ≥ 95 % lines / 90 % branches (claude.md §9.1).
 */
import {
  validateUserId,
  validateGlobal,
  validateSaveCorrection,
  validateSearch,
  validateUpdateAnalysis,
  validateStats,
} from '../food-corrections.validators.js';

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

describe('validateUserId', () => {
  it('passes through userId', () => {
    expect(validateUserId({ userId: 7 })).toEqual({ userId: 7 });
  });

  it.each([{}, null, undefined])('rejects %p', (input) => {
    expectValidationError(() => validateUserId(input), 400, 'userId');
  });
});

describe('validateGlobal', () => {
  it('returns requestingUserId when provided', () => {
    expect(validateGlobal({ userId: 9 })).toEqual({ requestingUserId: 9 });
  });

  it.each([{}, null, undefined])('returns null when missing (%p)', (input) => {
    expect(validateGlobal(input)).toEqual({ requestingUserId: null });
  });
});

describe('validateSaveCorrection', () => {
  it('returns the body when all required fields present', () => {
    const body = { userId: 1, aiDetected: 'rice', userCorrected: 'biryani', extra: 'x' };
    expect(validateSaveCorrection(body)).toBe(body);
  });

  it.each([null, undefined])('rejects %p body', (b) => {
    expectValidationError(() => validateSaveCorrection(b), 400, 'body');
  });

  it.each([
    [{ aiDetected: 'a', userCorrected: 'b' }, 'userId'],
    [{ userId: 1, userCorrected: 'b' }, 'aiDetected'],
    [{ userId: 1, aiDetected: 'a' }, 'userCorrected'],
    [{ userId: 1, aiDetected: '', userCorrected: 'b' }, 'aiDetected'],
  ])('rejects %p', (body, expected) => {
    expectValidationError(() => validateSaveCorrection(body), 400, expected);
  });
});

describe('validateSearch', () => {
  it('trims and returns the search term', () => {
    expect(validateSearch({ userId: '1', query: '  rice  ' })).toEqual({
      userId: '1',
      searchTerm: 'rice',
    });
  });

  it('rejects missing userId', () => {
    expectValidationError(() => validateSearch({ query: 'rice' }), 400, 'userId');
    expectValidationError(() => validateSearch(null), 400, 'userId');
  });

  it.each([
    [{ userId: '1' }, 'query is required'],
    [{ userId: '1', query: '' }, 'query is required'],
    [{ userId: '1', query: '   ' }, 'query is required'],
  ])('rejects empty query %p', (input, expected) => {
    expectValidationError(() => validateSearch(input), 400, expected);
  });
});

describe('validateUpdateAnalysis', () => {
  it('accepts a complete valid body', () => {
    const body = { id: 1, userId: 2, analysisData: { foods: [{ name: 'rice' }] } };
    expect(validateUpdateAnalysis(body)).toBe(body);
  });

  it.each([null, undefined])('rejects %p body', (b) => {
    expectValidationError(() => validateUpdateAnalysis(b), 400, 'body');
  });

  it.each([
    [{ userId: 2, analysisData: { foods: [] } }, 'meal ID or userId'],
    [{ id: 1, analysisData: { foods: [] } }, 'meal ID or userId'],
  ])('rejects missing id/userId %p', (body, expected) => {
    expectValidationError(() => validateUpdateAnalysis(body), 400, expected);
  });

  it.each([
    { id: 1, userId: 2 },
    { id: 1, userId: 2, analysisData: {} },
    { id: 1, userId: 2, analysisData: { foods: 'not-array' } },
    { id: 1, userId: 2, analysisData: null },
  ])('rejects invalid analysisData %p', (body) => {
    expectValidationError(() => validateUpdateAnalysis(body), 400, 'analysis data');
  });
});

describe('validateStats', () => {
  it('returns defaults', () => {
    expect(validateStats({ userId: '5' })).toEqual({
      userId: '5',
      date: null,
      detailed: false,
    });
  });

  it('honours date and detailed=true', () => {
    expect(validateStats({ userId: '5', date: '2026-05-18', detailed: 'true' })).toEqual({
      userId: '5',
      date: '2026-05-18',
      detailed: true,
    });
  });

  it('coerces non-"true" detailed to false', () => {
    expect(validateStats({ userId: '5', detailed: 'yes' }).detailed).toBe(false);
    expect(validateStats({ userId: '5', detailed: true }).detailed).toBe(true);
  });

  it('rejects missing userId', () => {
    expectValidationError(() => validateStats({}), 400, 'UserId');
    expectValidationError(() => validateStats(null), 400, 'UserId');
  });
});
