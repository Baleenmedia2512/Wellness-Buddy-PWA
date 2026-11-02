/**
 * Run: node --test backend/shared/lib/ai-orchestration/__tests__/RetryPolicy.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  withEnterpriseRetry,
  DEFAULT_TIMEOUT_MS,
} from '../RetryPolicy.js';

describe('RetryPolicy defaults', () => {
  it('uses 58s per-attempt timeout by default (Gemini p95 ~43s under Vercel 60s)', () => {
    assert.equal(DEFAULT_TIMEOUT_MS, 58_000);
  });
});

describe('withEnterpriseRetry timeout vs late resolve', () => {
  it('returns the result when fn resolves before timeout', async () => {
    const { result, attempts } = await withEnterpriseRetry(
      async () => 'ok',
      { label: 'test', maxAttempts: 1, timeoutMs: 200, useCircuitBreaker: false },
    );
    assert.equal(result, 'ok');
    assert.equal(attempts, 1);
  });

  it('times out when fn never settles', async () => {
    await assert.rejects(
      () =>
        withEnterpriseRetry(
          () => new Promise(() => {}),
          { label: 'test', maxAttempts: 1, timeoutMs: 50, useCircuitBreaker: false },
        ),
      (err) => err?.code === 'TIMEOUT',
    );
  });

  it('returns results that finish under the timeout (near-limit latency)', async () => {
    const { result } = await withEnterpriseRetry(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve('near-limit-ok'), 30);
        }),
      { label: 'test', maxAttempts: 1, timeoutMs: 200, useCircuitBreaker: false },
    );
    assert.equal(result, 'near-limit-ok');
  });
});
