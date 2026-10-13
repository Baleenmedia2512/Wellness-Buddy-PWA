/**
 * Previous | New email cards: thumb and tap must be the same share-card JPEG.
 * Run: node --test backend/features/testimonials/__tests__/shareCardEmailConsistency.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildUnifiedSubmitEmailHtml,
  buildTransformationCardCompareRow,
} from '../testimonialCoachEmail.template.js';

describe('share card email consistency (Previous | New)', () => {
  it('uses full share-card JPEGs for Previous and New when available', () => {
    const html = buildTransformationCardCompareRow({
      previousBeforeUrl: 'https://example.com/before-old.jpg',
      previousAfterUrl: 'https://example.com/after-old.jpg',
      previousBeforeWeight: 90.9,
      previousAfterWeight: 70,
      previousCardImageUrl: 'https://example.com/prev-card.jpg',
      previousPreviewHref: 'https://example.com/prev-card.jpg',
      beforeUrl: 'https://example.com/before-new.jpg',
      afterUrl: 'https://example.com/after-new.jpg',
      beforeWeight: 90.9,
      afterWeight: 60.8,
      currentCardImageUrl: 'https://example.com/new-card.jpg',
      currentPreviewHref: 'https://example.com/new-card.jpg',
    });
    assert.match(html, /Previous Transformation Card/);
    assert.match(html, /New Transformation Card/);
    assert.match(html, /prev-card\.jpg/);
    assert.match(html, /new-card\.jpg/);
    // Prefer card JPEGs over raw Before|After photo URLs when card images exist.
    assert.doesNotMatch(html, /before-old\.jpg/);
    assert.doesNotMatch(html, /after-new\.jpg/);
  });

  it('unified email shows Previous → New cards from share-card URLs', () => {
    const html = buildUnifiedSubmitEmailHtml({
      memberName: 'Alex',
      otp: '1234',
      changedSlots: ['after'],
      goalType: 'loss',
      beforeWeight: 90.9,
      afterWeight: 60.8,
      durationText: '8 months',
      beforeUrl: 'https://example.com/before-new.jpg',
      afterUrl: 'https://example.com/after-new.jpg',
      previousBeforeUrl: 'https://example.com/before-old.jpg',
      previousAfterUrl: 'https://example.com/after-old.jpg',
      previousBeforeWeight: 90.9,
      previousAfterWeight: 70,
      previousCardImageUrl: 'https://example.com/prev-card.jpg',
      currentCardImageUrl: 'https://example.com/new-card.jpg',
      previousPreviewHref: 'https://example.com/prev-card.jpg',
      currentPreviewHref: 'https://example.com/new-card.jpg',
      healthVideoUrl: null,
      businessVideoUrl: null,
      recoveredHealthIssues: [],
      isComplete: true,
    });
    assert.match(html, /Previous Transformation Card/);
    assert.match(html, /New Transformation Card/);
    assert.match(html, /prev-card\.jpg/);
    assert.match(html, /new-card\.jpg/);
  });
});
