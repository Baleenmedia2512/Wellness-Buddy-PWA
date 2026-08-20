/**
 * Run: node --test backend/features/good-habits/__tests__/save.schema.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateGetHabitImage } from '../validation/save.schema.js';

describe('validateGetHabitImage', () => {
  it('requires id and userId', () => {
    const q = validateGetHabitImage({ id: '9', userId: '1' });
    assert.equal(q.id, '9');
    assert.equal(q.userId, '1');
  });
});
