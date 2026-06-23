/**
 * backend/pages/api/ai/detect-weight.js
 * ---------------------------------------------------------------------------
 * Gemini-powered weight scale reading endpoint.
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

// ── Prompt (defined once) ─────────────────────────────────────────────────────
const WEIGHT_PROMPT = `Extract the weight reading from this scale image. Return a single JSON object:

{
  "weight": <number in kg, or null if unreadable>,
  "unit": "kg" | "lbs",
  "confidence": <number 0.0–1.0>,
  "isWeightScale": <boolean>,
  "reason": "<brief explanation>"
}

Rules:
- Read the number carefully. If multiple numbers are visible, choose the main/largest display.
- Convert to kg if shown in lbs (divide by 2.205).
- Return null for weight if this is not a scale or the display is unreadable.

Respond with JSON only. No markdown, no explanation.`;

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
    logger.warn('detect-weight: form parse error', { error: err.message });
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
      model = getModel('weight');
    } catch (err) {
      logger.error('detect-weight: Gemini client init failed', { error: err.message });
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
        async () => { attempts += 1; return model.generateContent([imagePart, WEIGHT_PROMPT]); },
        { label: 'weight' },
      );
      rawText = geminiResult.response.text();
    } catch (err) {
      const latencyMs = Date.now() - t0;
      logger.error('detect-weight: Gemini failed after retries', {
        latencyMs, attempts, error: err.message, status: err.status ?? null,
      });
      return res.status(500).json({
        ok: false,
        error: { code: 'WEIGHT_DETECTION_FAILED', message: 'Failed to detect weight', details: err.message },
      });
    }

    const parsed = safeParseJson(rawText, { label: 'weight' });
    if (!parsed.ok) {
      logger.warn('detect-weight: response parse failed', { latencyMs: Date.now() - t0, error: parsed.error });
      return res.status(500).json({
        ok: false,
        error: { code: 'PARSE_ERROR', message: 'AI response could not be parsed', details: parsed.error },
      });
    }

    const shape = validateShape(parsed.data, ['weight', 'confidence', 'isWeightScale'], { label: 'weight' });
    if (!shape.ok) {
      logger.warn('detect-weight: response schema invalid', { latencyMs: Date.now() - t0, missing: shape.missing });
      return res.status(500).json({
        ok: false,
        error: { code: 'SCHEMA_ERROR', message: 'AI response missing required fields', details: shape.missing },
      });
    }

    const latencyMs = Date.now() - t0;
    logger.info('detect-weight: success', {
      latencyMs, retryCount: attempts - 1,
      weight: parsed.data.weight, unit: parsed.data.unit, confidence: parsed.data.confidence,
    });

    return res.status(200).json({
      ok: true,
      data: parsed.data,
      _meta: { latencyMs, retryCount: attempts - 1 },
    });
  });
}
