/**
 * backend/shared/lib/ai-orchestration/IdempotencyGuard.js
 * ---------------------------------------------------------------------------
 * Duplicate-capture protection for the AI analysis pipeline.
 *
 * A capture that arrives more than once within WINDOW_MS is detected as a
 * duplicate and the cached result is returned instead of re-invoking Gemini.
 * This makes every worker run replay-safe and prevents double token spend.
 *
 * Backing store:
 *   Default: in-process Map (correct for single-instance dev/staging; resets
 *            on cold start, which is acceptable — it just re-analyses once).
 *   Production upgrade: swap _store for a Redis client or Supabase RPC
 *                       without changing the public interface.
 *
 * Eviction:
 *   - Time-based: entries older than windowMs are pruned on every access.
 *   - Size-based: when the map exceeds maxEntries, oldest entries are dropped.
 *
 * Usage:
 *   import { idempotencyGuard } from './IdempotencyGuard.js';
 *
 *   const check = idempotencyGuard.check(captureId);
 *   if (check.duplicate) return check.entry.result;  // fast-path
 *
 *   idempotencyGuard.register(captureId);
 *   const result = await analyse(image);
 *   idempotencyGuard.complete(captureId, result);
 * ---------------------------------------------------------------------------
 */

import logger from '../logger.js';

const DEFAULT_WINDOW_MS  = 5 * 60 * 1_000; // 5 minutes
const DEFAULT_MAX_ENTRIES = 1_000;

// ── Entry status enum ─────────────────────────────────────────────────────────
export const JOB_STATUS = Object.freeze({
  PROCESSING: 'processing',
  COMPLETED:  'completed',
  FAILED:     'failed',
});

export class IdempotencyGuard {
  /**
   * @param {object} [opts]
   * @param {number} [opts.windowMs=300000]   How long a cache entry is valid.
   * @param {number} [opts.maxEntries=1000]   Hard cap on in-memory entries.
   */
  constructor({ windowMs = DEFAULT_WINDOW_MS, maxEntries = DEFAULT_MAX_ENTRIES } = {}) {
    this.windowMs   = windowMs;
    this.maxEntries = maxEntries;

    /**
     * @type {Map<string, {
     *   submittedAt : number,
     *   status      : string,
     *   traceId     : string | null,
     *   result      ?: object,
     *   errorCode   ?: string,
     * }>}
     */
    this._store = new Map();
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Check whether captureId is already in-flight or recently completed.
   *
   * @param {string | null | undefined} captureId
   * @returns {{ duplicate: false } | { duplicate: true, entry: object }}
   */
  check(captureId) {
    if (!captureId) return { duplicate: false };

    this._evict();

    const entry = this._store.get(String(captureId));
    if (!entry) return { duplicate: false };

    const ageMs = Date.now() - entry.submittedAt;
    if (ageMs > this.windowMs) {
      this._store.delete(String(captureId));
      return { duplicate: false };
    }

    // FAILED entries should NOT be treated as duplicates — they represent
    // captures that were previously misclassified ("other") and are being
    // retried by the user. Always allow a retry for failed entries so the
    // AI gets another chance to classify the image correctly.
    if (entry.status === JOB_STATUS.FAILED) {
      this._store.delete(String(captureId));
      return { duplicate: false };
    }

    logger.info('idempotency: duplicate capture detected', {
      captureId: String(captureId),
      status:    entry.status,
      ageMs,
    });

    return { duplicate: true, entry: { ...entry } };
  }

  /**
   * Register a capture as in-flight.
   * Must be called before starting analysis so concurrent requests are blocked.
   *
   * @param {string} captureId
   * @param {object} [opts]
   * @param {string} [opts.traceId]
   */
  register(captureId, { traceId = null } = {}) {
    if (!captureId) return;

    this._evict();
    this._store.set(String(captureId), {
      submittedAt: Date.now(),
      status:      JOB_STATUS.PROCESSING,
      traceId,
    });

    logger.debug('idempotency: registered', { captureId: String(captureId) });
  }

  /**
   * Mark a capture as successfully completed and cache its result.
   *
   * @param {string} captureId
   * @param {object} result
   */
  complete(captureId, result) {
    if (!captureId) return;

    const entry = this._store.get(String(captureId));
    if (entry) {
      entry.status = JOB_STATUS.COMPLETED;
      entry.result = result;
    }
  }

  /**
   * Mark a capture as failed.
   *
   * @param {string} captureId
   * @param {string} [errorCode]
   */
  fail(captureId, errorCode = 'UNKNOWN_ERROR') {
    if (!captureId) return;

    const entry = this._store.get(String(captureId));
    if (entry) {
      entry.status    = JOB_STATUS.FAILED;
      entry.errorCode = errorCode;
    }
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  /**
   * Remove expired entries; trim to maxEntries by ejecting oldest first.
   */
  _evict() {
    const now = Date.now();

    // Time-based eviction
    for (const [key, entry] of this._store.entries()) {
      if (now - entry.submittedAt > this.windowMs) {
        this._store.delete(key);
      }
    }

    // Size-based eviction: drop the oldest entries when over the cap
    if (this._store.size > this.maxEntries) {
      const excess = this._store.size - this.maxEntries;
      let   evicted = 0;
      for (const key of this._store.keys()) {
        this._store.delete(key);
        if (++evicted >= excess) break;
      }
    }
  }
}

// ── Singleton for the AI orchestration pipeline ───────────────────────────────
export const idempotencyGuard = new IdempotencyGuard();
