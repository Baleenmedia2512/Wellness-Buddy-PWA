/**
 * backend/pages/api/ai/detect-image-type.js
 * ---------------------------------------------------------------------------
 * Gemini-powered image classification endpoint.
 *
 * Returns one of: food | weight | education | smartwatch | other
 *
 * Confidence thresholds:
 *   >= 0.80 → accept classification
 *   0.50–0.79 → uncertain → downgrade to 'other' (no nutrition analysis)
 *   < 0.50  → low → return 'other'
 *
 * Security: GEMINI_API_KEY is server-side only.
 * Temp files: always cleaned up via withTempFileCleanup (try/finally).
 * Retries: transient Gemini errors retried up to 3× with exponential backoff.
 * JSON safety: all response parsing via safeParseJson (never bare JSON.parse).
 * ---------------------------------------------------------------------------
 */

import formidable from 'formidable';
import fs from 'fs';
import logger from '../../../shared/lib/logger.js';
import { getModel, imageInlinePart } from '../../../shared/lib/gemini/geminiClient.js';
import { withRetry } from '../../../shared/lib/gemini/retryPolicy.js';
import { safeParseJson, validateShape } from '../../../shared/lib/gemini/safeJson.js';
import { withTempFileCleanup } from '../../../shared/lib/gemini/tempFileCleanup.js';

export const config = {
  api: { bodyParser: false },
};

// ── Confidence thresholds ─────────────────────────────────────────────────────
const CONFIDENCE_ACCEPT    = 0.80;
const CONFIDENCE_UNCERTAIN = 0.50;

// ── Type normalisation ────────────────────────────────────────────────────────
const TYPE_MAP = { weight_scale: 'weight', meeting: 'education' };
function normaliseType(raw) { return TYPE_MAP[raw] || raw || 'other'; }

// ── Prompt (defined once, reused across requests) ─────────────────────────────
const CLASSIFY_PROMPT = `Analyze this image and determine its type. Return a single JSON object with exactly these keys:

{
  "type": "food" | "weight_scale" | "meeting" | "smartwatch" | "other",
  "confidence": <number between 0.0 and 1.0>,
  "details": {
    // food         → { "hasFood": true }
    // weight_scale → { "isWeightScale": true, "reason": "<string>" }
    // meeting      → { "isMeeting": true, "platform": "Google Meet|Zoom|Teams|Other" }
    // smartwatch   → { "isSmartwatch": true, "source": "Apple Watch|Garmin|Fitbit|Samsung|Other", "caloriesBurned": <number|null> }
    // other        → { "reason": "<string>" }
  }
}

Classification rules:
- "food": Contains edible food, drinks, meals, snacks
- "weight_scale": Shows a weighing scale with visible numeric display
- "meeting": Virtual meeting screenshot (Google Meet, Zoom, Teams UI visible)
- "smartwatch": Shows a smartwatch/fitness tracker screen or activity summary
- "other": None of the above

Confidence guidelines:
- 0.9+: Unmistakable single subject
- 0.8: Clear with minor ambiguity
- 0.6–0.79: Uncertain (borderline or composite)
- 0.3–0.59: Low
- <0.3: Cannot determine

Respond with JSON only. No markdown, no explanation.`;

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      ok: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Only POST allowed' },
    });
  }

  const t0 = Date.now();

  const form = formidable({ maxFileSize: 10 * 1024 * 1024 });
  let fields, files;
  try {
    [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, f, fi) => (err ? reject(err) : resolve([f, fi])));
    });
  } catch (err) {
    logger.warn('detect-image-type: form parse error', { error: err.message });
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
      model = getModel('classify');
    } catch (err) {
      logger.error('detect-image-type: Gemini client init failed', { error: err.message });
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
        async () => { attempts += 1; return model.generateContent([imagePart, CLASSIFY_PROMPT]); },
        { label: 'classify' },
      );
      rawText = geminiResult.response.text();
    } catch (err) {
      const latencyMs = Date.now() - t0;
      logger.error('detect-image-type: Gemini failed after retries', {
        latencyMs, attempts, error: err.message, status: err.status ?? null,
      });
      return res.status(500).json({
        ok: false,
        error: { code: 'DETECTION_FAILED', message: 'Failed to detect image type', details: err.message },
      });
    }

    const parsed = safeParseJson(rawText, { label: 'classify' });
    if (!parsed.ok) {
      logger.warn('detect-image-type: response parse failed', { latencyMs: Date.now() - t0, error: parsed.error });
      return res.status(500).json({
        ok: false,
        error: { code: 'PARSE_ERROR', message: 'AI response could not be parsed', details: parsed.error },
      });
    }

    const shape = validateShape(parsed.data, ['type', 'confidence'], { label: 'classify' });
    if (!shape.ok) {
      logger.warn('detect-image-type: response schema invalid', { latencyMs: Date.now() - t0, missing: shape.missing });
      return res.status(500).json({
        ok: false,
        error: { code: 'SCHEMA_ERROR', message: 'AI response missing required fields', details: shape.missing },
      });
    }

    const raw        = parsed.data;
    const confidence = typeof raw.confidence === 'number' ? raw.confidence : 0;

    // Confidence gating
    let type;
    if (confidence >= CONFIDENCE_ACCEPT) {
      type = normaliseType(raw.type);
    } else {
      type = 'other';
      logger.info('detect-image-type: low/uncertain confidence → other', {
        rawType: raw.type, confidence, threshold: CONFIDENCE_ACCEPT,
      });
    }

    const latencyMs = Date.now() - t0;
    logger.info('detect-image-type: classified', { type, rawType: raw.type, confidence, latencyMs, retryCount: attempts - 1 });

    return res.status(200).json({
      ok: true,
      data: {
        type,
        confidence,
        details: raw.details || {},
        _meta: { latencyMs, retryCount: attempts - 1 },
      },
    });
  });
}
