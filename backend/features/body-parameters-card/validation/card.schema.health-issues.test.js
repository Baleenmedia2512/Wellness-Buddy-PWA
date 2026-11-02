/**
 * Run: node --test backend/features/body-parameters-card/validation/card.schema.health-issues.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeRecoveredHealthIssues,
  validateCreateCard,
} from './card.schema.js';

describe('normalizeRecoveredHealthIssues', () => {
  it('returns [] when missing', () => {
    assert.deepEqual(normalizeRecoveredHealthIssues({}), []);
    assert.deepEqual(normalizeRecoveredHealthIssues(null), []);
  });

  it('accepts a valid list and dedupes case-insensitively', () => {
    assert.deepEqual(
      normalizeRecoveredHealthIssues({
        recoveredHealthIssues: [' Diabetes ', 'High BP', 'diabetes'],
      }),
      ['Diabetes', 'High BP'],
    );
  });

  it('maps legacy medicalCondition string', () => {
    assert.deepEqual(
      normalizeRecoveredHealthIssues({ medicalCondition: 'Thyroid' }),
      ['Thyroid'],
    );
  });

  it('rejects too many items', () => {
    const many = Array.from({ length: 21 }, (_, i) => `Issue ${i}`);
    assert.throws(
      () => normalizeRecoveredHealthIssues({ recoveredHealthIssues: many }),
      (err) => err?.status === 422,
    );
  });

  it('rejects too-long labels', () => {
    assert.throws(
      () => normalizeRecoveredHealthIssues({
        recoveredHealthIssues: ['x'.repeat(121)],
      }),
      (err) => err?.status === 422,
    );
  });
});

describe('validateCreateCard recoveredHealthIssues', () => {
  const base = { createdBy: 1, name: 'Ada' };

  it('includes empty array by default', () => {
    const out = validateCreateCard(base);
    assert.deepEqual(out.recoveredHealthIssues, []);
  });

  it('includes normalized issues', () => {
    const out = validateCreateCard({
      ...base,
      recoveredHealthIssues: ['Back Pain'],
    });
    assert.deepEqual(out.recoveredHealthIssues, ['Back Pain']);
  });
});
