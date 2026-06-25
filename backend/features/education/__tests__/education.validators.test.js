/**
 * Pure unit tests for education validators.
 * Coverage target: ≥ 95 % lines / 90 % branches (claude.md §9.1).
 */
import {
  validateSaveLog,
  validateGetLogs,
  validateGetLogImage,
  validateGetSummary,
  validateDeleteLog,
  validateUndoDelete,
} from '../education.validators.js';

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

describe('validateSaveLog', () => {
  it('returns the body when all required fields are present', () => {
    const body = { userId: 1, platform: 'YouTube', topic: 'Diet', extra: 'x' };
    expect(validateSaveLog(body)).toBe(body);
  });

  it.each([null, undefined])('rejects %p body', (b) => {
    expectValidationError(() => validateSaveLog(b), 400, 'body');
  });

  it.each([
    [{ platform: 'YouTube', topic: 'D' }, 'userId'],
    [{ userId: 1, topic: 'D' }, 'platform'],
    [{ userId: 1, platform: 'YouTube' }, 'topic'],
  ])('rejects %p', (body, expected) => {
    expectValidationError(() => validateSaveLog(body), 400, expected);
  });
});

describe('validateGetLogs', () => {
  it('defaults includeImage to true when omitted', () => {
    expect(validateGetLogs({ userId: '7' })).toEqual({
      userId: '7',
      limit: null,
      offset: 0,
      includeImage: true,
    });
  });

  it('honours includeImage="false" and explicit booleans', () => {
    expect(validateGetLogs({ userId: '1', includeImage: 'false' }).includeImage).toBe(false);
    expect(validateGetLogs({ userId: '1', includeImage: false }).includeImage).toBe(false);
    expect(validateGetLogs({ userId: '1', includeImage: true }).includeImage).toBe(true);
    expect(validateGetLogs({ userId: '1', includeImage: 'true' }).includeImage).toBe(true);
  });

  it('parses numeric limit/offset', () => {
    const out = validateGetLogs({ userId: '1', limit: '5', offset: '10' });
    expect(out.limit).toBe(5);
    expect(out.offset).toBe(10);
  });

  it('falls back to null limit when non-numeric', () => {
    expect(validateGetLogs({ userId: '1', limit: 'abc' }).limit).toBeNull();
  });

  it('treats empty-string limit/offset as defaults', () => {
    const out = validateGetLogs({ userId: '1', limit: '', offset: '' });
    expect(out.limit).toBeNull();
    expect(out.offset).toBe(0);
  });

  it('rejects missing userId', () => {
    expectValidationError(() => validateGetLogs({}), 400, 'userId');
    expectValidationError(() => validateGetLogs(null), 400, 'userId');
  });
});

describe('validateGetLogImage', () => {
  it('passes through logId+userId', () => {
    expect(validateGetLogImage({ logId: 9, userId: 1 })).toEqual({ logId: 9, userId: 1 });
  });

  it.each([{}, { logId: 1 }, { userId: 1 }, null])('rejects %p', (input) => {
    expectValidationError(() => validateGetLogImage(input), 400, 'required');
  });
});

describe('validateGetSummary', () => {
  it('passes through userId', () => {
    expect(validateGetSummary({ userId: 5 })).toEqual({ userId: 5 });
  });

  it('rejects missing userId', () => {
    expectValidationError(() => validateGetSummary({}), 400, 'userId');
    expectValidationError(() => validateGetSummary(null), 400, 'userId');
  });
});

describe('validateDeleteLog', () => {
  it('accepts complete payload', () => {
    expect(validateDeleteLog({ userId: 1, logId: 2 })).toEqual({ userId: 1, logId: 2 });
  });

  it.each([null, {}, { userId: 1 }, { logId: 2 }])('rejects %p', (input) => {
    expectValidationError(() => validateDeleteLog(input), 400);
  });
});

describe('validateUndoDelete', () => {
  it('accepts when id present', () => {
    expect(validateUndoDelete({ id: 1, userId: 2 })).toEqual({ id: 1, userId: 2 });
  });

  it('does not require userId', () => {
    expect(validateUndoDelete({ id: 9 })).toEqual({ id: 9, userId: undefined });
  });

  it('rejects null body with "body" message (hits !body guard first)', () => {
    expectValidationError(() => validateUndoDelete(null), 400, 'body');
  });

  it.each([{}, { userId: 1 }])('rejects missing id (%p)', (input) => {
    expectValidationError(() => validateUndoDelete(input), 400, 'ID is required');
  });
});
