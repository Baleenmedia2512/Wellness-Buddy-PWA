/**
 * bodyMetricReferences.test.js
 * Run: node --test frontend/src/features/body-parameters-card/domain/bodyMetricReferences.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getBodyAgeReference,
  getBodyMetricReferences,
  getBmiReference,
  getFatPercentReference,
  getVisceralFatReference,
} from './bodyMetricReferences.js';

describe('bodyMetricReferences', () => {
  it('returns BMI reference range', () => {
    assert.equal(getBmiReference(), '18.5 to 23');
  });

  it('returns gender-specific fat percent reference', () => {
    assert.equal(getFatPercentReference('Male'), '10 to 20%');
    assert.equal(getFatPercentReference('Female'), '20 to 30%');
    assert.equal(getFatPercentReference('Other'), null);
  });

  it('returns visceral fat reference', () => {
    assert.equal(getVisceralFatReference(), '≤ 9');
  });

  it('returns body age reference from actual age', () => {
    assert.equal(getBodyAgeReference(27), '≤ 27 Yrs');
    assert.equal(getBodyAgeReference(null), null);
  });

  it('builds reference map for profile body metrics', () => {
    const refs = getBodyMetricReferences({
      age: 27,
      gender: 'Male',
      fatPercent: 16,
      visceralFat: 9,
      bmi: 17.5,
      bodyAge: 22,
    });

    assert.deepEqual(refs, {
      fatPercent: '10 to 20%',
      visceralFat: '≤ 9',
      bmi: '18.5 to 23',
      bodyAge: '≤ 27 Yrs',
    });
  });
});
