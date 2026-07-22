/**
 * Unit tests for email change validators.
 * Run: node --test backend/features/user/__tests__/emailChange.validators.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateRequestEmailChange,
  validateChangeEmail,
} from '../user.validators.js';
import { ValidationError } from '../../../shared/lib/ValidationError.js';

describe('validateRequestEmailChange', () => {
  it('accepts a valid payload', () => {
    const result = validateRequestEmailChange({
      userId: 42,
      currentEmail: 'Old@Example.com',
      newEmail: 'New@Example.com',
    });
    assert.equal(result.userId, 42);
    assert.equal(result.currentEmail, 'old@example.com');
    assert.equal(result.newEmail, 'new@example.com');
  });

  it('rejects missing userId', () => {
    assert.throws(
      () => validateRequestEmailChange({ currentEmail: 'a@b.com', newEmail: 'c@d.com' }),
      ValidationError,
    );
  });

  it('rejects missing newEmail', () => {
    assert.throws(
      () => validateRequestEmailChange({ userId: 1, currentEmail: 'a@b.com' }),
      ValidationError,
    );
  });
});

describe('validateChangeEmail', () => {
  it('delegates to validateRequestEmailChange', () => {
    const result = validateChangeEmail({
      userId: 7,
      currentEmail: 'me@test.com',
      newEmail: 'new@test.com',
    });
    assert.equal(result.userId, 7);
    assert.equal(result.newEmail, 'new@test.com');
  });
});
