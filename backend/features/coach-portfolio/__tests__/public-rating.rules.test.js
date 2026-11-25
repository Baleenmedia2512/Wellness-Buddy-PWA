/**
 * Run: node --test backend/features/coach-portfolio/__tests__/public-rating.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPublicRaterKey,
  clampPublicStarRating,
  formatPublicRatingSummary,
} from '../domain/public-rating.rules.js';

describe('coach-portfolio public-rating.rules', () => {
  it('clamps star ratings to integers 1–5', () => {
    assert.equal(clampPublicStarRating(4), 4);
    assert.equal(clampPublicStarRating(4.6), 5);
    assert.equal(clampPublicStarRating('3'), 3);
    assert.equal(clampPublicStarRating(0), null);
    assert.equal(clampPublicStarRating(6), null);
    assert.equal(clampPublicStarRating('nope'), null);
  });

  it('builds a stable rater key from ip + ua + slug', () => {
    const a = buildPublicRaterKey({
      ip: '1.2.3.4',
      userAgent: 'Mozilla/5.0',
      publicSlug: 'madurai/avaniyapuram/system',
    });
    const b = buildPublicRaterKey({
      ip: '1.2.3.4',
      userAgent: 'Mozilla/5.0',
      publicSlug: 'madurai/avaniyapuram/system',
    });
    const c = buildPublicRaterKey({
      ip: '9.9.9.9',
      userAgent: 'Mozilla/5.0',
      publicSlug: 'madurai/avaniyapuram/system',
    });
    assert.equal(a, b);
    assert.notEqual(a, c);
    assert.equal(a.length, 40);
  });

  it('formats average labels like 4.6 / 4.7 and hides empty', () => {
    assert.equal(formatPublicRatingSummary(4.66, 3).label, '4.7');
    assert.equal(formatPublicRatingSummary(4.64, 3).label, '4.6');
    assert.equal(formatPublicRatingSummary(5, 1).average, 5);
    assert.equal(formatPublicRatingSummary(5, 0), null);
    assert.equal(formatPublicRatingSummary(null, 2), null);
  });
});
