/**
 * Run: node --test frontend/src/features/testimonials/services/__tests__/transformationApproval.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isUsableDurationText,
  isPlaceholderDurationText,
  liveWeightDiffKg,
  isTransformationWeightLoss,
  canShareTransformationPhoto,
  hasApprovalReadyBeforePhoto,
  hasStoredTransformationPhotoCard,
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

describe('isTransformationWeightLoss', () => {
  it('follows real delta even when goalType would say gain', () => {
    assert.equal(isTransformationWeightLoss(90.9, 60.8), true);
    assert.equal(isTransformationWeightLoss(60, 70), false);
    assert.equal(isTransformationWeightLoss(75, 75), null);
  });
});

describe('canShareTransformationPhoto', () => {
  it('allows share when the left (Before) image is present', () => {
    assert.equal(canShareTransformationPhoto({ beforeImageUrl: 'https://cdn.example/before.jpg' }), true);
    assert.equal(canShareTransformationPhoto({ status: 'verified', beforeImageUrl: 'https://cdn.example/b.jpg' }), true);
    assert.equal(canShareTransformationPhoto({ status: 'pending' }), false);
    assert.equal(canShareTransformationPhoto({ status: 'incomplete' }), false);
    assert.equal(canShareTransformationPhoto(null), false);
  });
});

describe('approval-ready Transformation photos', () => {
  it('rejects profile-seeded URLs as stored photo cards', () => {
    assert.equal(hasStoredTransformationPhotoCard({
      beforeImageUrl: 'https://cdn.example/left.jpg',
      afterImageUrl: 'https://cdn.example/left.jpg',
      photosFromProfileSeed: true,
    }), false);
    assert.equal(hasStoredTransformationPhotoCard({
      id: 9,
      beforeImageUrl: 'https://cdn.example/before.jpg',
      afterImageUrl: 'https://cdn.example/after.jpg',
    }), true);
  });

  it('requires draft Before bytes when Mine is only profile-seeded', () => {
    const seeded = {
      photosFromProfileSeed: true,
      beforeImageUrl: 'https://cdn.example/left.jpg',
      afterImageUrl: 'https://cdn.example/left.jpg',
    };
    assert.equal(hasApprovalReadyBeforePhoto({ testimonial: seeded }), false);
    assert.equal(hasApprovalReadyBeforePhoto({
      testimonial: seeded,
      draftBefore: { imageBase64: 'abc' },
    }), true);
  });

  it('accepts a stored Transformation Before for re-submit OTP', () => {
    assert.equal(hasApprovalReadyBeforePhoto({
      testimonial: {
        id: 3,
        beforeImageUrl: 'https://cdn.example/before.jpg',
      },
    }), true);
  });
});
