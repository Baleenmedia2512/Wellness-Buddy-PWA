/**
 * backend/features/quick-share/api/analyze-in-background.js
 * ---------------------------------------------------------------------------
 * Fire-and-forget Gemini call. Caller MUST NOT await — the response is
 * returned to the client first, then this runs while the serverless instance
 * stays warm. Any failure leaves the row at status=pending; a future cron
 * can retry. We log but never throw.
 * ---------------------------------------------------------------------------
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as repo from '../data/quick-share.repo.js';
import logger from '../../../shared/lib/logger.js';

const PROMPT =
  'Analyze this food image. Respond ONLY with strict JSON: ' +
  '{ "foods": [{ "name": string, "nutrition": { "calories": number, "protein": number, "carbs": number, "fat": number, "fiber": number } }], ' +
  '"total": { "calories": number, "protein": number, "carbs": number, "fat": number, "fiber": number }, ' +
  '"confidence": "high"|"medium"|"low" }. No markdown, no prose.';

/**
 * @param {{ id: number|string, imageBase64: string }} args
 */
export function runFoodAnalysisInBackground({ id, imageBase64 }) {
  // Intentionally not awaited. Capture the promise and swallow errors.
  Promise.resolve()
    .then(() => analyzeAndPersist({ id, imageBase64 }))
    .catch((err) => {
      logger.error?.('[quick-share] background analysis failed', { id, err: err?.message });
    });
}

async function analyzeAndPersist({ id, imageBase64 }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    logger.warn?.('[quick-share] GEMINI_API_KEY missing — skipping analysis');
    return;
  }

  const mimeMatch = imageBase64.match(/^data:(image\/[a-zA-Z]+);base64,/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const base64Data = imageBase64.replace(/^data:image\/[a-zA-Z]+;base64,/, '');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

  const result = await model.generateContent([
    { inlineData: { mimeType, data: base64Data } },
    PROMPT,
  ]);

  const raw = result.response.text().trim();
  const json = stripJsonFence(raw);
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch {
    logger.warn?.('[quick-share] gemini returned non-JSON', { id, raw: raw.slice(0, 200) });
    return;
  }

  const confidence = convertConfidence(parsed.confidence);
  await repo.updateAnalysis({ id, analysisData: parsed, confidenceScore: confidence });
  logger.debug?.('[quick-share] analysis stored', { id });
}

function stripJsonFence(text) {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
}

function convertConfidence(c) {
  if (typeof c === 'number') return c;
  if (typeof c !== 'string') return null;
  switch (c.toLowerCase()) {
    case 'very_high': return 0.95;
    case 'high':      return 0.9;
    case 'medium':    return 0.7;
    case 'low':       return 0.5;
    case 'very_low':  return 0.3;
    default:          return null;
  }
}
