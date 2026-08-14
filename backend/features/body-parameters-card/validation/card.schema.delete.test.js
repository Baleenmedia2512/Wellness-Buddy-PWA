/**
 * Run: node --test backend/features/body-parameters-card/validation/card.schema.delete.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateDeleteCard } from './card.schema.js';

describe('validateDeleteCard', () => {
  it('accepts id + coachId', () => {
    assert.deepEqual(validateDeleteCard({ id: '42', coachId: '7' }), {
      id: 42,
      coachId: 7,
    });
  });

  it('accepts createdBy as coachId alias', () => {
    assert.deepEqual(validateDeleteCard({ id: 3, createdBy: 9 }), {
      id: 3,
      coachId: 9,
    });
  });

  it('rejects missing id', () => {
    assert.throws(() => validateDeleteCard({ coachId: 1 }), /id is required/);
  });

  it('rejects missing coachId', () => {
    assert.throws(() => validateDeleteCard({ id: 1 }), /coachId is required/);
  });
});
