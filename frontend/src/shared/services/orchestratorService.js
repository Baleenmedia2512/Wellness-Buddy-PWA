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
import { computeMealGlycemicIndex } from '../../features/nutrition/domain/mealGlycemicIndex';

const API_BASE           = getApiBaseUrl();
const ORCHESTRATE_URL    = `${API_BASE}/api/ai/orchestrate`;

// ── Retry budget — PHASE 1: fast unified call (type + macros) ─────────────────
//
// Phone drives escalation; backend runs exactly one Gemini call per HTTP request.
//
// Attempt allocation (Flash → Pro):
//   Attempt 1 → Gemini Flash  (backend: 1 try, 55 s hard cap)
//   Attempt 2 → Gemini Pro    (escalation after Flash failure; 1.5 s back-off)
//
// Why only 2 phone attempts / 1 backend attempt:
//   Gemini p95 ≈ 43 s and Vercel maxDuration = 60 s. Nested Pro retries
//   (2 × 30 s) previously killed late SUCCESS responses and burned 5–6 calls.
//   Worst case now: ~55 s + 1.5 s + ~55 s ≈ 111 s across two HTTP requests.
//
// ── PHASE 2: background enrichment job (21 micronutrients) ───────────────────
//
// After a successful Phase 1 the backend enqueues an enrichment job
// (JobQueue → JobWorker) with its own independent retry budget (MAX_RETRIES
// in JobQueue.js). No frontend involvement in Phase 2.
//
/** Maximum Phase 1 frontend attempts (Flash then Pro). */
const MAX_ATTEMPTS    = 2;
/**
 * Per-attempt frontend abort timeout.
 * Backend model timeout defaults to 58s; leave ~1s for JSON + telemetry after success.
 * Must stay at/under Vercel orchestrate maxDuration (60 s).
 */
const REQUEST_TIMEOUT_MS = 59_500;
/** Back-off before Pro escalation (ms). */
const RETRY_DELAY_MS  = 1_500;

/**
 * Confidence threshold above which an AI "other" result is treated as
 * DEFINITIVE — no retry is worth attempting.
 * Raised from 0.7 → 0.9: Pro often recovers what Flash gets wrong at 0.7–0.89,
 * so only skip the escalation when Flash is very confident (≥ 90 %).
 */
const OBVIOUSLY_OTHER_CONFIDENCE = 0.9;

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
  {
    captureId = null,
    userId = null,
    userName = null,
    userEmail = null,
    foodRowId = null,
    onAttempt = null,
    reservationId = null,
    creditGated = false,
  } = {},
) {
  /** @type {AbortController | null} */
  let activeController = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // Attempt 1 = Flash (fast, cheap). Attempt 2 = Pro (escalation).
    const usePro = attempt >= 2;

    // Abort any in-flight attempt before starting the next (prevents overlapping Pro calls).
    if (activeController) {
      try { activeController.abort(); } catch (_) { /* ignore */ }
      activeController = null;
    }

    // Notify the caller before the request so the UI badge updates immediately.
    onAttempt?.({ attempt, total: MAX_ATTEMPTS, usePro });

    const controller = new AbortController();
    activeController = controller;

    const result = await _singleAttempt(imageFile, {
      captureId,
      userId,
      userName,
      userEmail,
      foodRowId,
      attempt,
      usePro,
      reservationId,
      creditGated,
      controller,
    });

    if (activeController === controller) activeController = null;

    // ── Valid classification — return immediately ──────────────────────────
    if (!result.details?.defaulted && result.type !== 'other') return result;

    // ── "Obviously other": AI is highly confident it's none of the 4 types ─
    // Retrying would waste tokens. Surface immediately so the UI shows Manual Log.
    if (result.type === 'other' && !result.details?.defaulted &&
        (result.confidence ?? 0) >= OBVIOUSLY_OTHER_CONFIDENCE) {
      _trace('OBVIOUSLY_OTHER', { attempt, confidence: result.confidence, captureId });
      return { ...result, details: { ...result.details, obviouslyOther: true } };
    }

    // ── Non-retryable client error (4xx) ──────────────────────────────────
    if (result.details?._retryable === false) {
      return { ...result, details: { ...result.details } };
    }

    // ── All attempts exhausted ────────────────────────────────────────────
    if (attempt === MAX_ATTEMPTS) {
      _trace('EXHAUSTED', { attempt, captureId });
      return result;
    }

    // ── Wait before Pro escalation ────────────────────────────────────────
    const delay = RETRY_DELAY_MS;
    _trace('RETRY', { attempt, nextAttempt: attempt + 1, delayMs: delay, usePro: true, captureId });
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
async function _singleAttempt(
  imageFile,
  {
    captureId,
    userId,
    userName,
    userEmail,
    foodRowId,
    attempt,
    usePro = false,
    reservationId = null,
    creditGated = false,
    controller = null,
  }
) {
  const startTime = Date.now();
  const owned = controller ?? new AbortController();
  const timeoutId = setTimeout(() => {
    try { owned.abort(); } catch (_) { /* ignore */ }
  }, REQUEST_TIMEOUT_MS);

  _trace('START', { attempt, captureId, userId, usePro, size: imageFile?.size ?? 0 });

  try {
    const formData = new FormData();
    formData.append('image', imageFile);
    // Always send captureId so retries can update the same diary capture.
    // fresh=1 on attempt 2+ bypasses idempotency (FAILED / hung PROCESSING).
    if (captureId) {
      formData.append('captureId', String(captureId));
      if (attempt > 1) formData.append('fresh', '1');
    }
    if (userId)     formData.append('userId',    String(userId));
    if (userName)   formData.append('userName',  String(userName));
    if (userEmail)  formData.append('userEmail', String(userEmail));
    if (foodRowId)  formData.append('foodRowId', String(foodRowId));
    // Signal backend to use Gemini Pro on this attempt (escalation).
    if (usePro)     formData.append('modelTier', 'pro');
    if (creditGated && reservationId) {
      formData.append('creditGated', '1');
      formData.append('reservationId', String(reservationId));
    }

    const response = await fetch(ORCHESTRATE_URL, {
      method: 'POST',
      body:   formData,
      signal: owned.signal,
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

    // HTTP 200 + ok:true but Gemini failed and orchestrator returned FAST_FALLBACK
    // (imageType other, defaulted:true, analysisStatus FAILED). Treat as technical
    // failure so retries run and AI credits are released, not deducted.
    if (
      data.defaulted === true
      || String(data.analysisStatus || '').toUpperCase() === 'FAILED'
    ) {
      const errMsg = typeof data.error === 'string'
        ? data.error
        : (data.error?.message ?? 'Fast analysis failed');
      _trace('FAIL', {
        attempt,
        duration,
        code: 'FAST_ANALYSIS_FAILED',
        message: errMsg,
        captureId,
      });
      return {
        ...FALLBACK,
        details: { defaulted: true, error: errMsg, _retryable: true },
        duration,
      };
    }

    // Backend returned a cached duplicate result (idempotency guard hit on
    // attempt 1). This happens when two rapid captures share the same captureId.
    // Treat as retryable so attempt 2 gets a fresh classification (captureId is
    // not sent on retry attempts, bypassing the idempotency cache).
    if (data.duplicate) {
      _trace('FAIL', { attempt, duration, code: 'DUPLICATE_CACHE', message: 'Idempotency cache hit — will retry fresh', captureId });
      return { ...FALLBACK, details: { defaulted: true, error: 'duplicate', _retryable: true }, duration };
    }

    // HTTP 200 + ok:true but the payload has no usable data for the detected type.
    // This can happen when Gemini's structured output is incomplete despite the
    // request succeeding — e.g. imageType:'food' but fastNutrition is null, or
    // imageType:'weight' but no weightReading value.  Treat as retryable so the
    // model gets another attempt rather than silently returning empty results.
    const _type = data.imageType;
    const _empty =
      // food: empty only when fastNutrition, details.total (with calories>0),
      // AND details.foods are ALL absent. A zero-filled details.total from
      // Gemini schema defaults is NOT considered present.
      (_type === 'food'       && !data.fastNutrition && !(data.details?.total?.calories > 0) && !(data.details?.foods?.length > 0)) ||
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

  // Preserve top-level failure markers so credit settlement can release holds.
  if (data.defaulted === true) details.defaulted = true;
  if (typeof data.error === 'string' && data.error) details.error = data.error;

  // ── FOOD ────────────────────────────────────────────────────────────────────
  if (type === 'food') {
    // Source priority for MACRO fields (calories, protein, carbs, fat, fiber…):
    //   1. fastNutrition (authoritative — AI fills this first and most reliably)
    //   2. details.total (only when calories > 0 — Gemini sometimes zero-fills)
    //   3. Synthesised from details.foods[] items (sum individual items)
    //
    // Vitamins / minerals come from details.total (26-field Gemini response).
    // fastNutrition only has 9 macro fields — vitamins must come from details.total.
    // We MERGE: accurate macros from macroSource + vitamins from rawTotal.

    const rawTotal = data.details?.total ?? null;
    const rawTotalHasCals = (rawTotal?.calories ?? 0) > 0;

    // Determine the authoritative macro source
    let macroSource = data.fastNutrition ?? (rawTotalHasCals ? rawTotal : null);

    // Final fallback: sum calories/macros across individual food items
    if (!macroSource || !(macroSource.calories > 0)) {
      const foods = Array.isArray(details.foods) ? details.foods : [];
      if (foods.length > 0) {
        macroSource = _sumFoodNutrition(foods) ?? macroSource;
      }
    }

    if (macroSource) {
      details.fastNutrition = macroSource;

      // Ensure a foods[] array exists for downstream consumers
      if (!Array.isArray(details.foods) || details.foods.length === 0) {
        details.foods = [_aggregateToFoodItem(macroSource)];
      }

      // Build details.total: accurate macros merged with vitamins/minerals from
      // Gemini's rawTotal (which has all 26 fields). This preserves any vitamin
      // data the model returned instead of overwriting it with 9-field zeros.
      const vit = rawTotal ?? {};
      details.total = {
        // Macros — always from macroSource (most accurate)
        calories:       macroSource.calories       ?? 0,
        protein:        macroSource.protein        ?? 0,
        carbs:          macroSource.carbs          ?? 0,
        fat:            macroSource.fat            ?? 0,
        fiber:          macroSource.fiber          ?? 0,
        sugar:          macroSource.sugar          ?? vit.sugar       ?? 0,
        sodium:         macroSource.sodium         ?? vit.sodium      ?? 0,
        cholesterol:    macroSource.cholesterol    ?? vit.cholesterol ?? 0,
        glycemic_index: macroSource.glycemic_index ?? vit.glycemic_index ?? null,
        // Vitamins & minerals — from rawTotal (26-field Gemini response)
        vitamin_a:   vit.vitamin_a   ?? 0,
        vitamin_c:   vit.vitamin_c   ?? 0,
        vitamin_d:   vit.vitamin_d   ?? 0,
        vitamin_e:   vit.vitamin_e   ?? 0,
        vitamin_k:   vit.vitamin_k   ?? 0,
        vitamin_b1:  vit.vitamin_b1  ?? 0,
        vitamin_b2:  vit.vitamin_b2  ?? 0,
        vitamin_b3:  vit.vitamin_b3  ?? 0,
        vitamin_b6:  vit.vitamin_b6  ?? 0,
        vitamin_b9:  vit.vitamin_b9  ?? 0,
        vitamin_b12: vit.vitamin_b12 ?? 0,
        calcium:     vit.calcium     ?? 0,
        iron:        vit.iron        ?? 0,
        magnesium:   vit.magnesium   ?? 0,
        potassium:   vit.potassium   ?? 0,
        zinc:        vit.zinc        ?? 0,
        phosphorus:  vit.phosphorus  ?? 0,
      };
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

/**
 * Sum individual food items' nutrition to build an aggregate total.
 * Used as a last-resort fallback when fastNutrition and details.total
 * are both absent or zero-filled.
 * Returns null when no item has non-zero calories.
 * @private
 */
function _sumFoodNutrition(foods) {
  const MACRO_KEYS = ['calories','protein','carbs','fat','fiber','sugar','sodium','cholesterol'];
  const totals = {};
  MACRO_KEYS.forEach((k) => { totals[k] = 0; });

  for (const food of foods) {
    const n = food.nutrition ?? food;
    MACRO_KEYS.forEach((k) => { totals[k] += Number(n[k]) || 0; });
  }

  // Meal GI = carb-weighted average (available carbs), never a sum of item GIs
  totals.glycemic_index = computeMealGlycemicIndex(foods);

  return totals.calories > 0 ? totals : null;
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
