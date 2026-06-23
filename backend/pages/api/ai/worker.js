/**
 * backend/pages/api/ai/worker.js
 * ---------------------------------------------------------------------------
 * Enrichment worker trigger endpoint.
 *
 * Called by Vercel Cron Jobs (or a one-off HTTP request) to process pending
 * enrichment jobs in the queue.
 *
 * Cron schedule (vercel.json):
 *   { "path": "/api/ai/worker", "schedule": "* * * * *" }   ← every minute
 *
 * Security:
 *   Protected by WORKER_SECRET environment variable.
 *   Requests without the correct Authorization header are rejected with 401.
 *   Set WORKER_SECRET to a strong random string in Vercel env vars.
 *
 * Request:
 *   POST /api/ai/worker
 *   Authorization: Bearer <WORKER_SECRET>
 *   Body (optional JSON):
 *     { "maxJobs": 5 }   ← drain up to N jobs per invocation (default 3)
 *
 * Response (200):
 *   {
 *     ok:        true,
 *     processed: number,   ← jobs attempted
 *     succeeded: number,
 *     failed:    number,
 *     latencyMs: number,
 *     queueStats: { pending, processing, completed, failed, total },
 *   }
 *
 * Also accepts GET (for cron probes that use GET) with the same auth check.
 * ---------------------------------------------------------------------------
 */

import logger from '../../../shared/lib/logger.js';
import { drainQueue } from '../../../shared/lib/ai-orchestration/JobWorker.js';
import { jobQueue } from '../../../shared/lib/ai-orchestration/JobQueue.js';
import { getBreakerStates } from '../../../shared/lib/ai-orchestration/RetryPolicy.js';

const MAX_JOBS_DEFAULT = 3;
const MAX_JOBS_LIMIT   = 10; // safety cap per invocation

// ── Auth ──────────────────────────────────────────────────────────────────────

function isAuthorised(req) {
  const secret = process.env.WORKER_SECRET;
  if (!secret) {
    // No secret configured — allow in development, deny in production
    if (process.env.NODE_ENV === 'production') return false;
    return true;
  }

  const header = req.headers.authorization ?? '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : '';

  // Constant-time comparison to prevent timing attacks
  if (token.length !== secret.length) return false;
  let diff = 0;
  for (let i = 0; i < token.length; i += 1) {
    diff |= token.charCodeAt(i) ^ secret.charCodeAt(i);
  }
  return diff === 0;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({
      ok: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Only POST or GET allowed' },
    });
  }

  if (!isAuthorised(req)) {
    logger.warn('worker: unauthorised request', {
      method: req.method,
      ip:     req.headers['x-forwarded-for'] ?? 'unknown',
    });
    return res.status(401).json({
      ok: false,
      error: { code: 'UNAUTHORISED', message: 'Invalid or missing worker secret' },
    });
  }

  // Parse maxJobs from POST body (JSON) or query string
  let maxJobs = MAX_JOBS_DEFAULT;
  if (req.method === 'POST' && req.body?.maxJobs) {
    const parsed = parseInt(req.body.maxJobs, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      maxJobs = Math.min(parsed, MAX_JOBS_LIMIT);
    }
  } else if (req.query.maxJobs) {
    const parsed = parseInt(req.query.maxJobs, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      maxJobs = Math.min(parsed, MAX_JOBS_LIMIT);
    }
  }

  const workerStart = Date.now();

  logger.info('worker: starting drain cycle', { maxJobs });

  try {
    const { processed, succeeded, failed } = await drainQueue(maxJobs);
    const latencyMs  = Date.now() - workerStart;
    const queueStats = jobQueue.stats();
    const breakers   = getBreakerStates();

    logger.info('worker: drain cycle completed', {
      processed,
      succeeded,
      failed,
      latencyMs,
      queueStats,
    });

    return res.status(200).json({
      ok: true,
      processed,
      succeeded,
      failed,
      latencyMs,
      queueStats,
      circuitBreakers: breakers,
    });
  } catch (err) {
    logger.error('worker: drain cycle failed', { error: err.message });
    return res.status(500).json({
      ok: false,
      error: { code: 'WORKER_ERROR', message: err.message },
    });
  }
}
