/**
 * Run: node --test backend/features/testimonials/__tests__/photoCompleteness.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  afterWeightDiffersFromBefore,
  hasCompletePhotoTestimonial,
  hasDistinctAfterPhoto,
  hasRealBeforePhoto,
  hasVisibleAfterCard,
  isPhotoPairComplete,
  resolveHealthIssueOtpChannel,
} from '../domain/photoCompleteness.rules.js';

const seeded = {
  status: 'incomplete',
  before_image_path: '42/before_1700000000000.jpg',
  after_image_path: '42/before_1700000000000.jpg',
  before_weight_kg: 75,
  after_weight_kg: 75,
};

describe('seeded incomplete before/after clone', () => {
  it('has a real before photo and a visible after card', () => {
    assert.equal(hasRealBeforePhoto(seeded), true);
    assert.equal(hasVisibleAfterCard(seeded), true);
    assert.equal(hasDistinctAfterPhoto(seeded), false);
  });

  it('is not complete while after weight still matches before', () => {
    assert.equal(isPhotoPairComplete(seeded), false);
    assert.equal(hasCompletePhotoTestimonial(seeded), false);
  });

  it('becomes complete when after weight changes (first after weight)', () => {
    assert.equal(afterWeightDiffersFromBefore(75, 76), true);
    assert.equal(isPhotoPairComplete(seeded, { afterWeightKg: 76 }), true);
  });

  it('is complete once pending even if after path still clones before', () => {
    assert.equal(isPhotoPairComplete({ ...seeded, status: 'pending' }), true);
  });

  it('sends health-issue OTP on a visible before/after card (not silent)', () => {
    assert.equal(resolveHealthIssueOtpChannel(seeded), 'photo');
  });
});

describe('distinct after photo', () => {
  const row = {
    ...seeded,
    after_image_path: '42/after_1700000001000.jpg',
    after_weight_kg: 70,
    status: 'pending',
  };

  it('is complete', () => {
    assert.equal(hasDistinctAfterPhoto(row), true);
    assert.equal(isPhotoPairComplete(row), true);
    assert.equal(resolveHealthIssueOtpChannel(row), 'photo');
  });
});

describe('no photos yet', () => {
  it('does not require OTP for issues-only', () => {
    assert.equal(resolveHealthIssueOtpChannel({
      status: 'incomplete',
      before_image_path: '42/42_video_only_placeholder.jpg',
      recovered_health_issues: [],
    }), null);
  });
});
