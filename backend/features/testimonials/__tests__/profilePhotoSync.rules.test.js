/**
 * Run: node --test backend/features/testimonials/__tests__/profilePhotoSync.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildProfileSlotsFromTestimonialImages,
  canSyncProfileAfterToTestimonial,
  hasPositiveWeight,
  testimonialHasRealAfter,
} from '../domain/profilePhotoSync.rules.js';

describe('profilePhotoSync.rules', () => {
  it('detects positive weight', () => {
    assert.equal(hasPositiveWeight(72), true);
    assert.equal(hasPositiveWeight(0), false);
    assert.equal(hasPositiveWeight(null), false);
  });

  it('treats incomplete mirrored after as not real', () => {
    assert.equal(testimonialHasRealAfter({
      status: 'incomplete',
      before_image_path: '1/before.jpg',
      after_image_path: '1/before.jpg',
    }), false);
  });

  it('treats pending distinct after as real', () => {
    assert.equal(testimonialHasRealAfter({
      status: 'pending',
      before_image_path: '1/before.jpg',
      after_image_path: '1/after.jpg',
    }), true);
    assert.equal(canSyncProfileAfterToTestimonial({
      status: 'pending',
      before_image_path: '1/before.jpg',
      after_image_path: '1/after.jpg',
    }), false);
  });

  it('allows after sync when no row exists', () => {
    assert.equal(canSyncProfileAfterToTestimonial(null), true);
  });

  it('maps Transformation Before/After onto Profile Left/Right', () => {
    const slots = buildProfileSlotsFromTestimonialImages({
      beforeImageBase64: 'data:image/jpeg;base64,beforebytes',
      afterImageBase64: 'data:image/jpeg;base64,afterbytes',
    });
    assert.equal(slots.left, 'data:image/jpeg;base64,beforebytes');
    assert.equal(slots.right, 'data:image/jpeg;base64,afterbytes');
    assert.equal(slots.front, undefined);
  });

  it('wraps raw base64 as a data URL for Profile', () => {
    const raw = 'AAAA'.repeat(20);
    const slots = buildProfileSlotsFromTestimonialImages({
      beforeImageBase64: raw,
    });
    assert.equal(slots.left, `data:image/jpeg;base64,${raw}`);
  });
});
