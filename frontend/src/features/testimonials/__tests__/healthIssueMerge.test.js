/**
 * Run: node --test frontend/src/features/testimonials/__tests__/healthIssueMerge.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  uniqueConditions,
  hasHealthIssue,
  withoutHealthIssue,
  isSameIssueList,
  canAddCustomHealthIssue,
} from '../utils/uniqueConditions.js';

describe('uniqueConditions health-issue merge', () => {
  it('appends a new issue without dropping existing ones', () => {
    assert.deepEqual(
      uniqueConditions(['Diabetes', 'High BP', 'Cholesterol']),
      ['Diabetes', 'High BP', 'Cholesterol'],
    );
  });

  it('keeps existing issues when merging a newly selected issue', () => {
    const existing = ['Diabetes', 'High BP'];
    const pending = 'Cholesterol';
    assert.deepEqual(
      uniqueConditions([...existing, pending]),
      ['Diabetes', 'High BP', 'Cholesterol'],
    );
  });

  it('does not duplicate the same issue with different casing', () => {
    assert.deepEqual(
      uniqueConditions(['Diabetes', 'diabetes', 'DIABETES']),
      ['Diabetes'],
    );
  });

  it('ignores blank entries', () => {
    assert.deepEqual(
      uniqueConditions(['Diabetes', '  ', null, 'High BP']),
      ['Diabetes', 'High BP'],
    );
  });
});

describe('approved vs newly added health issues', () => {
  it('treats already-present issues as approved regardless of casing', () => {
    assert.equal(hasHealthIssue(['High Cholesterol', 'Hypertension'], 'high cholesterol'), true);
    assert.equal(hasHealthIssue(['High Cholesterol'], 'Asthma'), false);
  });

  it('removes only the newly added issue and keeps approved ones', () => {
    assert.deepEqual(
      withoutHealthIssue(['High Cholesterol', 'Hypertension', 'Asthma'], 'Asthma'),
      ['High Cholesterol', 'Hypertension'],
    );
  });

  it('detects when the draft list is back to the approved set', () => {
    assert.equal(
      isSameIssueList(['Hypertension', 'High Cholesterol'], ['High Cholesterol', 'Hypertension']),
      true,
    );
    assert.equal(
      isSameIssueList(['High Cholesterol', 'Hypertension', 'Asthma'], ['High Cholesterol', 'Hypertension']),
      false,
    );
  });

  it('offers Add custom when the typed issue is not in the suggestion list', () => {
    assert.equal(
      canAddCustomHealthIssue('Kidney swelling', {
        suggestions: ['Diabetes Type 2', 'Hypertension'],
        selected: ['High Cholesterol'],
      }),
      true,
    );
  });

  it('does not offer Add custom for an exact catalog match or a duplicate', () => {
    assert.equal(
      canAddCustomHealthIssue('Diabetes Type 2', {
        suggestions: ['Diabetes Type 2', 'Diabetes Type 1'],
        selected: [],
      }),
      false,
    );
    assert.equal(
      canAddCustomHealthIssue('Asthma', {
        suggestions: ['Hypertension'],
        selected: ['Asthma'],
      }),
      false,
    );
    assert.equal(canAddCustomHealthIssue('h', { suggestions: [], selected: [] }), false);
  });
});
