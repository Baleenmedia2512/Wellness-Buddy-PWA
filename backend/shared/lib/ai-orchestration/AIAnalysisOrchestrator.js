/**
 * backend/shared/lib/ai-orchestration/AIAnalysisOrchestrator.js
 * ---------------------------------------------------------------------------
 * Enterprise AI Analysis Orchestrator — single entry point for all image
 * analysis in the Wellness Valley platform.
 *
 * Replaces the two-call classify→nutrition chain with a three-tier pipeline:
 *
 *   ┌──────────────────────────────────────────────────────────────────────┐
 *   │  CLIENT                                                              │
 *   │    POST /api/ai/orchestrate  (image + captureId + userId)            │
 *   └────────────────────────┬─────────────────────────────────────────────┘
 *                            ▼
 *   ┌──────────────────────────────────────────────────────────────────────┐
 *   │  ORCHESTRATOR                                                        │
 *   │  1. Idempotency check  → return cached result for duplicate captures │
 *   │  2. Fast analysis      → AIGateway.analyzeUnified()  (1 Gemini call) │
 *   │     Returns: imageType + confidence + fastNutrition (4 macros)       │
 *   │  3. Enqueue enrichment job → JobQueue (background, non-blocking)     │
 *   │  4. Return fast result to client  (≤ 2 s perceived latency)          │
 *   └──────────────────────────────────────────────────────────────────────┘
 *                            ▼  (async)
 *   ┌──────────────────────────────────────────────────────────────────────┐
 *   │  JOB WORKER  (triggered by /api/ai/worker cron)                      │
 *   │  5. enrichNutrition  → 21 micronutrient fields (second Gemini call)  │
 *   │  6. Merge into food_nutrition_data_table                             │
 *   │  7. Notify client via Supabase Realtime / polling                   │
 *   └──────────────────────────────────────────────────────────────────────┘
 *
 * Observability per pipeline run:
 *   traceId · captureId · latency per stage · token usage · retry count
 *   · model version · success rate (all emitted as structured log events)
 *
 * All existing API contracts are preserved. Legacy callers using
 * classifyAndAnalyse() from the gemini/ package continue to work.
 *
 * Architecture references:
 *   claude.md §3 (Non-Negotiable #3) — business logic lives in domain/,
 *   not in route handlers. This orchestrator IS the domain for AI analysis.
 * ---------------------------------------------------------------------------
 */

import logger from '../logger.js';
import { TraceContext } from './ObservabilityTracer.js';
import { idempotencyGuard, JOB_STATUS } from './IdempotencyGuard.js';
import { analyzeUnified } from './AIGateway.js';
import { jobQueue } from './JobQueue.js';

// ── Public constants ──────────────────────────────────────────────────────────

/** Confidence threshold below which classification is downgraded to 'other'. */
export const CONFIDENCE_THRESHOLD = 0.80;

/** Fallback returned when fast analysis fails (never crash the capture flow). */
const FAST_FALLBACK = Object.freeze({
  imageType:     'other',
  confidence:    0,
  fastNutrition: null,
  defaulted:     true,
});

// ── Primary entry point ───────────────────────────────────────────────────────

/**
 * Analyse a captured image.
 *
 * Flow:
 *   1. Check idempotency (duplicate detection).
 *   2. Run fast analysis (single Gemini call).
 *   3. For food images, enqueue background enrichment job.
 *   4. Return fast result immediately.
 *
 * @param {object} params
 * @param {Buffer} params.imageBuffer    Raw image bytes.
 * @param {string} params.mimeType       MIME type (e.g. 'image/jpeg').
 * @param {string} [params.captureId]    DB capture identifier (for idempotency + tracing).
 * @param {string} [params.userId]       Caller user ID (for tracing + job context).
 * @param {string} [params.imageBase64]  Base64 image for queuing the enrichment job.
 * @param {number} [params.foodRowId]    food_nutrition_data_table PK (for enrichment write-back).
 *
 * @returns {Promise<OrchestratorResult>}
 */
export async function analyse(params) {
  const {
    imageBuffer,
    mimeType,
    captureId    = null,
    userId       = null,
    imageBase64  = null,
    foodRowId    = null,
  } = params;

  const trace = new TraceContext({ captureId, userId });

  // ── Step 1: Idempotency guard ──────────────────────────────────────────────
  if (captureId) {
    const check = idempotencyGuard.check(captureId);
    if (check.duplicate) {
      logger.info('orchestrator: returning cached result for duplicate capture', {
        captureId,
        status:  check.entry.status,
        traceId: trace.traceId,
      });

      return {
        traceId:       trace.traceId,
        captureId,
        duplicate:     true,
        ...FAST_FALLBACK,
        cachedStatus:  check.entry.status,
        cachedResult:  check.entry.result ?? null,
        enrichmentJobId: null,
        observability: trace.complete({ success: true }),
      };
    }

    // Register capture as in-flight to block concurrent duplicates
    idempotencyGuard.register(captureId, { traceId: trace.traceId });
  }

  // ── Step 2: Fast analysis (single unified Gemini call) ────────────────────
  let fastResult;
  try {
    fastResult = await analyzeUnified(imageBuffer, mimeType, { trace });
  } catch (err) {
    // Graceful degradation — never crash the capture flow
    logger.error('orchestrator: fast analysis failed, using fallback', {
      traceId:   trace.traceId,
      captureId,
      error:     err.message,
      code:      err.code ?? null,
    });

    if (captureId) idempotencyGuard.fail(captureId, err.code ?? 'FAST_ANALYSIS_FAILED');

    trace.complete({ success: false, errorCode: err.code ?? 'FAST_ANALYSIS_FAILED' });

    return {
      traceId:         trace.traceId,
      captureId,
      duplicate:       false,
      ...FAST_FALLBACK,
      error:           err.message,
      enrichmentJobId: null,
      observability:   null,
    };
  }

  // ── Step 3: Enqueue enrichment job (food images only, non-blocking) ────────
  let enrichmentJobId = null;
  if (fastResult.imageType === 'food' && imageBase64) {
    try {
      const { jobId } = await jobQueue.enqueue({
        captureId:    captureId ?? '',
        userId:       userId    ?? '',
        traceId:      trace.traceId,
        imageBase64,
        mimeType,
        fastNutrition: fastResult.fastNutrition ?? {},
        foodRowId,
      });
      enrichmentJobId = jobId;

      logger.info('orchestrator: enrichment job enqueued', {
        jobId,
        traceId:   trace.traceId,
        captureId,
      });
    } catch (err) {
      // Queue failures are non-fatal — client still gets fast result
      logger.warn('orchestrator: failed to enqueue enrichment job', {
        traceId: trace.traceId,
        captureId,
        error:   err.message,
      });
    }
  }

  // ── Step 4: Mark idempotency as completed ──────────────────────────────────
  const result = buildResult({ traceId: trace.traceId, captureId, fastResult, enrichmentJobId });
  if (captureId) idempotencyGuard.complete(captureId, result);

  const observability = trace.complete({ success: true, imageType: fastResult.imageType });

  return { ...result, observability };
}

// ── Result builder ────────────────────────────────────────────────────────────

/**
 * Build the normalised result object returned to callers.
 * @private
 */
function buildResult({ traceId, captureId, fastResult, enrichmentJobId }) {
  return {
    traceId,
    captureId,
    duplicate:        false,
    imageType:        fastResult.imageType,
    confidence:       fastResult.confidence,
    details:          fastResult.details          ?? {},
    fastNutrition:    fastResult.fastNutrition    ?? null,
    weightReading:    fastResult.weightReading    ?? null,
    smartwatchData:   fastResult.smartwatchData   ?? null,
    educationData:    fastResult.educationData    ?? null,
    enrichmentJobId,
    enrichmentStatus: enrichmentJobId ? JOB_STATUS.PROCESSING : null,
  };
}

// ── Legacy compatibility shim ─────────────────────────────────────────────────

/**
 * classifyAndAnalyse — backwards-compatible entry point used by the legacy
 * route handlers (captures.js, detect-image-type.js, etc.).
 *
 * Maps the new orchestrator output shape back to the old shape:
 *   { stage, ok, type, confidence, details, nutrition, pipelineLatencyMs }
 *
 * @param {Buffer} imageBuffer
 * @param {string} mimeType
 * @param {object} [opts]
 * @param {string} [opts.captureId]
 * @param {string} [opts.userId]
 * @returns {Promise<LegacyClassifyResult>}
 */
export async function classifyAndAnalyse(imageBuffer, mimeType, { captureId = null, userId = null } = {}) {
  const pipelineStart = Date.now();

  try {
    const result = await analyse({ imageBuffer, mimeType, captureId, userId });

    // Map fast macros → legacy nutrition shape expected by analysis.service.js
    const legacyNutrition = result.fastNutrition
      ? {
          foods:      [],
          total:      { ...result.fastNutrition },
          confidence: result.confidence >= 0.8 ? 'high' : result.confidence >= 0.5 ? 'medium' : 'low',
        }
      : null;

    return {
      stage:            result.imageType === 'food' ? 'nutrition' : 'classify',
      ok:               !result.defaulted,
      type:             result.imageType,
      confidence:       result.confidence,
      details:          result.details,
      nutrition:        legacyNutrition,
      weightReading:    result.weightReading,
      pipelineLatencyMs: result.observability?.totalLatencyMs ?? (Date.now() - pipelineStart),
      traceId:          result.traceId,
      enrichmentJobId:  result.enrichmentJobId,
    };
  } catch (err) {
    logger.error('orchestrator.classifyAndAnalyse: unhandled error', { error: err.message, captureId });
    return {
      stage:            'classify',
      ok:               false,
      type:             'other',
      confidence:       0,
      details:          {},
      nutrition:        null,
      weightReading:    null,
      pipelineLatencyMs: Date.now() - pipelineStart,
      error:            err.message,
    };
  }
}

/**
 * @typedef {object} OrchestratorResult
 * @property {string}  traceId
 * @property {string|null} captureId
 * @property {boolean} duplicate
 * @property {string}  imageType          'food' | 'weight' | 'education' | 'smartwatch' | 'other'
 * @property {number}  confidence
 * @property {object}  details
 * @property {object|null} fastNutrition  { calories, protein, carbs, fat, fiber }
 * @property {object|null} weightReading  { value, unit }
 * @property {object|null} smartwatchData { caloriesBurned, steps, source }
 * @property {object|null} educationData  { isMeeting, platform }
 * @property {string|null} enrichmentJobId
 * @property {string|null} enrichmentStatus
 * @property {object|null} observability  { traceId, totalLatencyMs, tokenUsage, retryCount }
 * @property {boolean} [defaulted]        true when fallback was used
 * @property {string}  [error]
 *
 * @typedef {object} LegacyClassifyResult
 * @property {'classify'|'nutrition'} stage
 * @property {boolean}  ok
 * @property {string}   type
 * @property {number}   confidence
 * @property {object}   details
 * @property {object|null} nutrition
 * @property {object|null} weightReading
 * @property {number}   pipelineLatencyMs
 * @property {string}   [traceId]
 * @property {string}   [enrichmentJobId]
 * @property {string}   [error]
 */
