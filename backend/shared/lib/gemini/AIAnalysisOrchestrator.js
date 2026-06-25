/**
 * backend/shared/lib/gemini/AIAnalysisOrchestrator.js
 * ---------------------------------------------------------------------------
 * Centralised orchestrator for the AI image-analysis pipeline.
 *
 * Responsibilities:
 *   - Image classification (detect-image-type)
 *   - Confidence-gated routing (food / weight / smartwatch / education / other)
 *   - Nutrition analysis (only after confirmed food classification)
 *   - Latency tracking per stage
 *   - Retry accounting
 *   - Structured observability events
 *
 * This module does NOT perform HTTP request/response handling. It is a pure
 * orchestration layer that operates on a Buffer + mimeType pair.
 *
 * Endpoint handlers remain responsible for:
 *   - Parsing multipart form-data
 *   - Temp-file cleanup (withTempFileCleanup)
 *   - HTTP response formatting
 *
 * Architecture note (claude.md §7 / Non-Negotiable #3):
 *   All business-logic routing lives here. API route handlers contain no
 *   classification or confidence-scoring logic.
 * ---------------------------------------------------------------------------
 */

import logger from '../logger.js';
import { getModel, imageInlinePart, SchemaType } from './geminiClient.js';
import { withRetry } from './retryPolicy.js';
import { safeParseJson, validateShape } from './safeJson.js';

// ── Confidence thresholds ─────────────────────────────────────────────────────
export const CONFIDENCE = Object.freeze({
  ACCEPT:    0.80, // >= ACCEPT  → accept classification
  UNCERTAIN: 0.50, // [UNCERTAIN, ACCEPT) → downgrade to 'other'
  // < UNCERTAIN → 'other'
});

// ── Type normalisation ────────────────────────────────────────────────────────
const TYPE_MAP = Object.freeze({ weight_scale: 'weight', meeting: 'education' });
function normaliseType(raw) { return TYPE_MAP[raw] || raw || 'other'; }

// ── Nutrition schema (defined once for schema-cached model) ───────────────────
const NUTRITION_FIELDS = {
  calories: { type: SchemaType.NUMBER }, protein: { type: SchemaType.NUMBER },
  carbs: { type: SchemaType.NUMBER }, fat: { type: SchemaType.NUMBER },
  fiber: { type: SchemaType.NUMBER }, sugar: { type: SchemaType.NUMBER },
  sodium: { type: SchemaType.NUMBER }, cholesterol: { type: SchemaType.NUMBER },
  glycemic_index: { type: SchemaType.NUMBER },
  vitamin_a: { type: SchemaType.NUMBER }, vitamin_c: { type: SchemaType.NUMBER },
  vitamin_d: { type: SchemaType.NUMBER }, vitamin_e: { type: SchemaType.NUMBER },
  vitamin_k: { type: SchemaType.NUMBER }, vitamin_b1: { type: SchemaType.NUMBER },
  vitamin_b2: { type: SchemaType.NUMBER }, vitamin_b3: { type: SchemaType.NUMBER },
  vitamin_b6: { type: SchemaType.NUMBER }, vitamin_b9: { type: SchemaType.NUMBER },
  vitamin_b12: { type: SchemaType.NUMBER }, calcium: { type: SchemaType.NUMBER },
  iron: { type: SchemaType.NUMBER }, magnesium: { type: SchemaType.NUMBER },
  potassium: { type: SchemaType.NUMBER }, zinc: { type: SchemaType.NUMBER },
  phosphorus: { type: SchemaType.NUMBER },
};

const FOOD_ANALYSIS_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    foods: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name: { type: SchemaType.STRING }, portion: { type: SchemaType.STRING },
          weight_g: { type: SchemaType.NUMBER }, volume_ml: { type: SchemaType.NUMBER },
          unit: { type: SchemaType.STRING }, isLiquid: { type: SchemaType.BOOLEAN },
          nutrition: {
            type: SchemaType.OBJECT,
            properties: NUTRITION_FIELDS,
            required: Object.keys(NUTRITION_FIELDS),
          },
        },
        required: ['name', 'portion', 'unit', 'isLiquid', 'nutrition'],
      },
    },
    total: { type: SchemaType.OBJECT, properties: NUTRITION_FIELDS, required: Object.keys(NUTRITION_FIELDS) },
    confidence: { type: SchemaType.STRING },
  },
  required: ['foods', 'total', 'confidence'],
};

// ── Prompts (defined once, reused across requests) ────────────────────────────
const CLASSIFY_PROMPT = `Analyze this image and determine its type. Return a single JSON object:

{
  "type": "food" | "weight_scale" | "meeting" | "smartwatch" | "other",
  "confidence": <0.0–1.0>,
  "details": {
    // food → { "hasFood": true }
    // weight_scale → { "isWeightScale": true, "reason": "string" }
    // meeting → { "isMeeting": true, "platform": "Google Meet|Zoom|Teams|Other" }
    // smartwatch → { "isSmartwatch": true, "source": "string", "caloriesBurned": number|null }
    // other → { "reason": "string" }
  }
}

Rules: food=edible food/drinks, weight_scale=scale with numeric display,
meeting=virtual meeting UI, smartwatch=fitness tracker screen, other=none.
Confidence: 0.9+ unmistakable, 0.8 clear, 0.6–0.79 uncertain, <0.6 low.
JSON only. No markdown.`;

const NUTRITION_PROMPT = `Analyze this food image for detailed nutritional information.
Return JSON with: foods array (each with name, portion, weight_g/volume_ml, unit, isLiquid,
and all 26 nutrition fields), total (same 26 fields), confidence (high/medium/low).
Estimate micronutrients conservatively. JSON only.`;

const WEIGHT_PROMPT = `Extract weight from this scale image. Return JSON:
{"weight": number|null, "unit": "kg"|"lbs", "confidence": 0.0-1.0, "isWeightScale": boolean, "reason": "string"}
Convert lbs to kg. Return null weight if unreadable. JSON only.`;

// ── Fallback result ───────────────────────────────────────────────────────────
const NUTRITION_FALLBACK = Object.freeze({
  foods: [], total: { calories: 0 }, confidence: 0, defaulted: true,
});

// ── Observability helpers ─────────────────────────────────────────────────────
function emitEvent(eventName, fields) {
  logger.info(`orchestrator.${eventName}`, fields);
}

// ── Internal Gemini call helper ───────────────────────────────────────────────
async function callGemini(configKey, imagePart, prompt, { responseSchema = null, label } = {}) {
  const model   = getModel(configKey, responseSchema);
  let attempts  = 0;
  const t0      = Date.now();

  const geminiResult = await withRetry(
    async () => { attempts += 1; return model.generateContent([imagePart, prompt]); },
    { label },
  );
  return { rawText: geminiResult.response.text(), latencyMs: Date.now() - t0, attempts };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Classify an image and optionally run nutrition analysis for food images.
 *
 * @param {Buffer}  imageBuffer
 * @param {string}  mimeType
 * @param {object}  [opts]
 * @param {string}  [opts.captureId]   For structured log correlation
 * @param {string}  [opts.userId]      For structured log correlation
 * @returns {Promise<ClassifyResult>}
 */
export async function classifyAndAnalyse(imageBuffer, mimeType, { captureId = null, userId = null } = {}) {
  const pipelineStart = Date.now();
  const logCtx        = { captureId, userId };

  // ── Stage 1: Classification ───────────────────────────────────────────────
  const imagePart = imageInlinePart(imageBuffer, mimeType);
  let classifyResult;

  try {
    const { rawText, latencyMs, attempts } = await callGemini('classify', imagePart, CLASSIFY_PROMPT, { label: 'classify' });

    const parsed = safeParseJson(rawText, { label: 'classify' });
    if (!parsed.ok) {
      emitEvent('classify.parse_failure', { ...logCtx, error: parsed.error, latencyMs });
      return { stage: 'classify', ok: false, type: 'other', confidence: 0, details: {}, error: parsed.error };
    }

    const shape = validateShape(parsed.data, ['type', 'confidence'], { label: 'classify' });
    if (!shape.ok) {
      emitEvent('classify.schema_invalid', { ...logCtx, missing: shape.missing, latencyMs });
      return { stage: 'classify', ok: false, type: 'other', confidence: 0, details: {}, error: `Missing fields: ${shape.missing}` };
    }

    const rawConf = typeof parsed.data.confidence === 'number' ? parsed.data.confidence : 0;
    const type    = rawConf >= CONFIDENCE.ACCEPT ? normaliseType(parsed.data.type) : 'other';

    emitEvent('classify.success', {
      ...logCtx,
      classificationType: type,
      rawType: parsed.data.type,
      confidence: rawConf,
      latencyMs,
      retryCount: attempts - 1,
    });

    classifyResult = {
      type,
      confidence: rawConf,
      details: parsed.data.details || {},
      latencyMs,
      retryCount: attempts - 1,
    };
  } catch (err) {
    emitEvent('classify.gemini_failure', { ...logCtx, error: err.message, status: err.status ?? null });
    return { stage: 'classify', ok: false, type: 'other', confidence: 0, details: {}, error: err.message };
  }

  // ── Stage 2: Route — non-food types return early ──────────────────────────
  if (classifyResult.type !== 'food') {
    return {
      stage: 'classify',
      ok: true,
      ...classifyResult,
      pipelineLatencyMs: Date.now() - pipelineStart,
    };
  }

  // ── Stage 3: Nutrition analysis (food only) ───────────────────────────────
  let nutritionData;
  try {
    const { rawText, latencyMs, attempts } = await callGemini(
      'nutrition', imagePart, NUTRITION_PROMPT,
      { responseSchema: FOOD_ANALYSIS_SCHEMA, label: 'nutrition' },
    );

    const parsed = safeParseJson(rawText, { label: 'nutrition' });
    if (!parsed.ok) {
      emitEvent('nutrition.parse_failure', { ...logCtx, error: parsed.error, latencyMs });
      nutritionData = { ...NUTRITION_FALLBACK };
    } else {
      const shape = validateShape(parsed.data, ['foods', 'total', 'confidence'], { label: 'nutrition' });
      if (!shape.ok) {
        emitEvent('nutrition.schema_invalid', { ...logCtx, missing: shape.missing, latencyMs });
        nutritionData = { ...NUTRITION_FALLBACK };
      } else {
        emitEvent('nutrition.success', {
          ...logCtx,
          foodCount: parsed.data.foods?.length ?? 0,
          confidence: parsed.data.confidence,
          latencyMs,
          retryCount: attempts - 1,
        });
        nutritionData = parsed.data;
      }
    }
  } catch (err) {
    emitEvent('nutrition.gemini_failure', { ...logCtx, error: err.message, status: err.status ?? null });
    nutritionData = { ...NUTRITION_FALLBACK };
  }

  return {
    stage: 'nutrition',
    ok: true,
    type: 'food',
    confidence: classifyResult.confidence,
    details: classifyResult.details,
    nutrition: nutritionData,
    pipelineLatencyMs: Date.now() - pipelineStart,
  };
}

/**
 * @typedef {object} ClassifyResult
 * @property {'classify'|'nutrition'} stage     Last stage reached
 * @property {boolean}                ok        True when classification succeeded
 * @property {string}                 type      Canonical type
 * @property {number}                 confidence
 * @property {object}                 details   Gemini detail block
 * @property {object}                 [nutrition] Populated for food images
 * @property {number}                 pipelineLatencyMs
 * @property {string}                 [error]   Set when ok=false
 */
