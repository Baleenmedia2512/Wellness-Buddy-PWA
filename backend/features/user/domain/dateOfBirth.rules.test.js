/**
 * Run: node --test backend/features/user/domain/dateOfBirth.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ageFromDateOfBirth,
  normalizeDateOfBirthIso,
  sqlDateToIso,
} from './dateOfBirth.rules.js';

describe('dateOfBirth.rules', () => {
  it('normalizes ISO and dd/mm/yyyy DOB', () => {
    assert.equal(normalizeDateOfBirthIso('1990-05-15'), '1990-05-15');
    assert.equal(normalizeDateOfBirthIso('15/05/1990'), '1990-05-15');
  });

  it('rejects future and empty/invalid values', () => {
    assert.equal(normalizeDateOfBirthIso(''), '');
    assert.equal(normalizeDateOfBirthIso(null), '');
    assert.equal(normalizeDateOfBirthIso('not-a-date'), null);
    assert.equal(normalizeDateOfBirthIso('2099-01-01'), null);
  });

  it('calculates age from DOB in IST', () => {
    // Fixed "now": 2026-11-26 IST-ish via UTC instant
    const now = new Date('2026-11-26T06:00:00.000Z');
    assert.equal(ageFromDateOfBirth('2000-11-26', now), 26);
    assert.equal(ageFromDateOfBirth('2000-11-27', now), 25);
    assert.equal(ageFromDateOfBirth('15/05/1990', now), 36);
  });

  it('maps SQL date values to ISO', () => {
    assert.equal(sqlDateToIso('1990-05-15'), '1990-05-15');
    assert.equal(sqlDateToIso('1990-05-15T00:00:00.000Z'), '1990-05-15');
    assert.equal(sqlDateToIso(null), null);
  });
});
