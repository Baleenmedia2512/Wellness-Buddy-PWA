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

/** Maximum total attempts (1 original + 2 automatic retries). */
const MAX_ATTEMPTS    = 3;
/** Base delay between retries in ms. Doubles each attempt: 1.5 s → 3 s. */
const RETRY_DELAY_MS  = 1_500;

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
 * Automatically retries up to MAX_ATTEMPTS times on transient failures
 * (5xx, timeout, network error) with linear back-off.  Callers never need
 * their own retry logic or a "Try Again" button for transient errors.
 *
 * Returns a detectedType-compatible object:
 *   { type, confidence, details, duration, traceId?, enrichmentJobId? }
 *
 * @param {File}   imageFile
 * @param {object} [opts]
 * @param {string|null} [opts.captureId]
 * @param {string|null} [opts.userId]
 * @param {number|null} [opts.foodRowId]
 * @returns {Promise<object>}
 */
export async function analyzeImage(
  imageFile,
  { captureId = null, userId = null, foodRowId = null } = {},
) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const result = await _singleAttempt(imageFile, { captureId, userId, foodRowId, attempt });

    // Success — return immediately.
    if (!result.details?.defaulted) return result;

    // Non-retryable client error (4xx) — exit without wasting more attempts.
    if (result.details?._retryable === false) {
      return { ...result, details: { ...result.details } };
    }

    // All attempts exhausted — surface the final failure to the caller.
    if (attempt === MAX_ATTEMPTS) {
      _trace('EXHAUSTED', { attempt, captureId });
      return result;
    }

    // Wait before retrying (linear back-off: 1.5 s, 3 s).
    // Wait before retrying. Use a longer back-off for 503 (server overload)
    // so we do not keep flooding an already-saturated Gemini endpoint.
    // Other transient failures (timeout, network blip) use the shorter base.
    const is503 = (result.details?.error ?? '').includes('503');
    const delay = is503 ? 6_000 * attempt : RETRY_DELAY_MS * attempt;
    _trace('RETRY', { attempt, nextAttempt: attempt + 1, delayMs: delay, captureId });
    await new Promise((r) => setTimeout(r, delay));
  }
  /* unreachable — loop always returns before this */
  return FALLBACK;
}

// ── Single attempt ────────────────────────────────────────────────────────────

/**
 * One HTTP attempt to the orchestrator.
 * Never throws. Returns FALLBACK (with _retryable flag) on any error.
 * @private
 */
async function _singleAttempt(imageFile, { captureId, userId, foodRowId, attempt }) {
  const startTime  = Date.now();
  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  _trace('START', { attempt, captureId, userId, size: imageFile?.size ?? 0 });

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

      _trace('FAIL', { attempt, duration, code: errCode, message: errMsg, captureId });
      // 4xx = client error, do not retry. 5xx = server/AI error, retryable.
      const retryable = response.status >= 500;
      return { ...FALLBACK, details: { defaulted: true, error: errMsg, _retryable: retryable }, duration };
    }

    const data = await response.json();

    if (!data.ok) {
      const errMsg = data.error?.message ?? 'Orchestration failed';
      _trace('FAIL', { attempt, duration, code: data.error?.code, message: errMsg, captureId });
      return { ...FALLBACK, details: { defaulted: true, error: errMsg, _retryable: true }, duration };
    }

    // HTTP 200 + ok:true but the payload has no usable data for the detected type.
    // This can happen when Gemini's structured output is incomplete despite the
    // request succeeding — e.g. imageType:'food' but fastNutrition is null, or
    // imageType:'weight' but no weightReading value.  Treat as retryable so the
    // model gets another attempt rather than silently returning empty results.
    const _type = data.imageType;
    const _empty =
      (_type === 'food'       && !data.fastNutrition && !data.details?.total && !(data.details?.foods?.length > 0)) ||
      (_type === 'weight'     && !(data.weightReading?.value > 0))  ||
      (_type === 'smartwatch' && !data.smartwatchData?.caloriesBurned && !data.smartwatchData?.steps) ||
      (_type === 'education'  && !data.educationData?.platform);
    if (_empty) {
      const errMsg = `imageType '${_type}' returned with no payload data`;
      _trace('FAIL', { attempt, duration, code: 'EMPTY_PAYLOAD', message: errMsg, captureId });
      return { ...FALLBACK, details: { defaulted: true, error: errMsg, _retryable: true }, duration };
    }

    _trace('SUCCESS', {
      attempt,
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

    _trace('FAIL', { attempt, duration, code: isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR', message: errMsg, captureId });

    return {
      ...FALLBACK,
      details: { defaulted: true, error: errMsg, _retryable: true },
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
