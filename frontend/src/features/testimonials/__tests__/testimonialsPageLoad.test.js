/**
 * Run: node --test frontend/src/features/testimonials/__tests__/testimonialsPageLoad.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { shouldShowTestimonialsPageSkeleton } from '../utils/testimonialsPageLoad.js';

describe('shouldShowTestimonialsPageSkeleton', () => {
  it('shows skeleton only on the first load before Mine content exists', () => {
    assert.equal(shouldShowTestimonialsPageSkeleton(true, null), true);
    assert.equal(shouldShowTestimonialsPageSkeleton(true, undefined), true);
  });

  it('keeps the Mine card mounted during a later refresh so photo drafts survive', () => {
    const mineRow = { user: { userId: 1 }, testimonial: { id: 9 } };
    assert.equal(shouldShowTestimonialsPageSkeleton(true, mineRow), false);
    assert.equal(shouldShowTestimonialsPageSkeleton(false, mineRow), false);
  });

  it('hides the skeleton when not loading', () => {
    assert.equal(shouldShowTestimonialsPageSkeleton(false, null), false);
  });
});
