/**
 * Unit tests for transformation health-issue search.
 * Run: node --test frontend/src/features/testimonials/__tests__/healthIssueSearch.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { searchMedicalConditions } from '../domain/medicalConditionSearch.js';

describe('health issue search', () => {
  it('returns Back Pain variants when searching back', () => {
    const results = searchMedicalConditions('back');
    assert.ok(results.includes('Back Pain'));
    assert.ok(results.includes('Lower Back Pain'));
    assert.ok(results.includes('Chronic Back Pain'));
    assert.equal(results[0], 'Back Pain');
  });
});
