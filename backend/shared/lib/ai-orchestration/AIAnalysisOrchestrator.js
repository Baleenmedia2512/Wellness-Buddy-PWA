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
import { ANALYSIS_STATUS } from './AnalysisStatus.js';
import { analyzeUnified } from './AIGateway.js';
import { jobQueue } from './JobQueue.js';

// ── Per-capture analysis status store ────────────────────────────────────────
// In-process map: captureId → { status, traceId, updatedAt, errorCode? }
// Eviction: entries older than STATUS_TTL_MS are pruned on each write.
const STATUS_TTL_MS  = 10 * 60 * 1_000; // 10 minutes
const _statusStore   = new Map();

function _setStatus(captureId, status, extra = {}) {
  if (!captureId) return;
  const key = String(captureId);

  // Prune stale entries on each write to bound memory
  const now = Date.now();
  for (const [k, v] of _statusStore.entries()) {
    if (now - v.updatedAt > STATUS_TTL_MS) _statusStore.delete(k);
  }

  _statusStore.set(key, { status, updatedAt: now, ...extra });

  logger.info('orchestrator: analysisStatus updated', {
    captureId: key,
    status,
    ...extra,
  });
}

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

  // Transition: PENDING → ANALYZING
  _setStatus(captureId, ANALYSIS_STATUS.ANALYZING, { traceId: trace.traceId });

  // ── Step 2: Fast analysis (single unified Gemini call) ────────────────────
  let fastResult;
  try {
    fastResult = await analyzeUnified(imageBuffer, mimeType, { trace });
  } catch (err) {
    // Graceful degradation — never crash the capture flow
    logger.error('orchestrator: fast analysis failed, using fallback', {
      traceId:   trace.traceId,
      captureId,
      stage:     ANALYSIS_STATUS.ANALYZING,
      error:     err.message,
      code:      err.code ?? null,
    });

    // Transition: ANALYZING → FAILED
    _setStatus(captureId, ANALYSIS_STATUS.FAILED, {
      traceId:   trace.traceId,
      stage:     ANALYSIS_STATUS.ANALYZING,
      errorCode: err.code ?? 'FAST_ANALYSIS_FAILED',
    });
    if (captureId) idempotencyGuard.fail(captureId, err.code ?? 'FAST_ANALYSIS_FAILED');

    trace.complete({ success: false, errorCode: err.code ?? 'FAST_ANALYSIS_FAILED' });

    return {
      traceId:         trace.traceId,
      captureId,
      duplicate:       false,
      ...FAST_FALLBACK,
      analysisStatus:  ANALYSIS_STATUS.FAILED,
      error:           err.message,
      enrichmentJobId: null,
      observability:   null,
    };
  }

  // ── Step 3: Enqueue enrichment job (food images only, non-blocking) ────────
  // NOTE: FAST_COMPLETE is NOT set here. It is set by confirmPersisted() after
  // the caller successfully persists the domain row (food / weight / etc.).
  // This prevents the "READY but data missing" defect.
  let enrichmentJobId = null;
  if (fastResult.imageType === 'food' && imageBase64) {
    try {
      const foodItems = (fastResult.details?.foods ?? []).map(f => f.name).filter(Boolean);
      const { jobId } = await jobQueue.enqueue({
        captureId:    captureId ?? '',
        userId:       userId    ?? '',
        traceId:      trace.traceId,
        imageBase64,
        mimeType,
        fastNutrition: fastResult.fastNutrition ?? {},
        foodItems,
        foodRowId,
      });
      enrichmentJobId = jobId;

      // Transition: will become ENRICHING after FAST_COMPLETE is set
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

  // ── Step 4: Return result — status remains ANALYZING until confirmPersisted()
  // The caller MUST invoke confirmPersisted(captureId) after the domain row
  // is saved, or confirmFailed(captureId) if save fails.
  const result = buildResult({ traceId: trace.traceId, captureId, fastResult, enrichmentJobId });

  const observability = trace.complete({ success: true, imageType: fastResult.imageType });

  return { ...result, observability, analysisStatus: ANALYSIS_STATUS.ANALYZING };
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

// ── Post-persistence status confirmations ────────────────────────────────────
// These are called by domain services (e.g. analysis.service.js,
// weight.service.js) AFTER the domain row is successfully persisted.
// Only then is the capture marked FAST_COMPLETE, preventing the
// "UI shows READY but data is missing" defect.

/**
 * Confirm that the domain row for a capture has been successfully persisted.
 * Transitions analysisStatus from ANALYZING → FAST_COMPLETE, and if an
 * enrichment job was enqueued, immediately to ENRICHING.
 *
 * Must be called by the persistence layer after a successful DB write.
 * Must NOT be called speculatively — only on confirmed success.
 *
 * @param {string} captureId
 * @param {object} [persistedData]   Optional metadata (e.g. { foodRowId }).
 */
export function confirmPersisted(captureId, persistedData = {}) {
  if (!captureId) return;

  _setStatus(captureId, ANALYSIS_STATUS.FAST_COMPLETE, {
    ...persistedData,
    confirmedAt: Date.now(),
  });

  // Also complete the idempotency guard entry so concurrent requests get
  // the cached result rather than triggering a new Gemini call.
  idempotencyGuard.complete(captureId, { analysisStatus: ANALYSIS_STATUS.FAST_COMPLETE, ...persistedData });

  logger.info('orchestrator: capture confirmed as persisted → FAST_COMPLETE', {
    captureId: String(captureId),
    ...persistedData,
  });
}

/**
 * Signal that persistence failed for a capture.
 * Transitions analysisStatus to FAILED and fails the idempotency guard entry
 * so the next request retries rather than receiving a stale "processing" status.
 *
 * Must be called by the persistence layer when the DB write fails.
 *
 * @param {string} captureId
 * @param {string} [errorCode]
 * @param {object} [details]   Additional context for the structured failure log.
 */
export function confirmFailed(captureId, errorCode = 'PERSIST_FAILED', details = {}) {
  if (!captureId) return;

  _setStatus(captureId, ANALYSIS_STATUS.FAILED, {
    errorCode,
    stage: 'persist',
    ...details,
  });

  idempotencyGuard.fail(captureId, errorCode);

  logger.error('orchestrator: capture persistence failed → FAILED', {
    captureId: String(captureId),
    errorCode,
    stage:     'persist',
    ...details,
  });
}

/**
 * Signal that the background enrichment job has completed.
 * Transitions analysisStatus from ENRICHING → COMPLETE.
 *
 * Called by JobWorker after successful micronutrient write-back.
 *
 * @param {string} captureId
 */
export function confirmEnrichmentComplete(captureId) {
  if (!captureId) return;

  _setStatus(captureId, ANALYSIS_STATUS.COMPLETE, { completedAt: Date.now() });

  logger.info('orchestrator: enrichment complete → COMPLETE', {
    captureId: String(captureId),
  });
}

/**
 * Get the current analysis status for a capture.
 * Returns null if the captureId has not been registered (e.g. no orchestrate call).
 *
 * @param {string | null | undefined} captureId
 * @returns {{ status: string, updatedAt: number } | null}
 */
export function getAnalysisStatus(captureId) {
  if (!captureId) return null;
  const entry = _statusStore.get(String(captureId));
  return entry ?? null;
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
