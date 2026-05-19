/**
 * backend/features/quick-share/api/create.handler.js
 * ---------------------------------------------------------------------------
 * POST /api/quick-share/captures
 *
 * 1. Validates input.
 * 2. Generates a share token + computes expiry.
 * 3. Persists a capture row (AnalysisData = null initially).
 * 4. Triggers background Gemini food-analysis asynchronously.
 * 5. Returns { ok: true, data: { token, viewUrl, expiresAt } } immediately.
 *
 * The caller can show the WhatsApp share button before analysis completes.
 * ---------------------------------------------------------------------------
 */
import { validateCreateCapture } from '../validation/captures.schema.js';
import { generateShareToken, computeShareExpiry, buildPublicUrl } from '../domain/token.rules.js';
import * as repo from '../data/captures.repo.js';
import logger from '../../../shared/lib/logger.js';

/**
 * @param {object} req - Next.js request
 * @param {object} res - Next.js response
 */
export async function createCaptureHandler(req, res) {
  const validation = validateCreateCapture(req.body);
  if (!validation.ok) {
    return res.status(422).json({ ok: false, error: { code: 'INVALID_INPUT', message: validation.error } });
  }

  const { imageBase64, mimeType, userId } = req.body;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';

  const token = generateShareToken();
  const expiresAt = computeShareExpiry();
  const viewUrl = buildPublicUrl(appUrl, token);

  let captureId;
  try {
    const row = await repo.createCapture({ userId, token, expiresAt, imageBase64 });
    captureId = row.ID;
  } catch (err) {
    logger.error('[create.handler] DB insert failed', { userId, err: err.message });
    return res.status(500).json({ ok: false, error: { code: 'DB_ERROR', message: 'Failed to save capture.' } });
  }

  // ── Background analysis (fire-and-forget, never blocks the response) ──
  runBackgroundAnalysis({ captureId, imageBase64, mimeType, userId }).catch((err) => {
    logger.warn('[create.handler] Background analysis failed', { captureId, err: err?.message });
  });

  return res.status(201).json({
    ok: true,
    data: { token, viewUrl, expiresAt: expiresAt.toISOString() },
  });
}

/**
 * Call Gemini to analyse the image and persist the result.
 * This runs after the HTTP response has already been sent.
 *
 * @param {{ captureId: number, imageBase64: string, mimeType: string, userId: string }} opts
 */
async function runBackgroundAnalysis({ captureId, imageBase64, mimeType, userId }) {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    logger.warn('[create.handler] GEMINI_API_KEY not set — skipping background analysis');
    return;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

  const prompt = `Analyse this food image. Return ONLY valid JSON:
{
  "type": "food",
  "foods": [
    { "name": "string", "quantity": "string", "calories": number, "protein": number, "carbs": number, "fat": number }
  ],
  "total": { "calories": number, "protein": number, "carbs": number, "fat": number, "fiber": number },
  "confidence": "high" | "medium" | "low"
}`;

  const imagePart = {
    inlineData: {
      data: imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64,
      mimeType,
    },
  };

  const result = await model.generateContent([prompt, imagePart]);
  const raw = result.response.text();

  let analysisData;
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    analysisData = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw };
  } catch {
    analysisData = { raw };
  }

  await repo.updateCaptureAnalysis({ id: captureId, analysisData });
  logger.info('[create.handler] Background analysis complete', { captureId, userId });
}
