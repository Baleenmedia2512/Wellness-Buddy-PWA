/**
 * Run: node --test backend/features/testimonials/__tests__/profilePhotoSync.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
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
});
