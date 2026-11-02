/**
 * bcmContactPhone.rules.test.js
 * Run: node --test frontend/src/features/body-parameters-card/domain/bcmContactPhone.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhoneDigits, phonesMatch } from './bcmContactPhone.rules.js';

describe('phonesMatch', () => {
  it('matches same national number with/without country code', () => {
    assert.equal(phonesMatch('+919360515518', '9360515518'), true);
    assert.equal(phonesMatch('9360515518', '9360515518'), true);
  });

  it('rejects different numbers', () => {
    assert.equal(phonesMatch('9360515518', '9360515519'), false);
  });

  it('normalizePhoneDigits strips non-digits', () => {
    assert.equal(normalizePhoneDigits('+91 9360-515518'), '919360515518');
  });
});
