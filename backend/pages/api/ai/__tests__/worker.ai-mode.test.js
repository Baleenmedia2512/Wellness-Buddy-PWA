/**
 * /api/ai/worker follows the admin AI Mode switch.
 * Run: node --test backend/pages/api/ai/__tests__/worker.ai-mode.test.js
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { executeAiWorker, workerSupabaseHost } from '../workerGate.js';
import { JobQueue, JOB_STATUS, jobQueue } from '../../../../shared/lib/ai-orchestration/JobQueue.js';

const SECRET = 'worker-test-secret';
const ENV_KEYS = ['CRON_SECRET', 'WORKER_SECRET', 'NODE_ENV', 'SUPABASE_URL'];
let savedEnv;

function authedReq(extra = {}) {
  return {
    method: 'GET',
    headers: { authorization: `Bearer ${SECRET}` },
    query: {},
    body: {},
    ...extra,
  };
}

function seedJob(queue, jobId, status = JOB_STATUS.PENDING) {
  const now = Date.now();
  queue._jobs.set(jobId, {
    jobId,
    captureId: `cap-${jobId}`,
    userId: '1',
    status,
    retryCount: 0,
    createdAt: now,
    updatedAt: now,
  });
}

describe('executeAiWorker AI mode gate', { concurrency: 1 }, () => {
  beforeEach(() => {
    savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
    process.env.CRON_SECRET = SECRET;
    process.env.WORKER_SECRET = SECRET;
    process.env.NODE_ENV = 'production';
    process.env.SUPABASE_URL = 'https://staging-project.supabase.co';
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (savedEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[key];
    }
    jobQueue._jobs.clear();
  });

  it('rejects a missing or invalid worker secret before reading AI mode', async () => {
    let reads = 0;
    let drains = 0;
    const missing = await executeAiWorker(
      { method: 'POST', headers: {}, query: {}, body: {} },
      {
        readMode: async () => { reads += 1; return { known: true, enabled: true }; },
        drain: async () => { drains += 1; return { processed: 0, succeeded: 0, failed: 0 }; },
      },
    );
    const wrong = await executeAiWorker(
      authedReq({ headers: { authorization: 'Bearer not-the-secret' } }),
      {
        readMode: async () => { reads += 1; return { known: true, enabled: true }; },
        drain: async () => { drains += 1; return { processed: 0, succeeded: 0, failed: 0 }; },
      },
    );
    assert.equal(missing.status, 401);
    assert.equal(wrong.status, 401);
    assert.equal(reads, 0);
    assert.equal(drains, 0);
  });

  it('does not read or change jobs when AI photo analysis is off', async () => {
    seedJob(jobQueue, 'queued-food');
    let drains = 0;
    const result = await executeAiWorker(authedReq(), {
      readMode: async () => ({ known: true, enabled: false }),
      drain: async () => {
        drains += 1;
        throw new Error('Gemini must not run');
      },
    });
    assert.equal(result.status, 200);
    assert.equal(result.body.skipped, true);
    assert.equal(result.body.reason, 'ai_photo_analysis_off');
    assert.equal(result.body.processed, 0);
    assert.equal(drains, 0);
    assert.equal(jobQueue._jobs.get('queued-food').status, JOB_STATUS.PENDING);
  });

  it('processes at most 3 pending jobs when AI photo analysis is on', async () => {
    const staging = new JobQueue();
    for (let i = 1; i <= 5; i += 1) seedJob(staging, `job-${i}`);
    const production = new JobQueue();
    seedJob(production, 'prod-job');

    let geminiCalls = 0;
    const result = await executeAiWorker(authedReq(), {
      readMode: async () => ({ known: true, enabled: true }),
      drain: async (maxJobs) => {
        assert.equal(maxJobs, 3);
        let processed = 0;
        let succeeded = 0;
        for (let i = 0; i < maxJobs; i += 1) {
          const job = await staging.claimNext();
          if (!job) break;
          geminiCalls += 1;
          await staging.markCompleted(job.jobId);
          processed += 1;
          succeeded += 1;
        }
        return { processed, succeeded, failed: 0 };
      },
    });

    assert.equal(result.status, 200);
    assert.equal(result.body.processed, 3);
    assert.equal(result.body.succeeded, 3);
    assert.equal(geminiCalls, 3);
    assert.equal(staging.stats().completed, 3);
    assert.equal(staging.stats().pending, 2);
    assert.equal(production._jobs.get('prod-job').status, JOB_STATUS.PENDING);
    assert.equal(production.stats().pending, 1);
  });

  it('does not process jobs when the AI mode lookup fails', async () => {
    seedJob(jobQueue, 'stay-pending');
    let drains = 0;
    const result = await executeAiWorker(authedReq(), {
      readMode: async () => {
        const err = new Error('AI photo analysis mode could not be determined');
        err.code = 'AI_MODE_UNKNOWN';
        throw err;
      },
      drain: async () => { drains += 1; return { processed: 1, succeeded: 1, failed: 0 }; },
    });
    assert.equal(result.status, 503);
    assert.equal(result.body.reason, 'ai_mode_unknown');
    assert.equal(result.body.processed, 0);
    assert.equal(drains, 0);
    assert.equal(jobQueue._jobs.get('stay-pending').status, JOB_STATUS.PENDING);
    assert.equal(JSON.stringify(result.body).includes(SECRET), false);
  });

  it('does not process jobs when the saved switch is indeterminate', async () => {
    let drains = 0;
    const result = await executeAiWorker(authedReq(), {
      readMode: async () => ({ known: false, enabled: false }),
      drain: async () => { drains += 1; return { processed: 1, succeeded: 1, failed: 0 }; },
    });
    assert.equal(result.status, 503);
    assert.equal(drains, 0);
  });

  it('uses the staging Supabase host from this process environment', () => {
    const stagingHost = workerSupabaseHost({
      SUPABASE_URL: 'https://staging-project.supabase.co',
    });
    const productionHost = workerSupabaseHost({
      SUPABASE_URL: 'https://production-project.supabase.co',
    });
    assert.equal(stagingHost, 'staging-project.supabase.co');
    assert.notEqual(stagingHost, productionHost);
    assert.equal(
      workerSupabaseHost({ SUPABASE_URL: process.env.SUPABASE_URL }),
      'staging-project.supabase.co',
    );
  });
});
