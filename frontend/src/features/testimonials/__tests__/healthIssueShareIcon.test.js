/**
 * Run: node --test frontend/src/features/testimonials/__tests__/healthIssueShareIcon.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { healthIssueShareIcon } from '../utils/healthIssueShareIcon.js';

describe('healthIssueShareIcon', () => {
  it('maps tired / sleep / hormonal labels from the share template', () => {
    const tired = healthIssueShareIcon('Whole day Very tired');
    const sleep = healthIssueShareIcon('No proper sleep');
    const hormonal = healthIssueShareIcon('Hormonal Imbalance');
    assert.equal(tired, '😫');
    assert.equal(sleep, '🛏️');
    assert.equal(hormonal, '♀️');
    assert.notEqual(tired, sleep);
    assert.notEqual(sleep, hormonal);
  });

  it('falls back for unknown labels and empty input', () => {
    const fallback = healthIssueShareIcon('Something unique');
    assert.equal(fallback, '❤️');
    assert.equal(healthIssueShareIcon(''), fallback);
  });
});
