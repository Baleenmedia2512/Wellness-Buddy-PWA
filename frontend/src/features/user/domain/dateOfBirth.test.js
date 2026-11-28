/**
 * Run: node --test frontend/src/features/user/domain/dateOfBirth.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ageFromDateOfBirth, normalizeDateOfBirthIso } from './dateOfBirth.js';

describe('dateOfBirth (frontend)', () => {
  it('normalizes Aadhaar DOB formats', () => {
    assert.equal(normalizeDateOfBirthIso('1990-05-15'), '1990-05-15');
    assert.equal(normalizeDateOfBirthIso('15/05/1990'), '1990-05-15');
  });

  it('derives age from DOB', () => {
    const now = new Date('2026-11-26T06:00:00.000Z');
    assert.equal(ageFromDateOfBirth('2000-11-26', now), 26);
    assert.equal(ageFromDateOfBirth('2000-11-27', now), 25);
  });
});
