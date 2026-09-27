/**
 * Mirrors backend BCM review gate used after APK reinstall.
 * Run via the frontend test runner if configured; otherwise node --test.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { shouldForceBcmProfileReview } from '../bcmProfileReview.js';

describe('shouldForceBcmProfileReview (frontend)', () => {
  it('forces BCM review only until the server stamp exists', () => {
    assert.equal(
      shouldForceBcmProfileReview({ isBcmLead: true, bcmProfileReviewed: false }),
      true,
    );
    assert.equal(
      shouldForceBcmProfileReview({ isBcmLead: true, bcmProfileReviewed: true }),
      false,
    );
  });
});
