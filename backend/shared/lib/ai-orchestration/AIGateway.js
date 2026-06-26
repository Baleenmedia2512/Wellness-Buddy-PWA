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
import { getModel, imageInlinePart, SchemaType, FALLBACK_MODEL_NAME } from '../gemini/geminiClient.js';
import { safeParseJson, validateShape } from '../gemini/safeJson.js';
import { withEnterpriseRetry } from './RetryPolicy.js';

const SERVICE = 'gemini';

// ── Schema fragments (module-level constants) ─────────────────────────────────

/** Fast macros: returned inline on every food analysis. */
const FAST_NUTRITION_PROPS = {
  calories:    { type: SchemaType.NUMBER },
  protein:     { type: SchemaType.NUMBER },
  carbs:       { type: SchemaType.NUMBER },
  fat:         { type: SchemaType.NUMBER },
  fiber:       { type: SchemaType.NUMBER },
  // Include these in fast path so carousel cards are populated without waiting for enrichment
  sugar:       { type: SchemaType.NUMBER },
  sodium:      { type: SchemaType.NUMBER },
  cholesterol: { type: SchemaType.NUMBER },
  glycemic_index: { type: SchemaType.NUMBER },
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

/** Full nutrition: all 26 fields returned per-food item in the unified call. */
const FULL_NUTRITION_PROPS = { ...FAST_NUTRITION_PROPS, ...ENRICHMENT_PROPS };

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
              volume_ml: { type: SchemaType.NUMBER },  // required for drinks/liquids
              isLiquid:  { type: SchemaType.BOOLEAN }, // true for water, tea, shakes, etc.
              nutrition: {
                type: SchemaType.OBJECT,
                properties: FULL_NUTRITION_PROPS,
                // Require macros + sugar/sodium/cholesterol/GI so carousel cards
                // are always populated from the initial call (no enrichment needed).
                required: ['calories', 'protein', 'carbs', 'fat', 'fiber',
                           'sugar', 'sodium', 'cholesterol', 'glycemic_index'],
              },
            },
            // Minimum required per item so food lists are never empty/nutrition-less
            required: ['name', 'nutrition'],
          },
        },
        total: {
          type: SchemaType.OBJECT,
          properties: FULL_NUTRITION_PROPS,
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
      required:   ['calories', 'protein', 'carbs', 'fat', 'fiber',
                   'sugar', 'sodium', 'cholesterol', 'glycemic_index'],
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

const UNIFIED_PROMPT = `Analyze this image in one pass. Return exactly one JSON object matching the schema.

=== imageType ===

"food" — DEFAULT. Any edible item, drink, supplement, raw ingredient, or packaged food.
  Includes: meals, snacks, water, tea, coffee, juices, shakes, protein powders, pills, sauces.
  BIAS: If there is ANY reasonable chance this is food, return "food". When in doubt → "food".

"weight" — Weighing scale with a VISIBLE numeric reading (kg or lbs). No digits visible → "other".

"smartwatch" — Device or phone screen showing activity data: steps, calories, heart rate, distance.
  Devices: Apple Watch, Garmin, Fitbit, Samsung Galaxy Watch, Mi Band, Google Fit, Samsung Health.
  Activity data on any screen → "smartwatch", never "education".

"education" — Video-call screenshot with ALL THREE present:
  (1) participant video tiles  (2) meeting toolbar  (3) Google Meet / Zoom / Teams UI.
  Any element missing → NOT education.

"other" — Only when clearly none of the above. When in doubt → use "food".

=== confidence ===
Score 0.0–1.0. Reports certainty only — never changes imageType.
A blurry food photo = "food" at 0.55, not "other".

=== Herbalife products ===
This app serves Herbalife Wellness community members. Recognize on sight:

Meal-replacement shakes (isLiquid: true, complete meal, ~250–300 ml):
- "Herbalife Formula 1 Shake" — powder sachet or shaker bottle. ~200–260 kcal, 9 g protein, 36 g carbs, 1 g fat. Adjust if prepared with plant milk.
- "Herbalife Protein Drink Mix (PDM)" — added to F1 shake.
- "Herbalife High Protein Iced Coffee" — coffee-flavoured meal drink.

Hydration beverages (isLiquid: true, NOT a meal):
- "Herbalife Afresh Energy Drink" — yellow/orange powder or prepared cup. ~10–20 kcal.
- "Herbalife Herbal Tea Concentrate" — small sachet or bottle. ~5–10 kcal.

Supplements (isLiquid: false, near-zero calories):
- "Herbalife Formula 2 Multivitamin" | "Herbalife Formula 3 Cell Activator"
- "Herbalife NightWorks / Niteworks" | "Herbalife Xtra-Cal"
- Any other labelled Herbalife supplement bottle or packet.

=== Tamil Nadu foods ===
Most users are from Tamil Nadu, India. Use these specific names:

Breakfast:  Idli, Dosa, Uthappam, Pongal (sweet/savoury), Appam, Puttu, Idiyappam
Rice:       Curd Rice, Lemon Rice, Puliyodarai, Tomato Rice, Coconut Rice,
            Sambar Rice, Rasam Rice, Chicken Biryani, Mutton Biryani, Seeraga Samba Biryani
Breads:     Parotta, Kothu Parotta, Veechu Parotta, Chapati, Phulka, Roti
Curries:    Sambar, Rasam, Poriyal, Kootu, Avial, Moru Kuzhambu, Vatha Kuzhambu,
            Chicken Chettinad, Mutton Kuzhambu, Meen Kuzhambu, Egg Curry, Egg Bhurji,
            Paneer Butter Masala, Dal Tadka
Sides:      Coconut Chutney, Tomato Chutney, Onion Chutney
Snacks:     Murukku, Seedai, Sundal, Bonda, Bajji, Mixture, Omapodi, Kara Sev
Beverages:  Filter Coffee, Masala Chai, Ginger Tea, Buttermilk (Moru), Tender Coconut Water, Sugarcane Juice
Sweets:     Sweet Pongal (Sakkarai Pongal), Payasam, Mysore Pak, Adhirasam, Laddu, Halwa, Jangiri, Badusha

=== isLiquid ===
true  → all beverages (water, tea, coffee, juices, buttermilk, coconut water, Afresh, Herbal Tea)
         and Herbalife meal-replacement shakes (also count as complete meals)
false → all solid foods (rice, bread, curry, snacks, idli, etc.)

=== FOOD output ===

fastNutrition — 9-field aggregate totals:
{ calories, protein, carbs, fat, fiber, sugar, sodium, cholesterol, glycemic_index }

details.foods — one object per visible edible item or beverage:
{
  name,       ← specific only: "Idli" / "Masala Chai" / "Plain Water" — never "Food"/"Drink"/"Meal"/"Snack"
  portion,    ← realistic serving size string
  weight_g,   ← solids (g)
  volume_ml,  ← liquids (ml); provide both when estimable
  isLiquid,
  nutrition: {
    calories, protein, carbs, fat, fiber, sugar, sodium, cholesterol, glycemic_index,
    vitamin_a, vitamin_c, vitamin_d, vitamin_e, vitamin_k,
    vitamin_b1, vitamin_b2, vitamin_b3, vitamin_b6, vitamin_b9, vitamin_b12,
    calcium, iron, magnesium, potassium, zinc, phosphorus
  }
}

Nutrition rules:
- All 26 fields required per item. Absent/unknown → 0, never null. All values numeric.
- vitamin_a: µg RAE | vitamin_d/k: µg | vitamin_c, b-vitamins, minerals: mg.
- Plain water: all nutrients 0.
- Estimate using USDA FoodData Central or equivalent.

details.total — same 26 flat fields, sum of all foods:
{ calories, protein, carbs, fat, fiber, sugar, sodium, cholesterol, glycemic_index,
  vitamin_a, vitamin_c, vitamin_d, vitamin_e, vitamin_k,
  vitamin_b1, vitamin_b2, vitamin_b3, vitamin_b6, vitamin_b9, vitamin_b12,
  calcium, iron, magnesium, potassium, zinc, phosphorus }

Consistency:
- Detect EVERY visible edible item: main dish, sides, chutneys, sauces, condiments, beverages, water. Each = separate object in details.foods. Do NOT stop at the dominant dish.
- fastNutrition MUST equal details.total for all 9 shared fields.
- details.total MUST equal the sum of all details.foods items.

=== WEIGHT output ===
weightReading: { value: <kg; convert lbs>, unit: "kg" }
details: { weightValue, unit:"kg", bmi, bodyFat, muscleMass, bmr } — null if not on display

=== SMARTWATCH output ===
smartwatchData: { caloriesBurned, steps, source }  ← source = brand e.g. "Apple Watch"
details: { caloriesBurned, steps, source }

=== EDUCATION output ===
educationData: { isMeeting: true, platform }  ← "Google Meet" | "Zoom" | "Teams"
details: { platform, participantCount }

Omit or null fields not relevant to the detected imageType.
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

/**
 * Returns true when all retries on the primary model were exhausted due to
 * server-side overload (503) — a signal to try the fallback model.
 */
function isPrimaryOverloadedError(err) {
  if (!err) return false;
  const status = Number(err.status);
  if (status === 503) return true;
  const msg = (err.message ?? '').toLowerCase();
  return msg.includes('503') || msg.includes('service unavailable') || msg.includes('high demand');
}

// ── Internal call helper ──────────────────────────────────────────────────────

/**
 * Call a Gemini model with enterprise retry + optional trace instrumentation.
 * On persistent 503 overload the call is automatically retried once on
 * FALLBACK_MODEL_NAME so callers remain resilient during peak load spikes.
 *
 * @param {'classify'|'nutrition'|'unified'} configKey
 * @param {Array}   parts        [imagePart, promptString]
 * @param {object}  schema       Structured response schema
 * @param {object}  opts
 * @param {string}  opts.label
 * @param {import('./ObservabilityTracer.js').TraceContext|null} [opts.trace]
 * @param {string|null} [opts.modelOverride]  Internal: set by fallback path.
 * @returns {Promise<{ rawText: string, attempts: number, latencyMs: number }>}
 */
async function callModel(configKey, parts, schema, { label, trace = null, modelOverride = null }) {
  const model = getModel(configKey, schema, modelOverride);

  let result, attempts, totalLatencyMs;
  try {
    ({ result, attempts, totalLatencyMs } = await withEnterpriseRetry(
      () => model.generateContent(parts),
      { label, service: SERVICE },
    ));
  } catch (err) {
    // Primary model saturated → try fallback model once (with its own retries)
    if (!modelOverride && isPrimaryOverloadedError(err)) {
      logger.warn('AIGateway.callModel: primary model overloaded, switching to fallback', {
        label,
        fallbackModel: FALLBACK_MODEL_NAME,
        primaryError:  err.message,
      });
      return callModel(configKey, parts, schema, { label, trace, modelOverride: FALLBACK_MODEL_NAME });
    }
    throw err;
  }

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
  // The prompt already instructs Gemini to ALWAYS choose "food" over "other"
  // when there is ANY reasonable chance it is food. Only override as a last-
  // resort sanity check at 0.10 (practically zero confidence).
  if (!raw || confidence < 0.10) return 'other';
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
