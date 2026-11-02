/**
 * bodyMetricReferences.test.js
 * Run: node --test frontend/src/features/body-parameters-card/domain/bodyMetricReferences.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateChestCm,
  evaluateHipCm,
  evaluateVisceralFat,
  evaluateWaistCm,
  getBodyAgeReference,
  getBodyMetricReferences,
  getBmiReference,
  getChestCmReference,
  getFatPercentReference,
  getHipCmReference,
  getVisceralFatReference,
  getWaistCmReference,
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

  it('returns gender-specific waist / chest / hip references', () => {
    assert.equal(getWaistCmReference('Male'), '≤ 90 cm');
    assert.equal(getWaistCmReference('Female'), '≤ 80 cm');
    assert.equal(getChestCmReference('Male'), '≥ 90 cm');
    assert.equal(getChestCmReference('Female'), '≤ 80 cm');
    assert.equal(getHipCmReference('Male'), '≤ 90 cm');
    assert.equal(getHipCmReference('Female'), '≥ 80 cm');
    assert.equal(getWaistCmReference(null), null);
  });

  it('returns body age reference from actual age', () => {
    assert.equal(getBodyAgeReference(27), '≤ 27 Yrs');
    assert.equal(getBodyAgeReference(null), null);
  });

  it('evaluates visceral fat against ≤ 9', () => {
    assert.deepEqual(evaluateVisceralFat(9), { isOutOfRange: false, direction: null });
    assert.deepEqual(evaluateVisceralFat(10), { isOutOfRange: true, direction: 'high' });
    assert.equal(evaluateVisceralFat(''), null);
  });

  it('evaluates waist / chest / hip by gender', () => {
    assert.deepEqual(evaluateWaistCm(91, 'Male'), { isOutOfRange: true, direction: 'high' });
    assert.deepEqual(evaluateWaistCm(80, 'Female'), { isOutOfRange: false, direction: null });
    assert.deepEqual(evaluateWaistCm(81, 'Female'), { isOutOfRange: true, direction: 'high' });

    assert.deepEqual(evaluateChestCm(89, 'Male'), { isOutOfRange: true, direction: 'low' });
    assert.deepEqual(evaluateChestCm(90, 'Male'), { isOutOfRange: false, direction: null });
    assert.deepEqual(evaluateChestCm(81, 'Female'), { isOutOfRange: true, direction: 'high' });
    assert.deepEqual(evaluateChestCm(80, 'Female'), { isOutOfRange: false, direction: null });

    assert.deepEqual(evaluateHipCm(91, 'Male'), { isOutOfRange: true, direction: 'high' });
    assert.deepEqual(evaluateHipCm(79, 'Female'), { isOutOfRange: true, direction: 'low' });
    assert.deepEqual(evaluateHipCm(80, 'Female'), { isOutOfRange: false, direction: null });
    assert.equal(evaluateHipCm(95, null), null);
  });

  it('builds reference map for profile body metrics', () => {
    const refs = getBodyMetricReferences({
      age: 27,
      gender: 'Male',
      fatPercent: 16,
      visceralFat: 9,
      bmi: 17.5,
      bodyAge: 22,
      waistCm: 88,
      chestCm: 95,
      hipCm: 90,
    });

    assert.deepEqual(refs, {
      fatPercent: '10 to 20%',
      visceralFat: '≤ 9',
      bmi: '18.5 to 23',
      bodyAge: '≤ 27 Yrs',
      waistCm: '≤ 90 cm',
      chestCm: '≥ 90 cm',
      hipCm: '≤ 90 cm',
    });
  });
});
