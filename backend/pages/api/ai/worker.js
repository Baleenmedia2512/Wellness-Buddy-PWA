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
 *   Protected by CRON_SECRET or WORKER_SECRET.
 *   Requests without the correct Authorization header are rejected with 401.
 *
 * AI Mode:
 *   After auth, reads ai_credits_config_table.ai_mode_enabled (admin AI Mode).
 *   OFF skips the queue and Gemini. Unknown state fails closed.
 *   Vercel still invokes this route every minute; the switch only skips work.
 *
 * Request:
 *   POST /api/ai/worker
 *   Authorization: Bearer <WORKER_SECRET>
 *   Body (optional JSON):
 *     { "maxJobs": 5 }   ← drain up to N jobs per invocation (default 3)
 * ---------------------------------------------------------------------------
 */

import { drainQueue } from '../../../shared/lib/ai-orchestration/JobWorker.js';
import { jobQueue } from '../../../shared/lib/ai-orchestration/JobQueue.js';
import { getBreakerStates } from '../../../shared/lib/ai-orchestration/RetryPolicy.js';
import { executeAiWorker } from './workerGate.js';

export default async function handler(req, res) {
  const result = await executeAiWorker(req, {
    drain: drainQueue,
    stats: () => jobQueue.stats(),
    breakers: getBreakerStates,
  });
  return res.status(result.status).json(result.body);
}
