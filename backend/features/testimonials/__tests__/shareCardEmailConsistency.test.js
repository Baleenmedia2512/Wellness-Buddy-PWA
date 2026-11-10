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

  it('unified email shows Starting / Current Weight and Duration in WHAT CHANGED and compares cards when photos unchanged', () => {
    const html = buildUnifiedSubmitEmailHtml({
      memberName: 'John',
      otp: '5729',
      changedSlots: ['duration', 'weight'],
      goalType: 'loss',
      beforeWeight: 63,
      afterWeight: 60,
      durationText: '2 months',
      beforeUrl: 'https://example.com/photos/before.jpg',
      afterUrl: 'https://example.com/photos/after.jpg',
      previousBeforeUrl: 'https://example.com/photos/before.jpg',
      previousAfterUrl: 'https://example.com/photos/after.jpg',
      previousBeforeWeight: 63,
      previousAfterWeight: 62,
      previousDurationText: '1 month',
      previousCardImageUrl: 'https://example.com/prev-card.jpg',
      currentCardImageUrl: 'https://example.com/new-card.jpg',
      previousPreviewHref: 'https://example.com/prev-card.jpg',
      currentPreviewHref: 'https://example.com/new-card.jpg',
      healthVideoUrl: null,
      businessVideoUrl: null,
      recoveredHealthIssues: [],
      isComplete: true,
    });
    // WHAT CHANGED block must include both Duration and Starting / Current Weight
    assert.match(html, /WHAT CHANGED/);
    assert.match(html, /Duration \(days \/ months\)/);
    assert.match(html, /Starting \/ Current Weight/);

    // Both Previous and New Transformation Cards must appear side by side
    assert.match(html, /Previous Transformation Card/);
    assert.match(html, /New Transformation Card/);
    assert.match(html, /prev-card\.jpg/);
    assert.match(html, /new-card\.jpg/);
    assert.match(html, /63 kg &#8594; 62 kg/);
    assert.match(html, /63 kg &#8594; 60 kg/);
  });

  it('shows Previous | New when previous After was a Before clone', () => {
    const html = buildUnifiedSubmitEmailHtml({
      memberName: 'kkkkkk',
      otp: '4516',
      changedSlots: ['before', 'after', 'weight'],
      goalType: 'loss',
      beforeWeight: 80,
      afterWeight: 75,
      durationText: '1 days',
      beforeUrl: 'https://example.com/before-new.jpg',
      afterUrl: 'https://example.com/after-new.jpg',
      previousBeforeUrl: 'https://example.com/before-old.jpg',
      previousAfterUrl: 'https://example.com/before-old.jpg',
      previousBeforeWeight: 80,
      previousAfterWeight: 80,
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

  it('stays on a single current card when there is no previous card (first submit)', () => {
    const html = buildUnifiedSubmitEmailHtml({
      memberName: 'kkkkkk',
      otp: '4516',
      changedSlots: ['before', 'after'],
      goalType: 'loss',
      beforeWeight: 80,
      afterWeight: 75,
      durationText: '1 days',
      beforeUrl: 'https://example.com/before-new.jpg',
      afterUrl: 'https://example.com/after-new.jpg',
      previousBeforeUrl: null,
      previousAfterUrl: null,
      previousCardImageUrl: null,
      currentCardImageUrl: 'https://example.com/new-card.jpg',
      previousPreviewHref: null,
      currentPreviewHref: 'https://example.com/new-card.jpg',
      healthVideoUrl: null,
      businessVideoUrl: null,
      recoveredHealthIssues: [],
      isComplete: true,
    });
    assert.doesNotMatch(html, /Previous Transformation Card/);
    assert.doesNotMatch(html, /New Transformation Card/);
    assert.match(html, /new-card\.jpg/);
  });
});

