/**
 * Unit tests for optional body metrics on profile update.
 * Run: node --test backend/features/user/__tests__/optionalBodyMetrics.validators.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateUpdateProfile } from '../user.validators.js';
import { ValidationError } from '../../../shared/lib/ValidationError.js';

const baseBody = {
  email: 'ada@example.com',
  name: 'Ada',
  height: 170,
  dietType: 'Vegetarian',
};

describe('validateUpdateProfile optional body metrics', () => {
  it('omits metrics when keys are absent', () => {
    const parsed = validateUpdateProfile(baseBody);
    assert.equal(parsed.age, undefined);
    assert.equal(parsed.visceralFat, undefined);
    assert.equal(parsed.bodyAge, undefined);
    assert.equal(parsed.chestCm, undefined);
    assert.equal(parsed.waistCm, undefined);
    assert.equal(parsed.hipCm, undefined);
  });

  it('accepts optional metrics when provided', () => {
    const parsed = validateUpdateProfile({
      ...baseBody,
      age: 32,
      visceralFat: 7,
      bodyAge: 28,
      chestCm: 90,
      waistCm: 72,
      hipCm: 96,
    });
    assert.equal(parsed.age, 32);
    assert.equal(parsed.visceralFat, 7);
    assert.equal(parsed.bodyAge, 28);
    assert.equal(parsed.chestCm, 90);
    assert.equal(parsed.waistCm, 72);
    assert.equal(parsed.hipCm, 96);
  });

  it('clears metrics when null or empty string', () => {
    const parsed = validateUpdateProfile({
      ...baseBody,
      age: null,
      visceralFat: '',
      chestCm: null,
    });
    assert.equal(parsed.age, null);
    assert.equal(parsed.visceralFat, null);
    assert.equal(parsed.chestCm, null);
  });

  it('throws ValidationError for out-of-range age', () => {
    assert.throws(
      () => validateUpdateProfile({ ...baseBody, age: 200 }),
      (err) => err instanceof ValidationError && err.status === 400,
    );
  });

  it('throws ValidationError for out-of-range visceral fat', () => {
    assert.throws(
      () => validateUpdateProfile({ ...baseBody, visceralFat: 99 }),
      (err) => err instanceof ValidationError && err.status === 400,
    );
  });
});
