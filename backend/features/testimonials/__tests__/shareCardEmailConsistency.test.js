/**
 * Coach email NEW thumbs vs tap-preview must use the same Before/After pair.
 * Run: node --test backend/features/testimonials/__tests__/shareCardEmailConsistency.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildUnifiedSubmitEmailHtml,
  buildTransformationCardCompareRow,
} from '../testimonialCoachEmail.template.js';

describe('share card email consistency (NEW thumbs vs tap)', () => {
  it('NEW compact thumbs use before/after photo URLs, not the share-card JPEG', () => {
    const html = buildTransformationCardCompareRow({
      previousBeforeUrl: 'https://example.com/before-old.jpg',
      previousAfterUrl: 'https://example.com/after-old.jpg',
      previousBeforeWeight: 90.9,
      previousAfterWeight: 70,
      previousPreviewHref: 'https://example.com/prev-card.jpg',
      beforeUrl: 'https://example.com/before-new.jpg',
      afterUrl: 'https://example.com/after-new.jpg',
      beforeWeight: 90.9,
      afterWeight: 60.8,
      currentPreviewHref: 'https://example.com/new-card.jpg',
    });
    assert.match(html, /https:\/\/example\.com\/before-new\.jpg/);
    assert.match(html, /https:\/\/example\.com\/after-new\.jpg/);
    assert.match(html, /https:\/\/example\.com\/new-card\.jpg/);
    // Outer thumbs must not embed the full share-card JPEG as a photo slot.
    const newSection = html.slice(html.indexOf('>New<'));
    assert.match(newSection, /before-new\.jpg/);
    assert.match(newSection, /after-new\.jpg/);
    assert.doesNotMatch(newSection.replace(/href="https:\/\/example\.com\/new-card\.jpg"/, ''), /new-card\.jpg/);
  });

  it('without shareCardReady-equivalent href, NEW still shows Before|After thumbs', () => {
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
    assert.match(html, />New</);
    assert.match(html, /before-new\.jpg/);
    assert.match(html, /after-new\.jpg/);
    assert.doesNotMatch(html, /Tap for full Transformation Card/);
  });
});
