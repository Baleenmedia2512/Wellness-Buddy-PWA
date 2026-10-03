/**
 * Run: node --test frontend/src/features/testimonials/services/__tests__/transformationApproval.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isUsableDurationText,
  isPlaceholderDurationText,
  liveWeightDiffKg,
  canShareTransformationPhoto,
} from '../testimonialFormUtils.js';

describe('duration usability', () => {
  it('accepts API-shaped duration and rejects stubs', () => {
    assert.equal(isUsableDurationText('3 months'), true);
    assert.equal(isUsableDurationText('1 days'), true);
    assert.equal(isUsableDurationText('—'), false);
    assert.equal(isUsableDurationText('2 weeks'), false);
    assert.equal(isPlaceholderDurationText('—'), true);
    assert.equal(isPlaceholderDurationText('3 months'), false);
  });
});

describe('liveWeightDiffKg', () => {
  it('uses on-screen weights so draft after-weight still counts', () => {
    assert.equal(liveWeightDiffKg(75, 73), '2.0');
    assert.equal(liveWeightDiffKg(75, 75), null);
    assert.equal(liveWeightDiffKg(75, null), null);
  });
});

describe('canShareTransformationPhoto', () => {
  it('allows share only after coach OTP verification', () => {
    assert.equal(canShareTransformationPhoto({ status: 'verified' }), true);
    assert.equal(canShareTransformationPhoto({ status: 'pending' }), false);
    assert.equal(canShareTransformationPhoto({ status: 'incomplete' }), false);
    assert.equal(canShareTransformationPhoto(null), false);
  });
});
