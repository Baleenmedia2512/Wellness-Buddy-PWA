/**
 * Unit tests for verify-session validator + service edge cases.
 * Run: node --test backend/features/user/__tests__/verify-session.service.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateVerifySession } from '../user.validators.js';

describe('validateVerifySession', () => {
  it('requires at least one identity field', () => {
    assert.throws(
      () => validateVerifySession({ method: 'POST', body: {} }),
      (err) => err.status === 400,
    );
  });

  it('accepts userId only', () => {
    const out = validateVerifySession({
      method: 'POST',
      body: { userId: '750' },
    });
    assert.equal(out.userId, '750');
    assert.equal(out.email, null);
  });

  it('accepts email from GET query', () => {
    const out = validateVerifySession({
      method: 'GET',
      query: { email: 'User@Example.com', userId: '750' },
    });
    assert.equal(out.email, 'user@example.com');
    assert.equal(out.userId, '750');
  });

  it('accepts phone from body', () => {
    const out = validateVerifySession({
      method: 'POST',
      body: { phone: '+919876543210' },
    });
    assert.equal(out.phone, '+919876543210');
  });
});
