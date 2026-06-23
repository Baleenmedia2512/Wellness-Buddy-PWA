/**
 * backend/pages/api/ai/job-status.js
 * ---------------------------------------------------------------------------
 * Enrichment job status polling endpoint.
 *
 * Called by the client to check whether the background enrichment job
 * (micronutrients / vitamins / minerals) has completed after the fast
 * analysis was returned by /api/ai/orchestrate.
 *
 * Request:
 *   GET /api/ai/job-status?jobId=<uuid>
 *
 * Response (200):
 *   {
 *     ok:         true,
 *     jobId:      string,
 *     status:     "pending" | "processing" | "completed" | "failed",
 *     captureId:  string,
 *     retryCount: number,
 *     createdAt:  number,    ← epoch ms
 *     updatedAt:  number,
 *   }
 *
 * The client should poll every 3–5 seconds until status = "completed" | "failed".
 * For push-based notification, subscribe to the Supabase Realtime channel
 * `ai_analysis_jobs_table` filtered by jobId instead of polling.
 * ---------------------------------------------------------------------------
 */

import logger from '../../../shared/lib/logger.js';
import { jobQueue } from '../../../shared/lib/ai-orchestration/JobQueue.js';

// UUID format validation
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      ok: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Only GET allowed' },
    });
  }

  const jobId = (req.query.jobId ?? '').trim();
  if (!jobId || !UUID_RE.test(jobId)) {
    return res.status(400).json({
      ok: false,
      error: { code: 'INVALID_JOB_ID', message: 'jobId must be a valid UUID' },
    });
  }

  try {
    const job = await jobQueue.getJob(jobId);
    if (!job) {
      return res.status(404).json({
        ok: false,
        error: { code: 'JOB_NOT_FOUND', message: 'No job found with the given jobId' },
      });
    }

    // Never expose imageBase64 or internal fields to the client
    return res.status(200).json({
      ok:         true,
      jobId:      job.jobId,
      status:     job.status,
      captureId:  job.captureId,
      traceId:    job.traceId,
      retryCount: job.retryCount,
      lastError:  job.lastError ?? null,
      createdAt:  job.createdAt,
      updatedAt:  job.updatedAt,
    });
  } catch (err) {
    logger.error('job-status: lookup failed', { jobId, error: err.message });
    return res.status(500).json({
      ok: false,
      error: { code: 'STATUS_LOOKUP_ERROR', message: 'Failed to retrieve job status' },
    });
  }
}
