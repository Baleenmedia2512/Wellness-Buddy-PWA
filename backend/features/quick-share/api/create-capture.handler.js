/**
 * backend/features/quick-share/api/create-capture.handler.js
 * ---------------------------------------------------------------------------
 * Orchestrates POST /api/quick-share/captures.
 *  1. Insert pending row (with unguessable PublicShareToken + 30-day expiry).
 *  2. Kick off background Gemini analysis (fire-and-forget).
 *  3. Return { token, viewUrl } so the client can embed it in the share caption.
 * No business rules live here.
 * ---------------------------------------------------------------------------
 */
import * as repo from '../data/quick-share.repo.js';
import { generateToken, computeExpiry } from '../domain/token.rules.js';
import { runFoodAnalysisInBackground } from './analyze-in-background.js';

/**
 * @param {{ userId: string, kind: 'food', imageBase64: string, clientNonce: string|null }} input
 * @returns {Promise<{ httpStatus: 201, body: object }>}
 */
export async function createCapture(input) {
  const publicShareToken = generateToken();
  const shareExpiresAt = computeExpiry();

  const row = await repo.insertPendingCapture({
    userId: input.userId,
    imageBase64: input.imageBase64,
    publicShareToken,
    shareExpiresAt,
    clientNonce: input.clientNonce,
  });

  // Fire-and-forget. Errors are logged, not propagated.
  runFoodAnalysisInBackground({
    id: row?.ID ?? row?.id,
    imageBase64: input.imageBase64,
  });

  const publicBaseUrl =
    process.env.QUICK_SHARE_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    '';
  const viewUrl = `${publicBaseUrl.replace(/\/$/, '')}/s/${publicShareToken}`;

  return {
    httpStatus: 201,
    body: {
      success: true,
      token: publicShareToken,
      viewUrl,
      expiresAt: shareExpiresAt,
    },
  };
}
