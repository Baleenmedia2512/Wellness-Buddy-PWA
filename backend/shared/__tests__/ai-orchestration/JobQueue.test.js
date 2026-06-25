/**
 * Unit tests — JobQueue
 *
 * Tests the in-memory JobQueue without Supabase I/O.
 * Supabase persistence is mocked so the tests are fully isolated.
 */
import { JobQueue, JOB_STATUS } from '../../lib/ai-orchestration/JobQueue.js';
import logger from '../../lib/logger.js';

// ── Silence logger noise ──────────────────────────────────────────────────────
beforeEach(() => {
  jest.spyOn(logger, 'info').mockImplementation(() => {});
  jest.spyOn(logger, 'warn').mockImplementation(() => {});
  jest.spyOn(logger, 'error').mockImplementation(() => {});
});
afterEach(() => { jest.restoreAllMocks(); });

// ── Mock Supabase so _persistToSupabase is a no-op ───────────────────────────
jest.mock('../../../utils/supabaseClient.js', () => ({
  getSupabaseClient: () => ({
    from: () => ({
      upsert: async () => ({ error: null }),
    }),
  }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeQueue() { return new JobQueue(); }

function jobPayload(overrides = {}) {
  return {
    captureId:    'cap-1',
    userId:       'user-1',
    traceId:      'trace-1',
    imageBase64:  'abc123',
    mimeType:     'image/jpeg',
    fastNutrition: { calories: 300 },
    foodRowId:    42,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('JobQueue — enqueue()', () => {
  it('returns a jobId UUID', async () => {
    const q = makeQueue();
    const { jobId } = await q.enqueue(jobPayload());
    expect(jobId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('stores the job as PENDING', async () => {
    const q = makeQueue();
    const { jobId } = await q.enqueue(jobPayload());
    const job = await q.getJob(jobId);
    expect(job.status).toBe(JOB_STATUS.PENDING);
  });

  it('uses PENDING as initial status', async () => {
    const q = makeQueue();
    const { jobId } = await q.enqueue(jobPayload());
    expect((await q.getJob(jobId)).status).toBe(JOB_STATUS.PENDING);
  });

  it('stores captureId, userId, traceId faithfully', async () => {
    const q = makeQueue();
    const { jobId } = await q.enqueue(jobPayload({ captureId: 'C', userId: 'U', traceId: 'T' }));
    const job = await q.getJob(jobId);
    expect(job.captureId).toBe('C');
    expect(job.userId).toBe('U');
    expect(job.traceId).toBe('T');
  });
});

describe('JobQueue — claimNext()', () => {
  it('returns null when queue is empty', async () => {
    const q = makeQueue();
    expect(await q.claimNext()).toBeNull();
  });

  it('transitions the job to PROCESSING', async () => {
    const q = makeQueue();
    const { jobId } = await q.enqueue(jobPayload());
    const claimed = await q.claimNext();
    expect(claimed.jobId).toBe(jobId);
    expect(claimed.status).toBe(JOB_STATUS.PROCESSING);
  });

  it('returns null when only PROCESSING jobs exist', async () => {
    const q = makeQueue();
    await q.enqueue(jobPayload());
    await q.claimNext(); // claims it
    expect(await q.claimNext()).toBeNull();
  });

  it('claims jobs FIFO (oldest first)', async () => {
    const q = makeQueue();
    const { jobId: id1 } = await q.enqueue(jobPayload({ captureId: 'first' }));
    await q.enqueue(jobPayload({ captureId: 'second' }));
    const first = await q.claimNext();
    expect(first.jobId).toBe(id1);
  });
});

describe('JobQueue — markCompleted()', () => {
  it('sets status to COMPLETED', async () => {
    const q = makeQueue();
    const { jobId } = await q.enqueue(jobPayload());
    await q.claimNext();
    await q.markCompleted(jobId);
    expect((await q.getJob(jobId)).status).toBe(JOB_STATUS.COMPLETED);
  });

  it('is a no-op for an unknown jobId', async () => {
    const q = makeQueue();
    await expect(q.markCompleted('unknown-id')).resolves.not.toThrow();
  });
});

describe('JobQueue — markFailed()', () => {
  it('re-queues as PENDING when retryCount < MAX_RETRIES', async () => {
    const q = makeQueue();
    const { jobId } = await q.enqueue(jobPayload());
    await q.claimNext();
    await q.markFailed(jobId, 'transient error');
    const job = await q.getJob(jobId);
    expect(job.status).toBe(JOB_STATUS.PENDING);
    expect(job.retryCount).toBe(1);
    expect(job.lastError).toBe('transient error');
  });

  it('permanently fails when retryCount reaches MAX_RETRIES (3)', async () => {
    const q = makeQueue();
    const { jobId } = await q.enqueue(jobPayload());
    // Simulate 3 failures
    for (let i = 0; i < 3; i += 1) {
      await q.claimNext();
      await q.markFailed(jobId, 'err');
    }
    const job = await q.getJob(jobId);
    expect(job.status).toBe(JOB_STATUS.FAILED);
    expect(job.retryCount).toBe(3);
  });
});

describe('JobQueue — getJob()', () => {
  it('returns null for unknown jobId', async () => {
    const q = makeQueue();
    expect(await q.getJob('no-such-id')).toBeNull();
  });

  it('returns a snapshot (mutations do not affect returned object)', async () => {
    const q = makeQueue();
    const { jobId } = await q.enqueue(jobPayload());
    const snapshot = await q.getJob(jobId);
    snapshot.status = 'mutated';
    expect((await q.getJob(jobId)).status).toBe(JOB_STATUS.PENDING);
  });
});

describe('JobQueue — stats()', () => {
  it('reflects current queue depth', async () => {
    const q = makeQueue();
    await q.enqueue(jobPayload({ captureId: 'a' }));
    await q.enqueue(jobPayload({ captureId: 'b' }));
    const { jobId } = await q.enqueue(jobPayload({ captureId: 'c' }));
    await q.claimNext();       // a → PROCESSING
    await q.markCompleted(jobId); // c → COMPLETED (direct, without claiming)

    // State: a=PROCESSING, b=PENDING, c=COMPLETED
    const stats = q.stats();
    expect(stats.pending).toBe(1);     // only b
    expect(stats.processing).toBe(1);  // a
    expect(stats.completed).toBe(1);   // c
    expect(stats.total).toBe(3);
  });
});

describe('JobQueue — stuck-job reclaim', () => {
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.useRealTimers(); });

  it('re-queues a job stuck in PROCESSING for > 5 minutes', async () => {
    const q = makeQueue();
    const { jobId } = await q.enqueue(jobPayload());
    await q.claimNext(); // → PROCESSING

    // Advance past the 5-minute claim timeout
    jest.advanceTimersByTime(5 * 60 * 1_000 + 1_000);

    // Next claimNext() call should reclaim the stuck job
    const reclaimed = await q.claimNext();
    expect(reclaimed.jobId).toBe(jobId);
  });
});

describe('JobQueue — onJobEnqueued listener', () => {
  it('notifies registered listeners when a job is enqueued', async () => {
    const q = makeQueue();
    const listener = jest.fn();
    q.onJobEnqueued(listener);
    await q.enqueue(jobPayload());
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
