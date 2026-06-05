/**
 * Pure unit tests for nutrition-centers validators.
 * Coverage target: ≥ 95 % lines / 90 % branches (claude.md §9.1).
 *
 * NOTE on validateRegister: the source uses `!latitude || !longitude` which
 * means latitude=0 (the equator) or longitude=0 (the prime meridian) currently
 * fall into the "missing fields" branch instead of the coordinate-range
 * branch. Tests document existing behavior; a follow-up bug-fix PR should
 * tighten this check.
 */
import {
  validateCheckName,
  validateGetCenters,
  validateRegister,
  validateUnregister,
  validateUpdate,
  validateGetAttendees,
} from '../centers.validators.js';

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

describe('validateCheckName', () => {
  it('trims the provided name', () => {
    expect(validateCheckName({ name: '  My Center  ' })).toEqual({ name: 'My Center' });
  });

  it.each([{}, null, undefined, { name: '' }])('returns empty string for %p', (input) => {
    expect(validateCheckName(input)).toEqual({ name: '' });
  });
});

describe('validateGetCenters', () => {
  it('applies defaults when only userId provided', () => {
    expect(validateGetCenters({ userId: '7' })).toEqual({
      userId: '7',
      teamFilter: 'direct',
      scope: 'team',
      dateRange: 'today',
      startDate: undefined,
      endDate: undefined,
    });
  });

  it('preserves provided filters', () => {
    const out = validateGetCenters({
      userId: '7',
      teamFilter: 'full',
      scope: 'global',
      dateRange: 'custom',
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    });
    expect(out).toMatchObject({
      teamFilter: 'full',
      scope: 'global',
      dateRange: 'custom',
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    });
  });

  it('rejects missing userId', () => {
    expectValidationError(() => validateGetCenters({}), 400, 'userId');
    expectValidationError(() => validateGetCenters(null), 400, 'userId');
  });
});

describe('validateRegister', () => {
  const ok = { centerName: 'C1', latitude: 12.97, longitude: 77.59, ownerUserId: 1 };

  it('accepts a valid payload and coerces lat/lng to numbers', () => {
    const out = validateRegister({ ...ok, latitude: '12.97', longitude: '77.59' });
    expect(out.latitude).toBe(12.97);
    expect(out.longitude).toBe(77.59);
    expect(out.centerName).toBe('C1');
  });

  it('preserves extra fields', () => {
    const out = validateRegister({ ...ok, address: '123 St' });
    expect(out.address).toBe('123 St');
  });

  it.each([null, undefined])('rejects %p body', (b) => {
    expectValidationError(() => validateRegister(b), 400, 'body');
  });

  it.each([
    [{ ...ok, centerName: '' }, 'Missing'],
    [{ ...ok, ownerUserId: 0 }, 'Missing'],
    // latitude=0 / longitude=0 currently fall into "Missing" branch due to !latitude.
    [{ ...ok, latitude: 0 }, 'Missing'],
    [{ ...ok, longitude: 0 }, 'Missing'],
  ])('rejects %p as missing', (body, expected) => {
    expectValidationError(() => validateRegister(body), 400, expected);
  });

  it.each([
    [{ ...ok, latitude: 91 }, 'Invalid coordinates'],
    [{ ...ok, latitude: -91 }, 'Invalid coordinates'],
    [{ ...ok, longitude: 181 }, 'Invalid coordinates'],
    [{ ...ok, longitude: -181 }, 'Invalid coordinates'],
  ])('rejects out-of-range coordinates %p', (body, expected) => {
    expectValidationError(() => validateRegister(body), 400, expected);
  });
});

describe('validateUnregister', () => {
  it('accepts a complete payload', () => {
    expect(validateUnregister({ centerId: 1, userId: 2 })).toEqual({
      centerId: 1,
      userId: 2,
    });
  });

  it.each([null, {}, { centerId: 1 }, { userId: 1 }])('rejects %p', (input) => {
    expectValidationError(() => validateUnregister(input), 400);
  });
});

describe('validateUpdate', () => {
  const base = { centerId: 5, userId: 3, centerName: 'New Name' };

  it('accepts a valid update with centerName only', () => {
    const result = validateUpdate(base);
    expect(result.centerId).toBe(5);
    expect(result.userId).toBe(3);
    expect(result.centerName).toBe('New Name');
  });

  it('accepts lat/lng update and parses floats', () => {
    const result = validateUpdate({ centerId: 5, userId: 3, latitude: '12.34', longitude: '56.78' });
    expect(result.latitude).toBe(12.34);
    expect(result.longitude).toBe(56.78);
  });

  it('rejects null body', () => {
    expectValidationError(() => validateUpdate(null), 400, 'missing');
  });

  it('rejects missing centerId', () => {
    expectValidationError(() => validateUpdate({ userId: 3, centerName: 'x' }), 400, 'centerId');
  });

  it('rejects missing userId', () => {
    expectValidationError(() => validateUpdate({ centerId: 5, centerName: 'x' }), 400, 'userId');
  });

  it('rejects empty centerName', () => {
    expectValidationError(() => validateUpdate({ centerId: 5, userId: 3, centerName: '   ' }), 400, 'empty');
  });

  it('rejects payload with no updatable fields', () => {
    expectValidationError(() => validateUpdate({ centerId: 5, userId: 3 }), 400, 'field');
  });

  it('rejects out-of-range coordinates', () => {
    expectValidationError(
      () => validateUpdate({ centerId: 5, userId: 3, latitude: 200, longitude: 0 }),
      400,
      'coordinates',
    );
  });
});

// ─── validateGetAttendees ─────────────────────────────────────────────────────
describe('validateGetAttendees', () => {
  it('returns parsed centerId when valid', () => {
    const result = validateGetAttendees({ centerId: '42' });
    expect(result.centerId).toBe(42);
  });

  it('passes through optional startDate and endDate', () => {
    const result = validateGetAttendees({ centerId: '7', startDate: '2026-06-01', endDate: '2026-06-01' });
    expect(result.startDate).toBe('2026-06-01');
    expect(result.endDate).toBe('2026-06-01');
  });

  it('returns null dates when omitted', () => {
    const result = validateGetAttendees({ centerId: '3' });
    expect(result.startDate).toBeNull();
    expect(result.endDate).toBeNull();
  });

  it('throws 400 when centerId is missing', () => {
    expectValidationError(() => validateGetAttendees({}), 400, 'centerId');
  });

  it('throws 400 when centerId is zero', () => {
    expectValidationError(() => validateGetAttendees({ centerId: '0' }), 400, 'positive integer');
  });

  it('throws 400 when centerId is not a number', () => {
    expectValidationError(() => validateGetAttendees({ centerId: 'abc' }), 400, 'positive integer');
  });

  it('throws 400 when centerId is negative', () => {
    expectValidationError(() => validateGetAttendees({ centerId: '-5' }), 400, 'positive integer');
  });
});
