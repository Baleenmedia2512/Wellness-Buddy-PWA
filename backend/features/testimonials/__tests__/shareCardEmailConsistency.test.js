/**
 * Coach email updated-card thumbs vs tap-preview must use the same Before/After pair.
 * Run: node --test backend/features/testimonials/__tests__/shareCardEmailConsistency.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildUnifiedSubmitEmailHtml } from '../testimonialCoachEmail.template.js';

describe('share card email consistency (updated card thumbs vs tap)', () => {
  it('updated compact thumbs use before/after photo URLs, not the share-card JPEG', () => {
    const html = buildUnifiedSubmitEmailHtml({
      memberName: 'Alex',
      otp: '1234',
      changedSlots: ['after'],
      goalType: 'loss',
      beforeWeight: 90.9,
      afterWeight: 60.8,
      durationText: '6 months',
      beforeUrl: 'https://example.com/before-new.jpg',
      afterUrl: 'https://example.com/after-new.jpg',
      currentPreviewHref: 'https://example.com/new-card.jpg',
      healthVideoUrl: null,
      businessVideoUrl: null,
      recoveredHealthIssues: [],
      isComplete: true,
    });
    assert.match(html, /https:\/\/example\.com\/before-new\.jpg/);
    assert.match(html, /https:\/\/example\.com\/after-new\.jpg/);
    assert.match(html, /https:\/\/example\.com\/new-card\.jpg/);
    assert.doesNotMatch(html, />Previous</);
    // Outer thumbs must not embed the full share-card JPEG as a photo slot.
    const cardSection = html.slice(html.indexOf('Updated Transformation Card'));
    assert.match(cardSection, /before-new\.jpg/);
    assert.match(cardSection, /after-new\.jpg/);
    assert.doesNotMatch(
      cardSection.replace(/href="https:\/\/example\.com\/new-card\.jpg"/, ''),
      /new-card\.jpg/,
    );
  });

  it('without shareCardReady-equivalent href, updated card still shows Before|After thumbs', () => {
    const html = buildUnifiedSubmitEmailHtml({
      memberName: 'Alex',
      otp: '1234',
      changedSlots: ['before', 'after'],
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
      currentPreviewHref: null,
      previousPreviewHref: null,
      healthVideoUrl: null,
      businessVideoUrl: null,
      recoveredHealthIssues: [],
      isComplete: true,
    });
    assert.match(html, /Updated Transformation Card/);
    assert.match(html, /before-new\.jpg/);
    assert.match(html, /after-new\.jpg/);
    assert.doesNotMatch(html, />Previous</);
    assert.doesNotMatch(html, /Tap for full Transformation Card/);
  });
});
