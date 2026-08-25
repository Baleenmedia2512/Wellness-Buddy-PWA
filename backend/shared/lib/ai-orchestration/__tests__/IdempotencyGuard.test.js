/**
 * Run: node --test backend/shared/lib/ai-orchestration/__tests__/IdempotencyGuard.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { IdempotencyGuard, JOB_STATUS } from '../IdempotencyGuard.js';

describe('IdempotencyGuard fresh bypass', () => {
  it('treats fresh=true as non-duplicate and clears prior entry', () => {
    const guard = new IdempotencyGuard({ windowMs: 60_000 });
    guard.register('c1', { traceId: 't1' });
    const blocked = guard.check('c1');
    assert.equal(blocked.duplicate, true);
    assert.equal(blocked.entry.status, JOB_STATUS.PROCESSING);

    const fresh = guard.check('c1', { fresh: true });
    assert.equal(fresh.duplicate, false);
    assert.equal(guard.check('c1').duplicate, false);
  });

  it('allows FAILED captures to retry without fresh', () => {
    const guard = new IdempotencyGuard({ windowMs: 60_000 });
    guard.register('c2');
    guard.fail('c2', 'TIMEOUT');
    assert.equal(guard.check('c2').duplicate, false);
  });
});
