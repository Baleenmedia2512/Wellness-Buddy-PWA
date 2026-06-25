/**
 * Pure unit tests for weight validators.
 * Coverage target per claude.md §9.1: validation/ ≥ 95 % lines / 90 % branches.
 *
 * NOTE: weight.validators.js currently re-exports ValidationError twice.
 * Tests import only the validator functions to keep them stable; the duplicate
 * export will be fixed in a separate hotfix PR.
 */
import {
  validateSaveInput,
  validateHistoryInput,
  validateImageInput,
  validateDeleteInput,
  validateUndoInput,
} from '../weight.validators.js';

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
  it('accepts a valid kg payload and coerces weight to number', () => {
    const out = validateSaveInput({ userId: '7', weightValue: '72.5' });
    expect(out).toMatchObject({ userId: '7', weight: 72.5, unit: 'kg' });
  });

  it('accepts an lbs payload', () => {
    const out = validateSaveInput({ userId: 1, weightValue: 150, unit: 'lbs' });
    expect(out.unit).toBe('lbs');
    expect(out.weight).toBe(150);
  });

  it.each([null, undefined])('rejects %p body', (body) => {
    expectValidationError(() => validateSaveInput(body), 400, 'body');
  });

  it('rejects missing userId', () => {
    expectValidationError(
      () => validateSaveInput({ weightValue: 50 }),
      400,
      'userId',
    );
  });

  it('rejects missing weightValue', () => {
    expectValidationError(
      () => validateSaveInput({ userId: 1 }),
      400,
      'weightValue',
    );
  });

  it.each([-1, 501, 'abc'])('rejects out-of-range weight %p', (w) => {
    expectValidationError(
      () => validateSaveInput({ userId: 1, weightValue: w }),
      400,
      'Invalid weight',
    );
  });

  it('treats weightValue=0 as missing (caught by the !weightValue guard first)', () => {
    expectValidationError(
      () => validateSaveInput({ userId: 1, weightValue: 0 }),
      400,
      'Missing required fields',
    );
  });

  it('rejects an invalid unit', () => {
    expectValidationError(
      () => validateSaveInput({ userId: 1, weightValue: 60, unit: 'stone' }),
      400,
      'Invalid unit',
    );
  });
});

describe('validateHistoryInput', () => {
  it('normalises numeric query strings', () => {
    expect(
      validateHistoryInput({ userId: '5', limit: '10', offset: '20' }),
    ).toEqual({ userId: '5', includeImage: false, limit: 10, offset: 20 });
  });

  it('treats includeImage="true" and boolean true as truthy', () => {
    expect(validateHistoryInput({ userId: '5', includeImage: 'true' }).includeImage).toBe(true);
    expect(validateHistoryInput({ userId: '5', includeImage: true }).includeImage).toBe(true);
  });

  it('falls back to null limit / 0 offset for non-numeric values', () => {
    const out = validateHistoryInput({ userId: '5', limit: 'abc', offset: 'xyz' });
    expect(out.limit).toBeNull();
    expect(out.offset).toBe(0);
  });

  it('treats missing limit/offset as defaults', () => {
    const out = validateHistoryInput({ userId: '5' });
    expect(out.limit).toBeNull();
    expect(out.offset).toBe(0);
  });

  it('rejects negative limit and negative offset', () => {
    const out = validateHistoryInput({ userId: '5', limit: '-3', offset: '-1' });
    expect(out.limit).toBeNull();
    expect(out.offset).toBe(0);
  });

  it('rejects missing userId', () => {
    expectValidationError(() => validateHistoryInput({}), 400, 'userId');
    expectValidationError(() => validateHistoryInput(null), 400, 'userId');
  });
});

describe('validateImageInput', () => {
  it('passes through userId+id', () => {
    expect(validateImageInput({ userId: 1, id: 99 })).toEqual({ userId: 1, id: 99 });
  });

  it.each([
    [{}, 'userId'],
    [{ userId: 1 }, 'id'],
    [{ id: 1 }, 'userId'],
    [null, 'userId'],
  ])('rejects %p', (input, expected) => {
    expectValidationError(() => validateImageInput(input), 400, expected);
  });
});

describe('validateDeleteInput', () => {
  it('accepts a complete payload', () => {
    expect(validateDeleteInput({ userId: 1, entryId: 7 })).toEqual({
      userId: 1,
      entryId: 7,
    });
  });

  it.each([null, {}, { userId: 1 }, { entryId: 1 }])('rejects %p', (input) => {
    expectValidationError(() => validateDeleteInput(input), 400, 'Missing');
  });
});

describe('validateUndoInput', () => {
  it('accepts when id present', () => {
    expect(validateUndoInput({ id: 1, userId: 2 })).toEqual({ id: 1, userId: 2 });
  });

  it('does not require userId', () => {
    expect(validateUndoInput({ id: 5 })).toEqual({ id: 5, userId: undefined });
  });

  it.each([null, {}, { userId: 1 }])('rejects missing id (%p)', (input) => {
    expectValidationError(() => validateUndoInput(input), 400, 'ID is required');
  });
});
