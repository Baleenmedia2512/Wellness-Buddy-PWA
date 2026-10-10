/**
 * Run: node --test backend/features/testimonials/__tests__/transformationWeightDirection.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isTransformationWeightLoss,
  transformationWeightVerb,
} from '../domain/transformationWeightDirection.js';

describe('transformationWeightDirection', () => {
  it('uses before→after delta, not goalType', () => {
    assert.equal(isTransformationWeightLoss(90.9, 60.8), true);
    assert.equal(transformationWeightVerb(90.9, 60.8), 'Lost');
    assert.equal(isTransformationWeightLoss(60, 70), false);
    assert.equal(transformationWeightVerb(60, 70), 'Gained');
    assert.equal(transformationWeightVerb(60, 70, { capitalize: false }), 'gained');
  });

  it('returns null when weights are missing or unchanged', () => {
    assert.equal(isTransformationWeightLoss(75, 75), null);
    assert.equal(isTransformationWeightLoss(75, null), null);
    assert.equal(transformationWeightVerb(75, 75), null);
  });
});
