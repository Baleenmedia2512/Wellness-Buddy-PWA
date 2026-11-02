/**
 * Run: node --test backend/features/user/domain/__tests__/bcmProfileReview.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isBcmProfileReviewedRecorded,
  shouldForceBcmProfileReview,
  shouldPersistBcmProfileReviewed,
} from '../bcmProfileReview.rules.js';

describe('isBcmProfileReviewedRecorded', () => {
  it('is false for null/empty', () => {
    assert.equal(isBcmProfileReviewedRecorded(null), false);
    assert.equal(isBcmProfileReviewedRecorded(undefined), false);
    assert.equal(isBcmProfileReviewedRecorded(''), false);
    assert.equal(isBcmProfileReviewedRecorded('   '), false);
  });

  it('is true for a timestamp', () => {
    assert.equal(isBcmProfileReviewedRecorded('2026-09-27T08:00:00.000Z'), true);
  });
});

describe('shouldForceBcmProfileReview', () => {
  it('forces only for BCM leads who have not reviewed', () => {
    assert.equal(
      shouldForceBcmProfileReview({ isBcmLead: true, bcmProfileReviewed: false }),
      true,
    );
    assert.equal(
      shouldForceBcmProfileReview({ isBcmLead: true, bcmProfileReviewed: true }),
      false,
    );
    assert.equal(
      shouldForceBcmProfileReview({ isBcmLead: false, bcmProfileReviewed: false }),
      false,
    );
  });

  it('does not force after server review so APK reinstall skips Complete Profile', () => {
    assert.equal(
      shouldForceBcmProfileReview({
        isBcmLead: true,
        bcmProfileReviewed: true,
      }),
      false,
    );
  });
});

describe('shouldPersistBcmProfileReviewed', () => {
  it('persists when the client confirms review', () => {
    assert.equal(
      shouldPersistBcmProfileReviewed({ bcmProfileReviewed: true, profileComplete: false }),
      true,
    );
  });

  it('persists when the profile is already complete (older clients)', () => {
    assert.equal(
      shouldPersistBcmProfileReviewed({ bcmProfileReviewed: false, profileComplete: true }),
      true,
    );
  });

  it('does not persist when incomplete and not confirmed', () => {
    assert.equal(
      shouldPersistBcmProfileReviewed({ bcmProfileReviewed: false, profileComplete: false }),
      false,
    );
  });
});
