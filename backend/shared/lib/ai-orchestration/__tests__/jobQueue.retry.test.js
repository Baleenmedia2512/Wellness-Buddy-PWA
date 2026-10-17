/**
 * Existing enrichment queue claim, retry, and single-claim behavior.
 * Run: node --test backend/shared/lib/ai-orchestration/__tests__/jobQueue.retry.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { JobQueue, JOB_STATUS } from '../JobQueue.js';

function seed(queue, jobId, patch = {}) {
  const now = Date.now();
  queue._jobs.set(jobId, {
    jobId,
    captureId: jobId,
    userId: '9',
    status: JOB_STATUS.PENDING,
    retryCount: 0,
    createdAt: now,
    updatedAt: now,
    ...patch,
  });
}

describe('JobQueue retry and claim', () => {
  it('claims one pending job and leaves the next pending', async () => {
    const queue = new JobQueue();
    seed(queue, 'a');
    seed(queue, 'b');
    const first = await queue.claimNext();
    const second = await queue.claimNext();
    assert.equal(first.jobId, 'a');
    assert.equal(first.status, JOB_STATUS.PROCESSING);
    assert.equal(second.jobId, 'b');
    assert.equal(queue._jobs.get('a').status, JOB_STATUS.PROCESSING);
    assert.equal(queue._jobs.get('b').status, JOB_STATUS.PROCESSING);
    assert.equal(await queue.claimNext(), null);
  });

  it('returns a failed job to pending until the retry limit, then marks it failed', async () => {
    const queue = new JobQueue();
    seed(queue, 'retry-me');
    const claimed = await queue.claimNext();
    await queue.markFailed(claimed.jobId, 'gemini timeout');
    assert.equal(queue._jobs.get('retry-me').status, JOB_STATUS.PENDING);
    assert.equal(queue._jobs.get('retry-me').retryCount, 1);

    await queue.claimNext();
    await queue.markFailed('retry-me', 'gemini timeout');
    assert.equal(queue._jobs.get('retry-me').status, JOB_STATUS.PENDING);
    assert.equal(queue._jobs.get('retry-me').retryCount, 2);

    await queue.claimNext();
    await queue.markFailed('retry-me', 'gemini timeout');
    assert.equal(queue._jobs.get('retry-me').status, JOB_STATUS.FAILED);
    assert.equal(queue._jobs.get('retry-me').retryCount, 3);
    assert.equal(await queue.claimNext(), null);
  });

  it('reclaims a job stuck in processing and does not claim it twice', async () => {
    const queue = new JobQueue();
    seed(queue, 'stuck', {
      status: JOB_STATUS.PROCESSING,
      updatedAt: Date.now() - (6 * 60 * 1000),
    });
    seed(queue, 'fresh');
    const claimed = await queue.claimNext();
    assert.equal(claimed.jobId, 'stuck');
    assert.equal(queue._jobs.get('stuck').status, JOB_STATUS.PROCESSING);
    assert.equal(queue._jobs.get('fresh').status, JOB_STATUS.PENDING);
    const next = await queue.claimNext();
    assert.equal(next.jobId, 'fresh');
  });
});
