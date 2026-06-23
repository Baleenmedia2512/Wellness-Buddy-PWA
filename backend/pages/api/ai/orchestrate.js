/**
 * backend/pages/api/ai/orchestrate.js
 * ---------------------------------------------------------------------------
 * Enterprise AI Analysis entry point.
 *
 * Single route that replaces the old two-step  detect-image-type →
 * analyze-nutrition  chain for all new clients.
 *
 * Request (multipart/form-data):
 *   image       File    Required. The image to analyse.
 *   captureId   string  Optional. DB capture ID for idempotency + tracing.
 *   userId      string  Optional. Caller user ID for audit trails.
 *   foodRowId   string  Optional. food_nutrition_data_table PK for enrichment write-back.
 *
 * Response (200):
 *   {
 *     ok:              true,
 *     traceId:         string,
 *     captureId:       string | null,
 *     imageType:       "food" | "weight" | "education" | "smartwatch" | "other",
 *     confidence:      number,
 *     details:         object,
 *     fastNutrition:   { calories, protein, carbs, fat, fiber } | null,
 *     weightReading:   { value, unit } | null,
 *     smartwatchData:  { caloriesBurned, steps, source } | null,
 *     educationData:   { isMeeting, platform } | null,
 *     enrichmentJobId: string | null,    ← poll /api/ai/job-status?jobId=...
 *     enrichmentStatus:"processing" | null,
 *     observability:   { traceId, totalLatencyMs, tokenUsage, retryCount },
 *     duplicate:       boolean,
 *   }
 *
 * Error responses follow the standard { ok: false, error: { code, message } } shape.
 *
 * Security: GEMINI_API_KEY is server-side only. No credentials in response.
 * Temp files: cleaned up via withTempFileCleanup (try/finally).
 * ---------------------------------------------------------------------------
 */

import formidable from 'formidable';
import fs from 'fs';
import logger from '../../../shared/lib/logger.js';
import { withTempFileCleanup } from '../../../shared/lib/gemini/tempFileCleanup.js';
import { analyse } from '../../../shared/lib/ai-orchestration/AIAnalysisOrchestrator.js';

export const config = {
  api: { bodyParser: false },
};

// ── Input sanitisation ────────────────────────────────────────────────────────

function sanitiseString(val) {
  if (val == null) return null;
  const s = Array.isArray(val) ? val[0] : String(val);
  return s.trim() || null;
}

function sanitiseInt(val) {
  const n = parseInt(sanitiseString(val) ?? '', 10);
  return Number.isFinite(n) ? n : null;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      ok: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Only POST allowed' },
    });
  }

  const form = formidable({ maxFileSize: 10 * 1024 * 1024 });
  let fields, files;
  try {
    [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, f, fi) => (err ? reject(err) : resolve([f, fi])));
    });
  } catch (err) {
    logger.warn('orchestrate: form parse error', { error: err.message });
    return res.status(400).json({
      ok: false,
      error: { code: 'FORM_PARSE_ERROR', message: 'Failed to parse multipart form data' },
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

    // Extract optional metadata fields
    const captureId = sanitiseString(fields.captureId);
    const userId    = sanitiseString(fields.userId);
    const foodRowId = sanitiseInt(fields.foodRowId);

    // Read image into buffer; keep base64 for enrichment job queue
    let imageBuffer, imageBase64;
    try {
      imageBuffer  = fs.readFileSync(imageFile.filepath);
      imageBase64  = imageBuffer.toString('base64');
    } catch (err) {
      logger.error('orchestrate: failed to read image file', { error: err.message });
      return res.status(500).json({
        ok: false,
        error: { code: 'IMAGE_READ_ERROR', message: 'Failed to read uploaded image' },
      });
    }

    const mimeType = imageFile.mimetype ?? 'image/jpeg';

    logger.info('orchestrate: request received', {
      captureId: captureId ?? null,
      userId:    userId    ?? null,
      foodRowId: foodRowId ?? null,
      mimeType,
      sizeBytes: imageBuffer.length,
    });

    try {
      const result = await analyse({
        imageBuffer,
        mimeType,
        captureId,
        userId,
        imageBase64,
        foodRowId,
      });

      return res.status(200).json({ ok: true, ...result });
    } catch (err) {
      logger.error('orchestrate: unhandled orchestrator error', {
        error:     err.message,
        code:      err.code  ?? null,
        status:    err.status ?? null,
        captureId: captureId ?? null,
      });

      const status = err.status ?? 500;
      return res.status(status).json({
        ok:    false,
        error: {
          code:    err.code    ?? 'ORCHESTRATION_ERROR',
          message: err.message ?? 'AI analysis failed',
        },
      });
    }
  });
}
