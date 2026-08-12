/**
 * Meal detail API validators.
 * Run: node --test backend/features/food-corrections/__tests__/meal-detail.validators.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateMealDetailInput,
  validateMealsBatchInput,
} from '../food-corrections.validators.js';

describe('validateMealDetailInput', () => {
  it('requires userId and id', () => {
    assert.throws(() => validateMealDetailInput({}), /userId/);
    assert.throws(() => validateMealDetailInput({ userId: 'u1' }), /id/);
  });

  it('returns string userId and id', () => {
    const r = validateMealDetailInput({ userId: 42, id: 99 });
    assert.equal(r.userId, '42');
    assert.equal(r.id, '99');
  });
});

describe('validateMealsBatchInput', () => {
  it('parses comma-separated ids', () => {
    const r = validateMealsBatchInput({ userId: 'u1', ids: '10, 20 ,30' });
    assert.deepEqual(r.ids, ['10', '20', '30']);
  });

  it('rejects empty ids', () => {
    assert.throws(() => validateMealsBatchInput({ userId: 'u1', ids: '' }), /ids/);
  });

  it('rejects more than 20 ids', () => {
    const ids = Array.from({ length: 21 }, (_, i) => String(i + 1)).join(',');
    assert.throws(() => validateMealsBatchInput({ userId: 'u1', ids }), /20/);
  });
});
