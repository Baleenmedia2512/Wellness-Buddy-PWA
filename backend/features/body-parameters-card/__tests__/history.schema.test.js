/**
 * Run: node --test backend/features/body-parameters-card/__tests__/history.schema.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateCardHistoryQuery } from '../validation/history.schema.js';

describe('validateCardHistoryQuery', () => {
  it('requires a numeric userId', () => {
    assert.throws(() => validateCardHistoryQuery({}), /userId/);
    assert.throws(() => validateCardHistoryQuery({ userId: 'abc' }), /userId/);
  });

  it('accepts optional viewerUserId', () => {
    assert.deepEqual(
      validateCardHistoryQuery({ userId: '22' }),
      { userId: 22, viewerUserId: null },
    );
    assert.deepEqual(
      validateCardHistoryQuery({ userId: 22, viewerUserId: '8' }),
      { userId: 22, viewerUserId: 8 },
    );
  });
});
