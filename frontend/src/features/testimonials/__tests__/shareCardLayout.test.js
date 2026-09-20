/**
 * Run: node --test frontend/src/features/testimonials/__tests__/shareCardLayout.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CARD_H,
  MAX_VISIBLE_ISSUES,
  chunkIssues,
  issueColumnsForCount,
  issueRowCount,
  shareCardPhotoHeight,
} from '../utils/shareCardLayout.js';

describe('issueColumnsForCount', () => {
  it('keeps 1–3 issues on a single uncrowded row', () => {
    assert.equal(issueColumnsForCount(1), 1);
    assert.equal(issueColumnsForCount(2), 2);
    assert.equal(issueColumnsForCount(3), 3);
  });

  it('uses 3 columns for 4–6 and never 5 columns for long labels', () => {
    assert.equal(issueColumnsForCount(4), 3);
    assert.equal(issueColumnsForCount(6), 3);
    assert.equal(issueColumnsForCount(7), 4);
    assert.equal(issueColumnsForCount(10), 4);
    assert.ok(issueColumnsForCount(10) < 5);
  });

  it('treats empty or invalid counts as no columns', () => {
    assert.equal(issueColumnsForCount(0), 0);
    assert.equal(issueColumnsForCount(null), 0);
  });
});

describe('issueRowCount / chunkIssues', () => {
  it('splits ten issues into three readable rows', () => {
    assert.equal(issueRowCount(10), 3);
    const rows = chunkIssues(Array.from({ length: 10 }, (_, i) => `i${i}`), 4);
    assert.equal(rows.length, 3);
    assert.deepEqual(rows[2], ['i8', 'i9']);
  });

  it('caps layout math at the visible-issue limit', () => {
    assert.equal(issueRowCount(MAX_VISIBLE_ISSUES + 5), issueRowCount(MAX_VISIBLE_ISSUES));
  });
});

describe('shareCardPhotoHeight', () => {
  it('gives photos more height when there are few issues', () => {
    const few = shareCardPhotoHeight({ issueCount: 2, hasResultPill: true });
    const many = shareCardPhotoHeight({ issueCount: 10, hasResultPill: true });
    assert.ok(few > many);
    assert.ok(few + many < CARD_H * 2);
  });

  it('always leaves room for the rest of the 9:16 card', () => {
    const h = shareCardPhotoHeight({ issueCount: 10, hasResultPill: true });
    assert.ok(h >= 340);
    assert.ok(h <= 690);
    assert.ok(h + 300 < CARD_H);
  });
});
