/**
 * backend/shared/lib/ai-orchestration/AIGateway.js
 * ---------------------------------------------------------------------------
 * Model-agnostic AI abstraction layer.
 *
 * Every AI call enters the system through this file. Business logic and the
 * orchestrator NEVER import geminiClient directly — they call gateway methods.
 * Swapping the underlying model (Gemini → Claude, GPT-4o, etc.) is a one-file
 * change here with zero business-logic impact.
 *
 * Public methods:
 *   analyzeUnified(buf, mime, opts)         Single multimodal call → classify + fast nutrition
 *   classifyImage(buf, mime, opts)          Classify-only shim (backwards-compat)
 *   analyzeNutrition(buf, mime, opts)       Full 26-field nutrition (fast + enrichment)
 *   enrichNutrition(buf, mime, ctx, opts)   Micronutrient enrichment only (background)
 *   detectWeight(buf, mime, opts)           Weight-scale reading shim
 *   detectMeeting(buf, mime, opts)          Education/meeting shim
 *
 * Token efficiency:
 *   - Single unified inference replaces two sequential Gemini calls for food images.
 *   - FAST path (5 macros) is returned synchronously; micronutrients run as a
 *     background enrichment job with a context-aware prompt that avoids
 *     re-analysing macros.
 *   - All model instances are cached singletons (geminiClient).
 *   - Schemas are module-level constants (not rebuilt per request).
 * ---------------------------------------------------------------------------
 */

import logger from '../logger.js';
import { getModel, imageInlinePart, SchemaType } from '../gemini/geminiClient.js';
import { safeParseJson, validateShape } from '../gemini/safeJson.js';
import { withEnterpriseRetry } from './RetryPolicy.js';

const SERVICE = 'gemini';

// ── Schema fragments (module-level constants) ─────────────────────────────────

/** Fast macros: returned inline on every food analysis. */
const FAST_NUTRITION_PROPS = {
  calories: { type: SchemaType.NUMBER },
  protein:  { type: SchemaType.NUMBER },
  carbs:    { type: SchemaType.NUMBER },
  fat:      { type: SchemaType.NUMBER },
  fiber:    { type: SchemaType.NUMBER },
};

/** Enrichment micros: vitamins + minerals returned by background job. */
const ENRICHMENT_PROPS = {
  sugar:          { type: SchemaType.NUMBER },
  sodium:         { type: SchemaType.NUMBER },
  cholesterol:    { type: SchemaType.NUMBER },
  glycemic_index: { type: SchemaType.NUMBER },
  vitamin_a:      { type: SchemaType.NUMBER },
  vitamin_c:      { type: SchemaType.NUMBER },
  vitamin_d:      { type: SchemaType.NUMBER },
  vitamin_e:      { type: SchemaType.NUMBER },
  vitamin_k:      { type: SchemaType.NUMBER },
  vitamin_b1:     { type: SchemaType.NUMBER },
  vitamin_b2:     { type: SchemaType.NUMBER },
  vitamin_b3:     { type: SchemaType.NUMBER },
  vitamin_b6:     { type: SchemaType.NUMBER },
  vitamin_b9:     { type: SchemaType.NUMBER },
  vitamin_b12:    { type: SchemaType.NUMBER },
  calcium:        { type: SchemaType.NUMBER },
  iron:           { type: SchemaType.NUMBER },
  magnesium:      { type: SchemaType.NUMBER },
  potassium:      { type: SchemaType.NUMBER },
  zinc:           { type: SchemaType.NUMBER },
  phosphorus:     { type: SchemaType.NUMBER },
};

// ── Structured response schemas (module-level singletons) ─────────────────────

/**
 * Unified single-call schema.
 * Classifies the image AND captures type-appropriate fast data in one inference.
 * NOTE: Gemini structured-output does NOT support `additionalProperties` — never add it.
 */
const UNIFIED_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    imageType:  { type: SchemaType.STRING },
    confidence: { type: SchemaType.NUMBER },
    // `details` fully specified so Gemini populates the correct sub-fields
    // per imageType without needing additionalProperties.
    details: {
      type: SchemaType.OBJECT,
      properties: {
        // ── FOOD ───────────────────────────────────────────────────
        foods: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              name:      { type: SchemaType.STRING },
              portion:   { type: SchemaType.STRING },
              weight_g:  { type: SchemaType.NUMBER },
              nutrition: {
                type: SchemaType.OBJECT,
                properties: {
                  calories: { type: SchemaType.NUMBER },
                  protein:  { type: SchemaType.NUMBER },
                  carbs:    { type: SchemaType.NUMBER },
                  fat:      { type: SchemaType.NUMBER },
                  fiber:    { type: SchemaType.NUMBER },
                },
              },
            },
          },
        },
        total: {
          type: SchemaType.OBJECT,
          properties: {
            calories: { type: SchemaType.NUMBER },
            protein:  { type: SchemaType.NUMBER },
            carbs:    { type: SchemaType.NUMBER },
            fat:      { type: SchemaType.NUMBER },
            fiber:    { type: SchemaType.NUMBER },
          },
        },
        // ── WEIGHT ─────────────────────────────────────────────
        weightValue: { type: SchemaType.NUMBER },
        unit:        { type: SchemaType.STRING },
        bmi:         { type: SchemaType.NUMBER },
        bodyFat:     { type: SchemaType.NUMBER },
        muscleMass:  { type: SchemaType.NUMBER },
        bmr:         { type: SchemaType.NUMBER },
        // ── SMARTWATCH ────────────────────────────────────────
        caloriesBurned: { type: SchemaType.NUMBER },
        steps:          { type: SchemaType.NUMBER },
        source:         { type: SchemaType.STRING },
        // ── EDUCATION ────────────────────────────────────────
        platform:         { type: SchemaType.STRING },
        participantCount: { type: SchemaType.NUMBER },
      },
    },
    fastNutrition: {
      type:       SchemaType.OBJECT,
      properties: FAST_NUTRITION_PROPS,
      required:   Object.keys(FAST_NUTRITION_PROPS),
    },
    weightReading: {
      type: SchemaType.OBJECT,
      properties: {
        value: { type: SchemaType.NUMBER },
        unit:  { type: SchemaType.STRING },
      },
    },
    smartwatchData: {
      type: SchemaType.OBJECT,
      properties: {
        caloriesBurned: { type: SchemaType.NUMBER },
        steps:          { type: SchemaType.NUMBER },
        source:         { type: SchemaType.STRING },
      },
    },
    educationData: {
      type: SchemaType.OBJECT,
      properties: {
        isMeeting: { type: SchemaType.BOOLEAN },
        platform:  { type: SchemaType.STRING },
      },
    },
  },
  required: ['imageType', 'confidence'],
};

/**
 * Enrichment-only schema.
 * Micronutrients only — macros are NOT re-analysed, saving ~60 % of output tokens.
 */
const ENRICHMENT_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    enrichment: {
      type:       SchemaType.OBJECT,
      properties: ENRICHMENT_PROPS,
      required:   Object.keys(ENRICHMENT_PROPS),
    },
    confidence: { type: SchemaType.STRING },
  },
  required: ['enrichment', 'confidence'],
};

// ── Prompts (module-level constants) ──────────────────────────────────────────

const UNIFIED_PROMPT = `Analyze this image in a single pass. Return one JSON object matching the schema exactly.

=== imageType — STRICT RULES (read carefully before choosing) ===

"food"
  ANY edible item: meals, snacks, drinks, raw ingredients, packaged food,
  nutrition supplements (Herbalife shakes, protein powder, meal replacements,
  supplement sachets/bottles). If it goes in your mouth for nutrition, it is food.

"weight"
  A weighing scale with a VISIBLE NUMERIC weight reading on its display.
  Must show actual digits (kg or lbs). A scale with no visible number is "other".

"smartwatch"
  A fitness tracker or smartwatch DEVICE SCREEN showing health/activity metrics:
  steps walked, calories burned, heart rate, distance, active minutes.
  Examples: Apple Watch, Garmin, Fitbit, Samsung Galaxy Watch, Mi Band.
  KEY RULE: if the screen shows ACTIVITY DATA on a WEARABLE DEVICE — it is
  "smartwatch", even if it also shows calorie numbers.
  A phone screenshot of a fitness app (Google Fit, Samsung Health) is also
  "smartwatch" if it shows activity summary data.
  NEVER classify a smartwatch/fitness screen as "education".

"education"
  ONLY a screenshot of a live VIDEO CALL where you can see:
    - Participant video tiles (faces on screen)
    - Meeting toolbar (mute button, camera button, end-call button)
    - Platform branding: Google Meet, Zoom, or Microsoft Teams UI.
  If there are NO participant video tiles and NO meeting toolbar, it is NOT education.
  A smartwatch, fitness app, food photo, or generic screenshot is NEVER education.

"other" — use when the image does not clearly match any of the above.

=== confidence ===
  0.9+ very clear  |  0.7–0.89 clear  |  0.5–0.69 uncertain  |  <0.5 → use "other"

=== Per-type fields to populate ===

FOOD — populate ALL:
  fastNutrition: { calories, protein, carbs, fat, fiber }  ← aggregate totals
  details.foods: array, each item: { name, portion, weight_g, nutrition:{calories,protein,carbs,fat,fiber} }
  details.total: { calories, protein, carbs, fat, fiber }
  Name each food specifically (e.g. "Herbalife Formula 1 Shake" not "Drink",
  "Idli" not "Rice Cake", "Chapati" not "Flatbread").

WEIGHT — populate ALL:
  weightReading: { value: number in kg (convert lbs if needed), unit: "kg" }
  details: { weightValue, unit:"kg", bmi, bodyFat, muscleMass, bmr } — null if not on display

SMARTWATCH — populate ALL:
  smartwatchData: { caloriesBurned, steps, source }  (source = device brand)
  details: { caloriesBurned, steps, source }

EDUCATION — populate ALL:
  educationData: { isMeeting: true, platform }  (platform = "Google Meet"/"Zoom"/"Teams")
  details: { platform, participantCount }

All fields not relevant to the detected imageType must be omitted or null.
JSON only. No markdown. No explanation.`;

/**
 * Build an enrichment prompt with fast-nutrition context to avoid re-analysing macros.
 * @param {{ calories, protein, carbs, fat } | null} fastCtx
 * @returns {string}
 */
function buildEnrichmentPrompt(fastCtx) {
  const ctx = fastCtx
    ? `calories=${fastCtx.calories ?? '?'} kcal, protein=${fastCtx.protein ?? '?'} g, carbs=${fastCtx.carbs ?? '?'} g, fat=${fastCtx.fat ?? '?'} g`
    : 'macros unknown';
  return `This food image was already analysed: ${ctx}.

Provide ONLY the 21 micronutrient enrichment values — do NOT re-estimate macros.
Return JSON matching the schema exactly (all enrichment fields required).
Estimate values conservatively; never return 0 unless the nutrient is genuinely absent.
JSON only. No markdown.`;
}

// ── Internal call helper ──────────────────────────────────────────────────────

/**
 * Call a Gemini model with enterprise retry + optional trace instrumentation.
 *
 * @param {'classify'|'nutrition'|'unified'} configKey
 * @param {Array}   parts        [imagePart, promptString]
 * @param {object}  schema       Structured response schema
 * @param {object}  opts
 * @param {string}  opts.label
 * @param {import('./ObservabilityTracer.js').TraceContext|null} [opts.trace]
 * @returns {Promise<{ rawText: string, attempts: number, latencyMs: number }>}
 */
async function callModel(configKey, parts, schema, { label, trace = null }) {
  const model = getModel(configKey, schema);

  const { result, attempts, totalLatencyMs } = await withEnterpriseRetry(
    () => model.generateContent(parts),
    { label, service: SERVICE },
  );

  // Propagate retries into trace
  if (trace && attempts > 1) {
    for (let i = 1; i < attempts; i += 1) trace.addRetry();
  }

  const rawText = result.response.text();

  // Accumulate token usage (available on supported model versions)
  const usage = result.response?.usageMetadata;
  if (trace && usage) {
    trace.addTokenUsage({
      inputTokens:  usage.promptTokenCount     ?? 0,
      outputTokens: usage.candidatesTokenCount ?? 0,
      model:        configKey,
    });
  }

  return { rawText, attempts, latencyMs: totalLatencyMs };
}

// ── Type normalisation ────────────────────────────────────────────────────────

const TYPE_ALIAS = Object.freeze({ weight_scale: 'weight', meeting: 'education' });

function normaliseType(raw, confidence) {
  // Trust Gemini's self-reported imageType when confidence is reasonable.
  // The prompt already instructs Gemini to return 'other' when uncertain
  // (0.6–0.79 range), so double-filtering at 0.80 here was incorrectly
  // discarding valid education / smartwatch detections on the first attempt.
  // Only override as a last-resort sanity check at 0.50.
  if (!raw || confidence < 0.50) return 'other';
  return TYPE_ALIAS[raw] ?? raw;
}

// ── Public gateway methods ────────────────────────────────────────────────────

/**
 * Single multimodal inference: classify + fast nutrition in one Gemini call.
 *
 * Returns:
 *   { imageType, confidence, details,
 *     fastNutrition   (food only),
 *     weightReading   (weight only),
 *     smartwatchData  (smartwatch only),
 *     educationData   (education only),
 *     latencyMs, attempts }
 *
 * @param {Buffer} imageBuffer
 * @param {string} mimeType
 * @param {object} [opts]
 * @param {import('./ObservabilityTracer.js').TraceContext|null} [opts.trace]
 * @returns {Promise<object>}
 */
export async function analyzeUnified(imageBuffer, mimeType, { trace = null } = {}) {
  const label     = 'unified';
  const imagePart = imageInlinePart(imageBuffer, mimeType);
  const stageStart = Date.now();

  try {
    const { rawText, attempts, latencyMs } = await callModel(
      'unified', [imagePart, UNIFIED_PROMPT], UNIFIED_SCHEMA, { label, trace },
    );

    const parsed = safeParseJson(rawText, { label });
    if (!parsed.ok) {
      throw new Error(`AIGateway.analyzeUnified: parse error — ${parsed.error}`);
    }

    const shape = validateShape(parsed.data, ['imageType', 'confidence'], { label });
    if (!shape.ok) {
      throw new Error(`AIGateway.analyzeUnified: schema missing ${shape.missing}`);
    }

    const d        = parsed.data;
    const normType = normaliseType(d.imageType, d.confidence);

    if (trace) {
      trace.addStage({ name: label, latencyMs, success: true, extra: { attempts, imageType: normType } });
    }

    return {
      imageType:      normType,
      confidence:     d.confidence,
      details:        d.details         ?? {},
      fastNutrition:  normType === 'food'       ? (d.fastNutrition  ?? null) : null,
      weightReading:  normType === 'weight'     ? (d.weightReading  ?? null) : null,
      smartwatchData: normType === 'smartwatch' ? (d.smartwatchData ?? null) : null,
      educationData:  normType === 'education'  ? (d.educationData  ?? null) : null,
      latencyMs,
      attempts,
    };
  } catch (err) {
    if (trace) {
      trace.addStage({
        name:      label,
        latencyMs: Date.now() - stageStart,
        success:   false,
        extra:     { error: err.message },
      });
      trace.error({ stage: label, message: err.message, code: err.code });
    }
    throw err;
  }
}

/**
 * Backwards-compatible classify-only call.
 * Internally calls analyzeUnified but returns only the classify fields.
 *
 * @param {Buffer} imageBuffer
 * @param {string} mimeType
 * @param {object} [opts]
 * @param {import('./ObservabilityTracer.js').TraceContext|null} [opts.trace]
 */
export async function classifyImage(imageBuffer, mimeType, { trace = null } = {}) {
  const result = await analyzeUnified(imageBuffer, mimeType, { trace });
  return {
    imageType:  result.imageType,
    confidence: result.confidence,
    details:    result.details,
    latencyMs:  result.latencyMs,
    attempts:   result.attempts,
  };
}

/**
 * Enrichment analysis: micronutrients only (21 fields, no macros re-run).
 * Intended for the background enrichment job.
 *
 * @param {Buffer} imageBuffer
 * @param {string} mimeType
 * @param {{ calories, protein, carbs, fat } | null} fastContext  Fast-analysis context.
 * @param {object} [opts]
 * @param {import('./ObservabilityTracer.js').TraceContext|null} [opts.trace]
 * @returns {Promise<{ enrichment: object, confidence: string, latencyMs: number }>}
 */
export async function enrichNutrition(imageBuffer, mimeType, fastContext, { trace = null } = {}) {
  const label      = 'enrichment';
  const imagePart  = imageInlinePart(imageBuffer, mimeType);
  const prompt     = buildEnrichmentPrompt(fastContext);
  const stageStart = Date.now();

  try {
    const { rawText, attempts, latencyMs } = await callModel(
      'nutrition', [imagePart, prompt], ENRICHMENT_SCHEMA, { label, trace },
    );

    const parsed = safeParseJson(rawText, { label });
    if (!parsed.ok) {
      logger.warn('AIGateway.enrichNutrition: parse error — using empty enrichment', { error: parsed.error });
      return { enrichment: {}, confidence: 'low', latencyMs, attempts };
    }

    if (trace) {
      trace.addStage({ name: label, latencyMs, success: true, extra: { attempts } });
    }

    return {
      enrichment: parsed.data.enrichment ?? {},
      confidence: parsed.data.confidence ?? 'low',
      latencyMs,
      attempts,
    };
  } catch (err) {
    if (trace) {
      trace.addStage({ name: label, latencyMs: Date.now() - stageStart, success: false, extra: { error: err.message } });
      trace.error({ stage: label, message: err.message, code: err.code });
    }
    // Enrichment failures are non-fatal — return empty rather than crashing
    logger.warn('AIGateway.enrichNutrition: failed, returning empty enrichment', { error: err.message });
    return { enrichment: {}, confidence: 'low', latencyMs: Date.now() - stageStart, attempts: 1 };
  }
}

/**
 * Full 26-field nutrition analysis (fast + enrichment in one call).
 * Used by the legacy /api/ai/analyze-nutrition endpoint to preserve its contract.
 *
 * @param {Buffer} imageBuffer
 * @param {string} mimeType
 * @param {object} [opts]
 * @param {import('./ObservabilityTracer.js').TraceContext|null} [opts.trace]
 */
export async function analyzeNutrition(imageBuffer, mimeType, { trace = null } = {}) {
  // Run unified classification first to get fast macros
  const unified = await analyzeUnified(imageBuffer, mimeType, { trace });
  const fast    = unified.fastNutrition ?? {};

  // Run enrichment in parallel (same image, context-aware prompt)
  const enriched = await enrichNutrition(imageBuffer, mimeType, fast, { trace });
  const micro    = enriched.enrichment ?? {};

  return {
    foods:        [],                           // backwards-compatible empty array
    total:        { ...fast, ...micro },
    confidence:   unified.confidence,
    fastNutrition: fast,
    enrichment:   micro,
    imageType:    unified.imageType,
  };
}

/**
 * Backwards-compatible weight detection.
 * Uses the unified call and returns the weightReading fields.
 *
 * @param {Buffer} imageBuffer
 * @param {string} mimeType
 * @param {object} [opts]
 * @param {import('./ObservabilityTracer.js').TraceContext|null} [opts.trace]
 */
export async function detectWeight(imageBuffer, mimeType, { trace = null } = {}) {
  const result = await analyzeUnified(imageBuffer, mimeType, { trace });
  return {
    weight:        result.weightReading?.value ?? null,
    unit:          result.weightReading?.unit  ?? 'kg',
    confidence:    result.confidence,
    isWeightScale: result.imageType === 'weight',
    latencyMs:     result.latencyMs,
  };
}

/**
 * Backwards-compatible meeting/education detection.
 * Uses the unified call and returns educationData fields.
 *
 * @param {Buffer} imageBuffer
 * @param {string} mimeType
 * @param {object} [opts]
 * @param {import('./ObservabilityTracer.js').TraceContext|null} [opts.trace]
 */
export async function detectMeeting(imageBuffer, mimeType, { trace = null } = {}) {
  const result = await analyzeUnified(imageBuffer, mimeType, { trace });
  return {
    isMeeting:  result.educationData?.isMeeting ?? false,
    platform:   result.educationData?.platform  ?? '',
    confidence: result.confidence,
    latencyMs:  result.latencyMs,
  };
}
