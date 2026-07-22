/**
 * Unit tests for contact uniqueness helpers.
 * Run: node --test backend/features/user/__tests__/contactUniqueness.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isUniqueViolationError,
  uniqueViolationResponse,
} from '../contact-uniqueness.service.js';

describe('isUniqueViolationError', () => {
  it('detects PostgreSQL unique violations', () => {
    assert.equal(isUniqueViolationError({ code: '23505' }), true);
    assert.equal(isUniqueViolationError({ code: '23503' }), false);
    assert.equal(isUniqueViolationError(null), false);
  });
});

describe('uniqueViolationResponse', () => {
  it('maps email index conflicts', () => {
    const result = uniqueViolationResponse({ message: 'duplicate key team_table_email_unique_ci' });
    assert.equal(result.httpStatus, 409);
    assert.match(result.body.message, /email/i);
  });

  it('maps phone index conflicts', () => {
    const result = uniqueViolationResponse({ details: 'Key (PhoneNumber)=(9876543210) already exists' });
    assert.equal(result.httpStatus, 409);
    assert.match(result.body.message, /phone/i);
  });
});
