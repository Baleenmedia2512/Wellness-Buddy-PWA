/**
 * Unit tests for profile timezone validation and resolution.
 * Run: node --test backend/features/user/__tests__/timezone.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateTimezoneIana,
  validateUpdateProfile,
} from '../user.validators.js';
import { resolveProfileTimezone } from '../domain/profileTimezone.js';
import { ValidationError } from '../../../shared/lib/ValidationError.js';
import { IANA_IST } from '../../../shared/lib/datetime/index.js';

describe('resolveProfileTimezone', () => {
  it('defaults to Asia/Kolkata when missing', () => {
    assert.equal(resolveProfileTimezone(null), IANA_IST);
    assert.equal(resolveProfileTimezone(undefined), IANA_IST);
    assert.equal(resolveProfileTimezone(''), IANA_IST);
    assert.equal(resolveProfileTimezone('   '), IANA_IST);
  });

  it('returns stored value when present', () => {
    assert.equal(resolveProfileTimezone('America/New_York'), 'America/New_York');
  });
});

describe('validateTimezoneIana', () => {
  it('accepts valid IANA zones', () => {
    const result = validateTimezoneIana('Europe/London');
    assert.equal(result.valid, true);
    assert.equal(result.value, 'Europe/London');
  });

  it('defaults empty string to Asia/Kolkata', () => {
    const result = validateTimezoneIana('');
    assert.equal(result.valid, true);
    assert.equal(result.value, IANA_IST);
  });

  it('rejects invalid zones', () => {
    const result = validateTimezoneIana('Not/AZone');
    assert.equal(result.valid, false);
    assert.match(result.message, /Invalid timezone/i);
  });

  it('omits value when not provided', () => {
    const result = validateTimezoneIana(undefined);
    assert.equal(result.valid, true);
    assert.equal(result.value, undefined);
  });
});

describe('validateUpdateProfile timezone', () => {
  const baseBody = {
    email: 'user@example.com',
    name: 'Test User',
  };

  it('accepts timezone field', () => {
    const parsed = validateUpdateProfile({ ...baseBody, timezone: 'America/Chicago' });
    assert.equal(parsed.timezoneIana, 'America/Chicago');
  });

  it('accepts timezoneIana alias', () => {
    const parsed = validateUpdateProfile({ ...baseBody, timezoneIana: 'Europe/Berlin' });
    assert.equal(parsed.timezoneIana, 'Europe/Berlin');
  });

  it('accepts timezone_iana alias', () => {
    const parsed = validateUpdateProfile({ ...baseBody, timezone_iana: 'Asia/Tokyo' });
    assert.equal(parsed.timezoneIana, 'Asia/Tokyo');
  });

  it('throws ValidationError for invalid timezone', () => {
    assert.throws(
      () => validateUpdateProfile({ ...baseBody, timezone: 'bogus' }),
      (err) => err instanceof ValidationError && err.status === 400,
    );
  });

  it('omits timezoneIana when not provided', () => {
    const parsed = validateUpdateProfile(baseBody);
    assert.equal(parsed.timezoneIana, undefined);
  });
});
