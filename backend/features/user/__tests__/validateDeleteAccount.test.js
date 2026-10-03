/**
 * Unit tests for validateDeleteAccount dual path.
 * Run: node --test backend/features/user/__tests__/validateDeleteAccount.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateDeleteAccount } from '../user.validators.js';
import { ValidationError } from '../../../shared/lib/ValidationError.js';

describe('validateDeleteAccount', () => {
  it('accepts userId + DELETE confirm (new path, no email OTP)', () => {
    const parsed = validateDeleteAccount({ userId: 42, confirmPhrase: 'DELETE' });
    assert.equal(parsed.mode, 'userId');
    assert.equal(parsed.userId, 42);
  });

  it('accepts case-insensitive DELETE', () => {
    const parsed = validateDeleteAccount({ userId: 7, confirmPhrase: 'delete' });
    assert.equal(parsed.mode, 'userId');
  });

  it('rejects userId without DELETE confirm', () => {
    assert.throws(
      () => validateDeleteAccount({ userId: 42, confirmPhrase: 'YES' }),
      (err) => err instanceof ValidationError && err.status === 400,
    );
  });

  it('accepts legacy email-only body', () => {
    const parsed = validateDeleteAccount({ email: 'a@b.com' });
    assert.equal(parsed.mode, 'legacyEmail');
    assert.equal(parsed.email, 'a@b.com');
  });

  it('rejects empty body', () => {
    assert.throws(
      () => validateDeleteAccount({}),
      (err) => err instanceof ValidationError,
    );
  });
});
