/**
 * backend/pages/api/ai/analyze-nutrition.js
 * ---------------------------------------------------------------------------
 * Gemini-powered nutrition analysis endpoint.
 *
 * Only called AFTER detect-image-type confirms the image is 'food'.
 * Never called for uncertain, low-confidence, or non-food images.
 *
 * Security: GEMINI_API_KEY is server-side only.
 * Temp files: always cleaned up via withTempFileCleanup (try/finally).
 * Retries: transient Gemini errors retried up to 3× with exponential backoff.
 * JSON safety: all response parsing via safeParseJson (never bare JSON.parse).
 * Fallback: returns structured fallback result on analysis failure so the
 *           capture flow never crashes.
 * ---------------------------------------------------------------------------
 */

import formidable from 'formidable';
import fs from 'fs';
import logger from '../../../shared/lib/logger.js';
import { getModel, imageInlinePart, SchemaType } from '../../../shared/lib/gemini/geminiClient.js';
import { withRetry } from '../../../shared/lib/gemini/retryPolicy.js';
import { safeParseJson, validateShape } from '../../../shared/lib/gemini/safeJson.js';
import { withTempFileCleanup } from '../../../shared/lib/gemini/tempFileCleanup.js';

// ── Structured response schema ────────────────────────────────────────────────
// Defined once and reused across requests (getModel caches the model instance).
const NUTRITION_FIELDS = {
  calories:      { type: SchemaType.NUMBER },
  protein:       { type: SchemaType.NUMBER },
  carbs:         { type: SchemaType.NUMBER },
  fat:           { type: SchemaType.NUMBER },
  fiber:         { type: SchemaType.NUMBER },
  sugar:         { type: SchemaType.NUMBER },
  sodium:        { type: SchemaType.NUMBER },
  cholesterol:   { type: SchemaType.NUMBER },
  glycemic_index: { type: SchemaType.NUMBER },
  vitamin_a:     { type: SchemaType.NUMBER },
  vitamin_c:     { type: SchemaType.NUMBER },
  vitamin_d:     { type: SchemaType.NUMBER },
  vitamin_e:     { type: SchemaType.NUMBER },
  vitamin_k:     { type: SchemaType.NUMBER },
  vitamin_b1:    { type: SchemaType.NUMBER },
  vitamin_b2:    { type: SchemaType.NUMBER },
  vitamin_b3:    { type: SchemaType.NUMBER },
  vitamin_b6:    { type: SchemaType.NUMBER },
  vitamin_b9:    { type: SchemaType.NUMBER },
  vitamin_b12:   { type: SchemaType.NUMBER },
  calcium:       { type: SchemaType.NUMBER },
  iron:          { type: SchemaType.NUMBER },
  magnesium:     { type: SchemaType.NUMBER },
  potassium:     { type: SchemaType.NUMBER },
  zinc:          { type: SchemaType.NUMBER },
  phosphorus:    { type: SchemaType.NUMBER },
};

const FOOD_ANALYSIS_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    foods: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name:      { type: SchemaType.STRING },
          portion:   { type: SchemaType.STRING },
          weight_g:  { type: SchemaType.NUMBER },
          volume_ml: { type: SchemaType.NUMBER },
          unit:      { type: SchemaType.STRING },
          isLiquid:  { type: SchemaType.BOOLEAN },
          nutrition: {
            type: SchemaType.OBJECT,
            properties: NUTRITION_FIELDS,
            required: Object.keys(NUTRITION_FIELDS),
          },
        },
        required: ['name', 'portion', 'unit', 'isLiquid', 'nutrition'],
      },
    },
    total: {
      type: SchemaType.OBJECT,
      properties: NUTRITION_FIELDS,
      required: Object.keys(NUTRITION_FIELDS),
    },
    confidence: { type: SchemaType.STRING },
  },
  required: ['foods', 'total', 'confidence'],
};

// ── Fallback result returned when analysis fails (never crash the capture flow) ──
const FALLBACK_RESULT = Object.freeze({
  foods: [],
  total: { calories: 0 },
  confidence: 0,
  defaulted: true,
});

// ── Prompt (defined once) ─────────────────────────────────────────────────────
const NUTRITION_PROMPT = `Analyze this food image and provide detailed nutritional information.

Return a JSON object with:
1. Array of detected foods with individual nutrition
2. Total combined nutrition for the entire meal
3. Confidence level (high/medium/low)

For each food item, provide:
- Name and portion size
- Weight (g) or volume (ml)
- All 26 nutritional values (9 macros + 17 vitamins/minerals)

Be accurate with micronutrients — estimate based on typical values for each food.
If unsure about a specific nutrient, estimate conservatively rather than returning 0.`;

export const config = {
  api: { bodyParser: false },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Only POST allowed' } });
  }

  const t0 = Date.now();

  const form = formidable({ maxFileSize: 10 * 1024 * 1024 });
  let fields, files;
  try {
    [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, f, fi) => (err ? reject(err) : resolve([f, fi])));
    });
  } catch (err) {
    logger.warn('analyze-nutrition: form parse error', { error: err.message });
    return res.status(400).json({
      ok: false,
      error: { code: 'FORM_PARSE_ERROR', message: 'Failed to parse form data' },
    });
  }

  return withTempFileCleanup(files, async () => {
    const imageFile = files.image?.[0] ?? files.image;
    if (!imageFile) {
      return res.status(400).json({
        ok: false,
        error: { code: 'MISSING_IMAGE', message: 'No image file provided' },
      });
    }

    let model;
    try {
      model = getModel('nutrition', FOOD_ANALYSIS_SCHEMA);
    } catch (err) {
      logger.error('analyze-nutrition: Gemini client init failed', { error: err.message });
      return res.status(500).json({
        ok: false,
        error: { code: err.code || 'SERVER_CONFIG_ERROR', message: 'AI service not configured' },
      });
    }

    const imageBuffer = fs.readFileSync(imageFile.filepath);
    const imagePart   = imageInlinePart(imageBuffer, imageFile.mimetype);

    let rawText;
    let attempts = 0;
    try {
      const geminiResult = await withRetry(
        async () => { attempts += 1; return model.generateContent([imagePart, NUTRITION_PROMPT]); },
        { label: 'nutrition' },
      );
      rawText = geminiResult.response.text();
    } catch (err) {
      const latencyMs = Date.now() - t0;
      logger.error('analyze-nutrition: Gemini failed after retries', {
        latencyMs, attempts, error: err.message, status: err.status ?? null,
      });
      // Return fallback — never crash capture flow
      return res.status(200).json({ ok: true, data: { ...FALLBACK_RESULT } });
    }

    const parsed = safeParseJson(rawText, { label: 'nutrition' });
    if (!parsed.ok) {
      logger.warn('analyze-nutrition: response parse failed', { latencyMs: Date.now() - t0, error: parsed.error });
      return res.status(200).json({ ok: true, data: { ...FALLBACK_RESULT } });
    }

    const shape = validateShape(parsed.data, ['foods', 'total', 'confidence'], { label: 'nutrition' });
    if (!shape.ok) {
      logger.warn('analyze-nutrition: response schema invalid', { latencyMs: Date.now() - t0, missing: shape.missing });
      return res.status(200).json({ ok: true, data: { ...FALLBACK_RESULT } });
    }

    const latencyMs = Date.now() - t0;
    logger.info('analyze-nutrition: success', {
      latencyMs,
      retryCount: attempts - 1,
      foodCount: parsed.data.foods?.length ?? 0,
      confidence: parsed.data.confidence,
    });

    return res.status(200).json({
      ok: true,
      data: parsed.data,
      _meta: { latencyMs, retryCount: attempts - 1 },
    });
  });
}
