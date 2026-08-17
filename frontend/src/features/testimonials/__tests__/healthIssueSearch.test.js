/**
 * Unit tests for transformation health-issue and name search.
 * Run: node --test frontend/src/features/testimonials/__tests__/healthIssueSearch.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { searchMedicalConditions } from '../domain/medicalConditionSearch.js';
import {
  buildHealthIssueSuggestions,
  buildSearchSuggestions,
} from '../utils/testimonialSearch.js';

describe('health issue search', () => {
  it('returns Back Pain variants when searching back', () => {
    const results = searchMedicalConditions('back');
    assert.ok(results.includes('Back Pain'));
    assert.ok(results.includes('Lower Back Pain'));
    assert.ok(results.includes('Chronic Back Pain'));
    assert.equal(results[0], 'Back Pain');
  });

  it('buildHealthIssueSuggestions returns catalog matches for back', () => {
    const items = buildHealthIssueSuggestions('back');
    assert.ok(items.includes('Back Pain'));
    assert.ok(items.includes('Lower Back Pain'));
    assert.ok(items.includes('Chronic Back Pain'));
    assert.equal(items[0], 'Back Pain');
  });
});

describe('name search suggestions', () => {
  it('matches member names only', () => {
    const rows = [
      { user: { userId: 1, userName: 'Adhith' }, testimonial: { recoveredHealthIssues: ['Back Pain'] } },
      { user: { userId: 2, userName: 'Priya' }, testimonial: null },
    ];
    const byName = buildSearchSuggestions(rows, 'adh');
    assert.equal(byName.length, 1);
    assert.equal(byName[0].user.userName, 'Adhith');

    const byIssueText = buildSearchSuggestions(rows, 'back');
    assert.equal(byIssueText.length, 0);
  });
});
