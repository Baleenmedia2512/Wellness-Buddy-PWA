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
});
