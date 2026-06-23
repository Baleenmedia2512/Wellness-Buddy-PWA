/**
 * backend/shared/lib/ai-orchestration/JobWorker.js
 * ---------------------------------------------------------------------------
 * Async enrichment job processor.
 *
 * Responsibilities:
 *   1. Claim the next pending job from the queue.
 *   2. Decode the base64 image.
 *   3. Call AIGateway.enrichNutrition with the fast-nutrition context.
 *   4. Merge enrichment fields back into food_nutrition_data_table.
 *   5. Mark the job completed or failed (with retry scheduling).
 *
 * Triggered by:
 *   - /api/ai/worker  (HTTP cron, called every minute by Vercel Cron Jobs)
 *   - Direct invocation in tests
 *
 * Design constraints:
 *   - One job per worker invocation keeps Vercel function duration predictable.
 *   - The caller (route handler) decides concurrency (e.g. Promise.all × N).
 *   - All Gemini calls go through AIGateway (never direct geminiClient access).
 *   - Enrichment failures are non-fatal: partial food rows remain usable.
 * ---------------------------------------------------------------------------
 */

import logger from '../logger.js';
import { TraceContext } from './ObservabilityTracer.js';
import { enrichNutrition } from './AIGateway.js';
import { jobQueue, JOB_STATUS } from './JobQueue.js';
import { confirmEnrichmentComplete } from './AIAnalysisOrchestrator.js';

// ── Micronutrient column mapping ──────────────────────────────────────────────
// Maps enrichment JSON keys → food_nutrition_data_table PascalCase columns.
const ENRICHMENT_TO_DB = Object.freeze({
  sugar:          'TotalSugar',
  sodium:         'TotalSodium',
  cholesterol:    'TotalCholesterol',
  glycemic_index: 'GlycemicIndex',
  vitamin_a:      'TotalVitaminA',
  vitamin_c:      'TotalVitaminC',
  vitamin_d:      'TotalVitaminD',
  vitamin_e:      'TotalVitaminE',
  vitamin_k:      'TotalVitaminK',
  vitamin_b1:     'TotalVitaminB1',
  vitamin_b2:     'TotalVitaminB2',
  vitamin_b3:     'TotalVitaminB3',
  vitamin_b6:     'TotalVitaminB6',
  vitamin_b9:     'TotalVitaminB9',
  vitamin_b12:    'TotalVitaminB12',
  calcium:        'TotalCalcium',
  iron:           'TotalIron',
  magnesium:      'TotalMagnesium',
  potassium:      'TotalPotassium',
  zinc:           'TotalZinc',
  phosphorus:     'TotalPhosphorus',
});

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Convert enrichment JSON result to a DB update payload.
 * @param {object} enrichment
 * @returns {object}
 */
function enrichmentToDbPayload(enrichment) {
  const payload = {};
  for (const [jsonKey, dbCol] of Object.entries(ENRICHMENT_TO_DB)) {
    const val = enrichment[jsonKey];
    if (val != null) payload[dbCol] = val;
  }
  return payload;
}

/**
 * Persist enrichment results back into food_nutrition_data_table.
 * @param {number} foodRowId
 * @param {object} enrichmentPayload  DB column → value map.
 */
async function persistEnrichment(foodRowId, enrichmentPayload) {
  if (!foodRowId || Object.keys(enrichmentPayload).length === 0) return;

  // Dynamic import avoids circular dependency at module load
  const { getSupabaseClient } = await import('../../../utils/supabaseClient.js');
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('food_nutrition_data_table')
    .update({ ...enrichmentPayload, EnrichmentStatus: 'completed' })
    .eq('"ID"', foodRowId);

  if (error) {
    const err = new Error(`persistEnrichment: DB update failed — ${error.message}`);
    err.code  = 'DB_UPDATE_FAILED';
    throw err;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Process one enrichment job.
 *
 * @returns {Promise<{
 *   processed : boolean,
 *   jobId     : string | null,
 *   success   : boolean,
 *   latencyMs : number,
 * }>}
 */
export async function processNextJob() {
  const workerStart = Date.now();

  // 1. Claim the next job (atomic: status PENDING → PROCESSING)
  const job = await jobQueue.claimNext();
  if (!job) {
    return { processed: false, jobId: null, success: false, latencyMs: 0 };
  }

  const trace = new TraceContext({
    captureId: job.captureId,
    userId:    job.userId,
    traceId:   job.traceId,   // Replay the original traceId for correlation
  });

  logger.info('jobWorker: starting enrichment', {
    jobId:      job.jobId,
    captureId:  job.captureId,
    retryCount: job.retryCount,
    traceId:    trace.traceId,
  });

  try {
    // 2. Decode base64 image
    if (!job.imageBase64) {
      throw new Error('jobWorker: imageBase64 is missing from job payload');
    }
    const imageBuffer = Buffer.from(job.imageBase64, 'base64');

    // 3. Run enrichment analysis (micronutrients only)
    const { enrichment } = await enrichNutrition(
      imageBuffer,
      job.mimeType ?? 'image/jpeg',
      job.fastNutrition ?? null,
      { trace },
    );

    // 4. Map and persist to DB
    const dbPayload = enrichmentToDbPayload(enrichment);
    await persistEnrichment(job.foodRowId, dbPayload);

    // 5. Mark job completed
    await jobQueue.markCompleted(job.jobId);

    // 6. Transition analysisStatus ENRICHING → COMPLETE (best-effort)
    if (job.captureId) confirmEnrichmentComplete(job.captureId);

    const summary = trace.complete({ success: true, imageType: 'food' });

    logger.info('jobWorker: enrichment completed', {
      jobId:       job.jobId,
      captureId:   job.captureId,
      fieldsAdded: Object.keys(dbPayload).length,
      latencyMs:   summary.totalLatencyMs,
      tokenUsage:  summary.tokenUsage,
    });

    return {
      processed: true,
      jobId:     job.jobId,
      success:   true,
      latencyMs: Date.now() - workerStart,
    };
  } catch (err) {
    await jobQueue.markFailed(job.jobId, err.message);
    trace.complete({ success: false, errorCode: err.code ?? 'WORKER_ERROR' });

    logger.error('jobWorker: enrichment failed', {
      jobId:      job.jobId,
      captureId:  job.captureId,
      retryCount: job.retryCount + 1,
      error:      err.message,
      code:       err.code ?? null,
    });

    return {
      processed: true,
      jobId:     job.jobId,
      success:   false,
      latencyMs: Date.now() - workerStart,
    };
  }
}

/**
 * Drain up to `maxJobs` pending jobs in sequence.
 * Useful for batch cron runs that want to process multiple jobs per invocation.
 *
 * @param {number} [maxJobs=5]
 * @returns {Promise<{ processed: number, succeeded: number, failed: number }>}
 */
export async function drainQueue(maxJobs = 5) {
  let processed = 0, succeeded = 0, failed = 0;

  for (let i = 0; i < maxJobs; i += 1) {
    const result = await processNextJob();
    if (!result.processed) break; // queue empty

    processed += 1;
    if (result.success) succeeded += 1; else failed += 1;
  }

  return { processed, succeeded, failed };
}
