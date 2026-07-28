/**
 * Unit tests for device timezone resolution.
 * Run: node --test backend/features/user/__tests__/deviceTimezone.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  hasDeviceTimezoneInput,
  resolveDeviceTimezoneIana,
} from '../domain/deviceTimezone.js';
import { IANA_IST } from '../../../shared/lib/datetime/index.js';

describe('resolveDeviceTimezoneIana', () => {
  it('falls back to Asia/Kolkata when missing or empty', () => {
    assert.equal(resolveDeviceTimezoneIana(null), IANA_IST);
    assert.equal(resolveDeviceTimezoneIana(undefined), IANA_IST);
    assert.equal(resolveDeviceTimezoneIana(''), IANA_IST);
    assert.equal(resolveDeviceTimezoneIana('   '), IANA_IST);
  });

  it('accepts valid IANA zones', () => {
    assert.equal(resolveDeviceTimezoneIana('America/New_York'), 'America/New_York');
    assert.equal(resolveDeviceTimezoneIana('Europe/London'), 'Europe/London');
    assert.equal(resolveDeviceTimezoneIana('Australia/Sydney'), 'Australia/Sydney');
    assert.equal(resolveDeviceTimezoneIana('Asia/Kolkata'), 'Asia/Kolkata');
  });

  it('falls back for invalid zones', () => {
    assert.equal(resolveDeviceTimezoneIana('Not/AZone'), IANA_IST);
  });
});

describe('hasDeviceTimezoneInput', () => {
  it('detects when client sent a timezone field', () => {
    assert.equal(hasDeviceTimezoneInput(undefined), false);
    assert.equal(hasDeviceTimezoneInput(null), false);
    assert.equal(hasDeviceTimezoneInput(''), true);
    assert.equal(hasDeviceTimezoneInput('America/Chicago'), true);
  });
});
