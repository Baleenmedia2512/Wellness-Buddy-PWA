/**
 * frontend/src/shared/services/orchestratorService.js
 * ---------------------------------------------------------------------------
 * Frontend client for POST /api/ai/orchestrate — the single AI entry point.
 *
 * Replaces the old two-step classify → nutrition chain in App.js with one
 * multipart/form-data request to the backend orchestrator.
 *
 * Returns a `detectedType`-compatible object so App.js handleImageSelect()
 * needs minimal changes downstream of this call.
 *
 * Error contract:
 *   Never throws. On any failure (network, timeout, 4xx, 5xx) returns:
 *   { type: 'other', confidence: 0, details: { defaulted: true, error } }
 *
 * Observability:
 *   Emits [TRACE] logs at every stage including captureId, traceId, latency,
 *   and success/failure so they appear alongside backend logs in the console.
 * ---------------------------------------------------------------------------
 */

import { getApiBaseUrl } from '../../config/api.config';
import { debugLog } from '../utils/logger.js';

const API_BASE           = getApiBaseUrl();
const ORCHESTRATE_URL    = `${API_BASE}/api/ai/orchestrate`;
const REQUEST_TIMEOUT_MS = 60_000; // 60 s — parity with old imageTypeDetector

/**
 * Shape returned on any unrecoverable failure.
 * Triggers the 'other' / unknown picker branch in App.js.
 */
const FALLBACK = Object.freeze({
  type:       'other',
  confidence: 0,
  details:    { defaulted: true },
});

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Analyse an image via the backend orchestrator (one Gemini call).
 *
 * Returns a detectedType-compatible object:
 *   { type, confidence, details, duration, traceId?, enrichmentJobId? }
 *
 * App.js reads:
 *   food:       details.foods[], details.total, details.fastNutrition
 *   weight:     details.weightValue, details.unit, details.bmi, etc.
 *   smartwatch: details.caloriesBurned, details.source, details.steps
 *   education:  details.platform, details.participantCount
 *
 * @param {File}   imageFile
 * @param {object} [opts]
 * @param {string|null} [opts.captureId]  DB capture ID — enables idempotency guard.
 * @param {string|null} [opts.userId]     Caller user ID for token audit trail.
 * @param {number|null} [opts.foodRowId]  food_nutrition_data_table PK for enrichment write-back.
 * @returns {Promise<object>}
 */
export async function analyzeImage(
  imageFile,
  { captureId = null, userId = null, foodRowId = null } = {},
) {
  const startTime  = Date.now();
  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  _trace('START', { captureId, userId, size: imageFile?.size ?? 0 });

  try {
    const formData = new FormData();
    formData.append('image', imageFile);
    if (captureId)  formData.append('captureId',  String(captureId));
    if (userId)     formData.append('userId',      String(userId));
    if (foodRowId)  formData.append('foodRowId',   String(foodRowId));

    const response = await fetch(ORCHESTRATE_URL, {
      method: 'POST',
      body:   formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const duration = Date.now() - startTime;

    if (!response.ok) {
      let errCode = `HTTP_${response.status}`;
      let errMsg  = `Server error ${response.status}`;
      try {
        const body = await response.json();
        errCode = body?.error?.code    ?? errCode;
        errMsg  = body?.error?.message ?? errMsg;
      } catch (_) { /* ignore body-parse failure */ }

      _trace('FAIL', { duration, code: errCode, message: errMsg, captureId });
      return { ...FALLBACK, details: { defaulted: true, error: errMsg }, duration };
    }

    const data = await response.json();

    if (!data.ok) {
      const errMsg = data.error?.message ?? 'Orchestration failed';
      _trace('FAIL', { duration, code: data.error?.code, message: errMsg, captureId });
      return { ...FALLBACK, details: { defaulted: true, error: errMsg }, duration };
    }

    _trace('SUCCESS', {
      duration,
      imageType:       data.imageType,
      confidence:      data.confidence,
      traceId:         data.traceId,
      enrichmentJobId: data.enrichmentJobId ?? null,
      duplicate:       data.duplicate       ?? false,
      totalLatencyMs:  data.observability?.totalLatencyMs ?? null,
    });

    return _normalise(data, duration);

  } catch (err) {
    clearTimeout(timeoutId);
    const duration  = Date.now() - startTime;
    const isTimeout = err.name === 'AbortError';
    const errMsg    = isTimeout ? 'timeout' : (err.message ?? 'network error');

    _trace('FAIL', { duration, code: isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR', message: errMsg, captureId });

    return {
      ...FALLBACK,
      details: { defaulted: true, error: errMsg },
      duration,
    };
  }
}

// ── Response normalisation ────────────────────────────────────────────────────

/**
 * Map POST /api/ai/orchestrate response → detectedType shape used by App.js.
 *
 * Merges type-specific fields into `details` so every App.js branch continues
 * to read `detectedType.details.*` without change.
 *
 * @private
 */
function _normalise(data, duration) {
  const type    = data.imageType ?? 'other';
  const details = { ...(data.details ?? {}) };

  // ── FOOD ────────────────────────────────────────────────────────────────────
  if (type === 'food') {
    // fastNutrition is the top-level aggregate. Fall back to details.total when
    // Gemini omits fastNutrition (it is optional in UNIFIED_SCHEMA) so we can
    // still build details.foods from whatever the AI did return.
    const fn = data.fastNutrition ?? data.details?.total ?? null;
    if (fn) {
      // Carry fastNutrition into details for downstream code that reads it.
      details.fastNutrition = fn;

      // Ensure a foods[] array exists (App.js reads detectedType.details.foods).
      // If the updated UNIFIED_PROMPT returned individual items they are already
      // in details.foods; otherwise synthesise a single aggregate row.
      if (!Array.isArray(details.foods) || details.foods.length === 0) {
        details.foods = [_aggregateToFoodItem(fn)];
      }

      // Ensure details.total exists (App.js uses aggregateFoodTotals(foods) but
      // also reads details.total in legacy paths). Include all nutrition fields
      // so sugar/sodium/cholesterol/GI are available without enrichment.
      if (!details.total) {
        details.total = {
          calories:    fn.calories    ?? 0,
          protein:     fn.protein     ?? 0,
          carbs:       fn.carbs       ?? 0,
          fat:         fn.fat         ?? 0,
          fiber:       fn.fiber       ?? 0,
          sugar:       fn.sugar       ?? 0,
          sodium:      fn.sodium      ?? 0,
          cholesterol: fn.cholesterol ?? 0,
          glycemic_index: fn.glycemic_index ?? null,
        };
      }
    }
  }

  // ── WEIGHT ──────────────────────────────────────────────────────────────────
  if (type === 'weight' && data.weightReading) {
    // App.js checks detectedType.details.weightValue (not weightReading.value)
    details.weightValue = data.weightReading.value ?? details.weightValue ?? null;
    details.unit        = data.weightReading.unit  ?? details.unit        ?? 'kg';
    // bmi, bodyFat, muscleMass, bmr may be in details if AI returned them
    // (via updated UNIFIED_PROMPT). Keep whatever is already there; default null.
    details.bmi         = details.bmi        ?? null;
    details.bodyFat     = details.bodyFat    ?? null;
    details.muscleMass  = details.muscleMass ?? null;
    details.bmr         = details.bmr        ?? null;
  }

  // ── SMARTWATCH ───────────────────────────────────────────────────────────────
  if (type === 'smartwatch' && data.smartwatchData) {
    details.caloriesBurned = data.smartwatchData.caloriesBurned ?? details.caloriesBurned ?? 0;
    details.steps          = data.smartwatchData.steps          ?? details.steps          ?? 0;
    details.source         = data.smartwatchData.source         ?? details.source         ?? 'Smartwatch';
  }

  // ── EDUCATION ────────────────────────────────────────────────────────────────
  if (type === 'education' && data.educationData) {
    details.platform         = data.educationData.platform         ?? details.platform         ?? 'Online Meeting';
    details.isMeeting        = data.educationData.isMeeting        ?? details.isMeeting        ?? true;
    details.participantCount = data.educationData.participantCount ?? details.participantCount ?? null;
  }

  return {
    type,
    confidence:      data.confidence      ?? 0,
    details,
    duration,
    // Extended orchestrator fields (App.js may use for polling / tracing)
    traceId:         data.traceId         ?? null,
    enrichmentJobId: data.enrichmentJobId ?? null,
    duplicate:       data.duplicate       ?? false,
    observability:   data.observability   ?? null,
  };
}

/**
 * Build a synthetic single-item food row from aggregate fastNutrition totals.
 * Used only when the AI returns totals without individual items.
 * @private
 */
function _aggregateToFoodItem(fastNutrition) {
  const n = {
    calories:       Math.round(fastNutrition.calories       ?? 0),
    protein:        Math.round(fastNutrition.protein        ?? 0),
    carbs:          Math.round(fastNutrition.carbs          ?? 0),
    fat:            Math.round(fastNutrition.fat            ?? 0),
    fiber:          Math.round(fastNutrition.fiber          ?? 0),
    sugar:          Math.round(fastNutrition.sugar          ?? 0),
    sodium:         Math.round(fastNutrition.sodium         ?? 0),
    cholesterol:    Math.round(fastNutrition.cholesterol    ?? 0),
    glycemic_index: fastNutrition.glycemic_index != null ? Math.round(fastNutrition.glycemic_index) : null,
  };
  return {
    name:     'Meal',
    portion:  'Estimated portion',
    weight_g: null,
    isLiquid: false,
    // Both top-level and nested nutrition for backward compat
    ...n,
    nutrition: n,
  };
}

// ── Observability helper ──────────────────────────────────────────────────────

/**
 * Emit a structured [TRACE] log entry for the orchestrate pipeline stage.
 * Format mirrors backend ObservabilityTracer log events.
 * @private
 */
function _trace(stage, fields = {}) {
  const { captureId, traceId, duration, imageType, confidence,
          enrichmentJobId, code, message, size, userId,
          duplicate, totalLatencyMs } = fields;

  debugLog(
    `[TRACE] orchestrate | stage=${stage}` +
    (captureId       != null ? ` | captureId=${captureId}`             : '') +
    (traceId         != null ? ` | traceId=${traceId}`                 : '') +
    (imageType       != null ? ` | imageType=${imageType}`             : '') +
    (confidence      != null ? ` | confidence=${confidence}`           : '') +
    (duration        != null ? ` | duration=${duration}ms`             : '') +
    (totalLatencyMs  != null ? ` | serverLatency=${totalLatencyMs}ms`  : '') +
    (enrichmentJobId != null ? ` | enrichmentJobId=${enrichmentJobId}` : '') +
    (duplicate       != null ? ` | duplicate=${duplicate}`             : '') +
    (userId          != null ? ` | userId=${userId}`                   : '') +
    (size            != null ? ` | size=${size}B`                      : '') +
    (code            != null ? ` | code=${code}`                       : '') +
    (message         != null ? ` | error="${message}"`                 : ''),
  );
}
