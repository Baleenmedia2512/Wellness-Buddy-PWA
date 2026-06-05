/**
 * Pure unit tests for background-analysis validators.
 * Coverage target: ≥ 95 % lines / 90 % branches (claude.md §9.1).
 */
import {
  validateSave,
  validateList,
  validateDelete,
  validateUndo,
  validateRetryPromotion,
} from '../analysis.validators.js';

function expectValidationError(fn, status, messageSubstring) {
  try {
    fn();
  } catch (e) {
    expect(e.name).toBe('ValidationError');
    expect(e.status).toBe(status);
    if (messageSubstring) expect(e.message).toContain(messageSubstring);
    return;
  }
  throw new Error('Expected ValidationError to be thrown');
}

describe('validateSave', () => {
  it('accepts a complete body and returns it unchanged', () => {
    const body = { userId: 1, imagePath: '/x.jpg', analysisResult: { foo: 'bar' }, extra: 'kept' };
    expect(validateSave(body)).toBe(body);
  });

  it('rejects null body', () => {
    expectValidationError(() => validateSave(null), 400, 'body is missing');
  });

  it.each([
    [{ imagePath: '/x', analysisResult: {} }, 'userId missing'],
    [{ userId: 1, analysisResult: {} }, 'imagePath missing'],
    [{ userId: 1, imagePath: '/x' }, 'analysisResult missing'],
    [{}, 'all missing'],
  ])('rejects when required field missing (%p — %s)', (input) => {
    expectValidationError(() => validateSave(input), 400, 'Missing required fields');
  });
});

describe('validateList', () => {
  it('returns defaults when only userId provided', () => {
    expect(validateList({ userId: 7 })).toEqual({ userId: 7, limit: 50, offset: 0 });
  });

  it('parses limit and offset', () => {
    expect(validateList({ userId: 7, limit: '20', offset: '40' })).toEqual({
      userId: 7,
      limit: 20,
      offset: 40,
    });
  });

  it('defaults limit/offset to 50/0 when unparseable (NaN || default)', () => {
    expect(validateList({ userId: 7, limit: 'abc', offset: 'xyz' })).toEqual({
      userId: 7,
      limit: 50,
      offset: 0,
    });
  });

  it.each([null, undefined, {}])('rejects when userId missing (%p)', (input) => {
    expectValidationError(() => validateList(input), 400, 'UserId is required');
  });
});

describe('validateDelete', () => {
  it('returns id and userId on success', () => {
    expect(validateDelete({ id: 5, userId: 2, extra: 'dropped' })).toEqual({ id: 5, userId: 2 });
  });

  it('rejects null body', () => {
    expectValidationError(() => validateDelete(null), 400, 'body is missing');
  });

  it.each([
    [{ userId: 2 }, 'id missing'],
    [{ id: 5 }, 'userId missing'],
    [{}, 'both missing'],
  ])('rejects when id or userId missing (%p)', (input) => {
    expectValidationError(() => validateDelete(input), 400, 'Analysis ID and userId are required');
  });
});

describe('validateUndo', () => {
  it('returns id and userId on success', () => {
    expect(validateUndo({ id: 9, userId: 3 })).toEqual({ id: 9, userId: 3 });
  });

  it('allows missing userId', () => {
    expect(validateUndo({ id: 9 })).toEqual({ id: 9, userId: undefined });
  });

  it('rejects null body', () => {
    expectValidationError(() => validateUndo(null), 400, 'body is missing');
  });

  it.each([{}, { userId: 3 }])('rejects when id missing (%p)', (input) => {
    expectValidationError(() => validateUndo(input), 400, 'Analysis ID is required');
  });
});

// ─── PR-A.2 / ADR-0003 — Diary retry-promotion validator ────────────────────
describe('validateRetryPromotion', () => {
  const baseBody = {
    captureId: '101',
    viewerUserId: '42',
    analysisResult: { foods: [{ name: 'dosa' }] },
  };

  it('accepts a complete object analysisResult and coerces ids to strings', () => {
    expect(validateRetryPromotion({ ...baseBody, captureId: 101, viewerUserId: 42 })).toEqual({
      captureId: '101',
      viewerUserId: '42',
      analysisResult: baseBody.analysisResult,
      imagePath: null,
    });
  });

  it('accepts a JSON-string analysisResult (native client Retry path)', () => {
    const stringBody = { ...baseBody, analysisResult: '{"foods":[]}' };
    const out = validateRetryPromotion(stringBody);
    expect(out.analysisResult).toBe('{"foods":[]}');
  });

  it('passes through imagePath when supplied', () => {
    expect(
      validateRetryPromotion({ ...baseBody, imagePath: '/images/abc.jpg' }).imagePath,
    ).toBe('/images/abc.jpg');
  });

  it('defaults imagePath to null when absent', () => {
    expect(validateRetryPromotion(baseBody).imagePath).toBeNull();
  });

  it('rejects null body', () => {
    expectValidationError(() => validateRetryPromotion(null), 400, 'body is missing');
  });

  it.each([
    [{ viewerUserId: '42', analysisResult: {} }, 'captureId'],
    [{ captureId: '1', analysisResult: {} }, 'viewerUserId'],
    [{ captureId: '1', viewerUserId: '42' }, 'analysisResult'],
  ])('rejects when required field missing (%p)', (input, expected) => {
    expectValidationError(() => validateRetryPromotion(input), 400, expected);
  });

  it('rejects analysisResult of the wrong type (e.g. number)', () => {
    expectValidationError(
      () => validateRetryPromotion({ ...baseBody, analysisResult: 42 }),
      400,
      'analysisResult must be',
    );
  });

  it('rejects analysisResult === null explicitly (== null guard)', () => {
    expectValidationError(
      () => validateRetryPromotion({ ...baseBody, analysisResult: null }),
      400,
      'analysisResult is required',
    );
  });
});
