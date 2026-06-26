/**
 * backend/shared/lib/ai-orchestration/JobQueue.js
 * ---------------------------------------------------------------------------
 * Async job queue for the AI analysis pipeline.
 *
 * Architecture:
 *   Capture Created
 *     → enqueue(job)           ← route handler / orchestrator
 *     → worker picks job       ← /api/ai/worker (cron or direct trigger)
 *     → enrichNutrition runs
 *     → persistEnrichment      ← writes back to food_nutrition_data_table
 *     → notifyComplete         ← Supabase Realtime broadcast / polling
 *
 * Backing store (two-tier):
 *   1. In-process Map  — zero-latency, survives within a Vercel function lifetime.
 *   2. Supabase table  — durable, survives cold starts & multi-instance Vercel.
 *      Table: ai_analysis_jobs_table (see migration in docs/migrations/)
 *      Falls back gracefully if the table does not exist (e.g., local dev without migration).
 *
 * Job shape:
 *   {
 *     jobId        : string (UUID)
 *     captureId    : string
 *     userId       : string
 *     traceId      : string
 *     imageBase64  : string
 *     mimeType     : string
 *     fastNutrition: object   ← fast-analysis context for the enrichment prompt
 *     foodRowId    : number   ← food_nutrition_data_table PK to update
 *     status       : 'pending' | 'processing' | 'completed' | 'failed'
 *     retryCount   : number
 *     createdAt    : number (epoch ms)
 *     updatedAt    : number (epoch ms)
 *   }
 *
 * Usage:
 *   import { jobQueue } from './JobQueue.js';
 *   const job = await jobQueue.enqueue({ captureId, userId, ... });
 *   const pending = await jobQueue.claimNext();
 *   await jobQueue.markCompleted(job.jobId);
 * ---------------------------------------------------------------------------
 */

import { randomUUID } from 'crypto';
import logger from '../logger.js';

// ── Job status enum ───────────────────────────────────────────────────────────
export const JOB_STATUS = Object.freeze({
  PENDING:    'pending',
  PROCESSING: 'processing',
  COMPLETED:  'completed',
  FAILED:     'failed',
});

// ── Constants ─────────────────────────────────────────────────────────────────
const MAX_RETRIES     = 3;
const JOB_TTL_MS      = 60 * 60 * 1_000; // 1 hour — prune stale jobs
const CLAIM_TIMEOUT_MS = 5 * 60 * 1_000; // Re-queue jobs stuck in PROCESSING > 5 min

// ── JobQueue class ────────────────────────────────────────────────────────────
export class JobQueue {
  constructor() {
    /** @type {Map<string, object>} In-process store (ephemeral). */
    this._jobs = new Map();

    /** @type {(() => void)[]} Registered listeners for new jobs. */
    this._listeners = [];
  }

  // ── Enqueue ─────────────────────────────────────────────────────────────────

  /**
   * Enqueue a new enrichment analysis job.
   *
   * @param {object} params
   * @param {string} params.captureId
   * @param {string} params.userId
   * @param {string} params.traceId
   * @param {string} params.imageBase64
   * @param {string} params.mimeType
   * @param {object}   params.fastNutrition   Macro context for enrichment prompt.
   * @param {string[]} params.foodItems        Identified food item names (for enrichment prompt).
   * @param {number}   params.foodRowId        food_nutrition_data_table PK.
   * @returns {Promise<{ jobId: string }>}
   */
  async enqueue({ captureId, userId, traceId, imageBase64, mimeType, fastNutrition, foodItems, foodRowId }) {
    const jobId = randomUUID();
    const now   = Date.now();

    const job = {
      jobId,
      captureId:     String(captureId ?? ''),
      userId:        String(userId    ?? ''),
      traceId:       String(traceId   ?? ''),
      imageBase64,
      mimeType:      mimeType ?? 'image/jpeg',
      fastNutrition: fastNutrition ?? {},
      foodItems:     Array.isArray(foodItems) ? foodItems : [],
      foodRowId:     foodRowId ?? null,
      status:        JOB_STATUS.PENDING,
      retryCount:    0,
      createdAt:     now,
      updatedAt:     now,
    };

    this._jobs.set(jobId, job);
    this._notifyListeners();

    logger.info('jobQueue: enqueued enrichment job', {
      jobId,
      captureId: job.captureId,
      userId:    job.userId,
      traceId:   job.traceId,
    });

    // Best-effort persist to Supabase (non-blocking, non-fatal)
    this._persistToSupabase(job).catch(err => {
      logger.warn('jobQueue: Supabase persist failed (in-memory only)', { jobId, error: err.message });
    });

    return { jobId };
  }

  // ── Claim ───────────────────────────────────────────────────────────────────

  /**
   * Atomically claim the next pending job for processing.
   * Re-queues jobs that have been PROCESSING for > CLAIM_TIMEOUT_MS (stale worker crash).
   *
   * @returns {Promise<object|null>} The claimed job, or null if queue is empty.
   */
  async claimNext() {
    this._reclaimStuck();
    this._pruneExpired();

    for (const [, job] of this._jobs.entries()) {
      if (job.status === JOB_STATUS.PENDING) {
        job.status    = JOB_STATUS.PROCESSING;
        job.updatedAt = Date.now();

        logger.info('jobQueue: claimed job', {
          jobId:      job.jobId,
          captureId:  job.captureId,
          retryCount: job.retryCount,
        });

        return { ...job };
      }
    }

    return null;
  }

  // ── Terminal state transitions ───────────────────────────────────────────────

  /**
   * Mark a job as successfully completed.
   * @param {string} jobId
   */
  async markCompleted(jobId) {
    const job = this._jobs.get(jobId);
    if (!job) return;
    job.status    = JOB_STATUS.COMPLETED;
    job.updatedAt = Date.now();
    logger.info('jobQueue: job completed', { jobId, captureId: job.captureId });
  }

  /**
   * Mark a job as failed. If retryCount < MAX_RETRIES, reset to PENDING for retry.
   * @param {string} jobId
   * @param {string} [errorMessage]
   */
  async markFailed(jobId, errorMessage = '') {
    const job = this._jobs.get(jobId);
    if (!job) return;

    job.retryCount += 1;
    job.lastError   = errorMessage;
    job.updatedAt   = Date.now();

    if (job.retryCount < MAX_RETRIES) {
      job.status = JOB_STATUS.PENDING; // schedule retry
      logger.warn('jobQueue: job failed — scheduling retry', {
        jobId,
        retryCount: job.retryCount,
        maxRetries: MAX_RETRIES,
        error:      errorMessage,
      });
    } else {
      job.status = JOB_STATUS.FAILED;  // permanent failure
      logger.error('jobQueue: job permanently failed', {
        jobId,
        captureId:  job.captureId,
        retryCount: job.retryCount,
        error:      errorMessage,
      });
    }
  }

  // ── Inspection ───────────────────────────────────────────────────────────────

  /**
   * Get a job by ID (for status polling endpoints).
   * @param {string} jobId
   * @returns {object|null}
   */
  async getJob(jobId) {
    const job = this._jobs.get(jobId);
    return job ? { ...job } : null;
  }

  /**
   * Current queue depth by status.
   */
  stats() {
    const counts = { pending: 0, processing: 0, completed: 0, failed: 0 };
    for (const job of this._jobs.values()) {
      counts[job.status] = (counts[job.status] ?? 0) + 1;
    }
    return { ...counts, total: this._jobs.size };
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  /** Re-queue jobs stuck in PROCESSING (e.g., after a worker crash). */
  _reclaimStuck() {
    const cutoff = Date.now() - CLAIM_TIMEOUT_MS;
    for (const job of this._jobs.values()) {
      if (job.status === JOB_STATUS.PROCESSING && job.updatedAt < cutoff) {
        logger.warn('jobQueue: reclaiming stuck job', { jobId: job.jobId, stuckMs: Date.now() - job.updatedAt });
        job.status    = JOB_STATUS.PENDING;
        job.updatedAt = Date.now();
      }
    }
  }

  /** Remove jobs older than JOB_TTL_MS in a terminal state. */
  _pruneExpired() {
    const cutoff = Date.now() - JOB_TTL_MS;
    for (const [id, job] of this._jobs.entries()) {
      const terminal = job.status === JOB_STATUS.COMPLETED || job.status === JOB_STATUS.FAILED;
      if (terminal && job.updatedAt < cutoff) {
        this._jobs.delete(id);
      }
    }
  }

  /** Alert any registered listeners (e.g. in-process worker loop). */
  _notifyListeners() {
    for (const fn of this._listeners) {
      try { fn(); } catch (_) { /* ignore */ }
    }
  }

  /** Register a callback to be invoked when a new job is enqueued. */
  onJobEnqueued(fn) {
    this._listeners.push(fn);
  }

  /**
   * Best-effort persist to Supabase ai_analysis_jobs_table.
   * Fails silently if the table does not yet exist.
   */
  async _persistToSupabase(job) {
    // Dynamic import avoids circular dependency with supabaseClient at module load
    const { getSupabaseClient } = await import('../../../utils/supabaseClient.js');
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('ai_analysis_jobs_table')
      .upsert({
        JobId:        job.jobId,
        CaptureId:    job.captureId,
        UserID:       job.userId,
        TraceId:      job.traceId,
        MimeType:     job.mimeType,
        FastNutrition: JSON.stringify(job.fastNutrition),
        FoodItems:    JSON.stringify(job.foodItems ?? []),
        FoodRowId:    job.foodRowId,
        Status:       job.status,
        RetryCount:   job.retryCount,
        CreatedAt:    new Date(job.createdAt).toISOString(),
        UpdatedAt:    new Date(job.updatedAt).toISOString(),
      }, { onConflict: 'JobId' });

    if (error && !error.message?.includes('does not exist')) {
      throw error;
    }
  }
}

// ── Module singleton ──────────────────────────────────────────────────────────
export const jobQueue = new JobQueue();
