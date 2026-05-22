/**
 * Pure unit tests for user validators.
 * Coverage target: ≥ 95 % lines / 90 % branches (claude.md §9.1).
 */
import {
  normalizeEmail,
  validateGetProfile,
  validateUpdateProfile,
  validateUserId,
  validateLookup,
  validateGoogleUser,
  validateSnooze,
  validateDeleteAccount,
  validateSkipSetup,
  validateStatus,
  VALID_DIETS,
} from '../user.validators.js';

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

describe('normalizeEmail', () => {
  it('lowercases and trims', () => {
    expect(normalizeEmail('  Foo@Bar.COM ')).toBe('foo@bar.com');
  });

  it('passes empty string through (falsy short-circuit)', () => {
    expect(normalizeEmail('')).toBe('');
  });

  it.each([null, undefined])('returns falsy input unchanged (%p)', (input) => {
    expect(normalizeEmail(input)).toBe(input);
  });
});

describe('VALID_DIETS', () => {
  it('exports the canonical diet list', () => {
    expect(VALID_DIETS).toEqual(['Vegetarian', 'Non-Vegetarian', 'Vegan', 'Pescatarian']);
  });
});

describe('validateGetProfile', () => {
  it('normalizes email', () => {
    expect(validateGetProfile({ email: 'A@B.com' })).toEqual({ email: 'a@b.com' });
  });

  it.each([null, undefined, {}, { email: '' }, { email: '   ' }])(
    'rejects when email missing/blank (%p)',
    (input) => {
      // Note: '   '.trim() === '' is falsy → caught by !email guard.
      expectValidationError(() => validateGetProfile(input), 400, 'email');
    },
  );
});

describe('validateUpdateProfile', () => {
  it('returns the whitelisted fields and drops extras', () => {
    const out = validateUpdateProfile({
      email: 'a@b.com',
      name: 'Alice',
      height: 170,
      bmr: 1500,
      dietType: 'Vegan',
      profileImage: 'img.png',
      phoneNumber: '123',
      hackerField: 'evil',
    });
    expect(out).toEqual({
      email: 'a@b.com',
      name: 'Alice',
      height: 170,
      bmr: 1500,
      dietType: 'Vegan',
      profileImage: 'img.png',
      phoneNumber: '123',
    });
    expect(out).not.toHaveProperty('hackerField');
  });

  it('does not normalize email (preserves caller-supplied case)', () => {
    // Documents current behavior: only validateGetProfile/Lookup/etc. normalize.
    expect(validateUpdateProfile({ email: 'A@B.com' }).email).toBe('A@B.com');
  });

  it('rejects null body', () => {
    expectValidationError(() => validateUpdateProfile(null), 400, 'body is missing');
  });

  it('rejects when email missing', () => {
    expectValidationError(() => validateUpdateProfile({ name: 'x' }), 400, 'email');
  });
});

describe('validateUserId', () => {
  it('returns userId', () => {
    expect(validateUserId({ userId: 42 })).toEqual({ userId: 42 });
  });

  it.each([null, undefined, {}, { userId: 0 }, { userId: '' }])(
    'rejects when userId missing/falsy (%p)',
    (input) => {
      // Note: userId=0 is rejected by !userId guard — documented quirk.
      expectValidationError(() => validateUserId(input), 400, 'userId');
    },
  );
});

describe('validateLookup', () => {
  it('reads email from query on GET', () => {
    const req = { method: 'GET', query: { email: 'A@B.com' }, body: { email: 'other@x.com' } };
    expect(validateLookup(req)).toEqual({ email: 'a@b.com' });
  });

  it('reads email from body on POST', () => {
    const req = { method: 'POST', query: { email: 'q@x.com' }, body: { email: 'B@C.com' } };
    expect(validateLookup(req)).toEqual({ email: 'b@c.com' });
  });

  it('rejects when email missing on GET (no query)', () => {
    expectValidationError(
      () => validateLookup({ method: 'GET' }),
      400,
      'Email is required',
    );
  });

  it('rejects when email missing on POST (no body)', () => {
    expectValidationError(
      () => validateLookup({ method: 'POST' }),
      400,
      'Email is required',
    );
  });
});

describe('validateGoogleUser', () => {
  it('returns normalized email plus displayName and photoURL', () => {
    expect(
      validateGoogleUser({ email: 'A@B.com', displayName: 'Alice', photoURL: 'p.png' }),
    ).toEqual({ email: 'a@b.com', displayName: 'Alice', photoURL: 'p.png' });
  });

  it('defaults photoURL to null', () => {
    expect(validateGoogleUser({ email: 'a@b.com', displayName: 'A' })).toEqual({
      email: 'a@b.com',
      displayName: 'A',
      photoURL: null,
    });
  });

  it.each([
    [null, 'null body'],
    [{}, 'empty'],
    [{ email: 'a@b.com' }, 'no displayName'],
    [{ displayName: 'A' }, 'no email'],
  ])('rejects when email or displayName missing (%p — %s)', (input) => {
    expectValidationError(() => validateGoogleUser(input), 400, 'Email and Display Name');
  });
});

describe('validateSnooze', () => {
  it('returns userId', () => {
    expect(validateSnooze({ userId: 7 })).toEqual({ userId: 7 });
  });

  it.each([null, undefined, {}])('rejects when userId missing (%p)', (input) => {
    expectValidationError(() => validateSnooze(input), 400, 'userId');
  });
});

describe('validateDeleteAccount', () => {
  it('normalizes email', () => {
    expect(validateDeleteAccount({ email: 'A@B.com' })).toEqual({ email: 'a@b.com' });
  });

  it.each([null, undefined, {}])('rejects when email missing (%p)', (input) => {
    expectValidationError(() => validateDeleteAccount(input), 400, 'email');
  });
});

describe('validateSkipSetup', () => {
  it('returns email plus defaults for coachId/coachName', () => {
    expect(validateSkipSetup({ email: 'a@b.com' })).toEqual({
      email: 'a@b.com',
      coachId: null,
      coachName: null,
    });
  });

  it('preserves coach fields when supplied', () => {
    expect(
      validateSkipSetup({ email: 'a@b.com', coachId: 5, coachName: 'Bob' }),
    ).toEqual({ email: 'a@b.com', coachId: 5, coachName: 'Bob' });
  });

  it('does not normalize email (caller-supplied case kept)', () => {
    expect(validateSkipSetup({ email: 'A@B.com' }).email).toBe('A@B.com');
  });

  it.each([null, undefined, {}])('rejects when email missing (%p)', (input) => {
    expectValidationError(() => validateSkipSetup(input), 400, 'Email is required');
  });
});

describe('validateStatus', () => {
  it('normalizes email', () => {
    expect(validateStatus({ email: 'A@B.com' })).toEqual({ email: 'a@b.com' });
  });

  it.each([null, undefined, {}])('rejects when email missing (%p)', (input) => {
    expectValidationError(() => validateStatus(input), 400, 'Email is required');
  });
});
