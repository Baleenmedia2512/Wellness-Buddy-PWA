/**
 * Run: node --test frontend/src/features/testimonials/__tests__/testimonialFilters.scopeCount.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  UPLOAD_FILTERS,
  resolveTeamScopeCount,
} from '../utils/testimonialFilters.js';

const COUNTS = { fully_uploaded: 0, partial_upload: 2, not_uploaded: 1 };

describe('resolveTeamScopeCount', () => {
  it('keeps Direct/Full total when filter is All', () => {
    assert.equal(resolveTeamScopeCount(UPLOAD_FILTERS.ALL, COUNTS, 3), 3);
  });

  it('keeps Direct total when Partial is selected (list filters; badge does not)', () => {
    assert.equal(resolveTeamScopeCount(UPLOAD_FILTERS.PARTIAL, COUNTS, 3), 3);
  });

  it('keeps Full total when Not Uploaded is selected', () => {
    assert.equal(resolveTeamScopeCount(UPLOAD_FILTERS.NOT_UPLOADED, COUNTS, 51), 51);
  });

  it('keeps total when Fully Uploaded is selected', () => {
    assert.equal(resolveTeamScopeCount(UPLOAD_FILTERS.FULLY_UPLOADED, COUNTS, 51), 51);
  });

  it('falls back to 0 for non-finite totals', () => {
    assert.equal(resolveTeamScopeCount(UPLOAD_FILTERS.ALL, COUNTS, null), 0);
  });
});
