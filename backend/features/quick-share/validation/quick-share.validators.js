/**
 * backend/features/quick-share/validation/quick-share.validators.js
 * ---------------------------------------------------------------------------
 * Input validation for the quick-share endpoints. Pure functions — they
 * throw ValidationError(400) on bad input and return a normalised value
 * otherwise. No I/O, no env access.
 * ---------------------------------------------------------------------------
 */
import { ValidationError } from '../../../shared/lib/ValidationError.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATA_URL_RE = /^data:image\/(jpeg|jpg|png|webp);base64,/i;

/** Hard cap on the base64 payload (≈ 6 MB raw image). */
export const MAX_BASE64_BYTES = 9 * 1024 * 1024; // base64 ≈ 1.37× raw

/**
 * @param {unknown} body
 * @returns {{ userId: string, kind: 'food', imageBase64: string, clientNonce: string|null }}
 */
export function validateCreateCapture(body) {
  if (body == null || typeof body !== 'object') {
    throw new ValidationError(400, 'Request body is missing');
  }
  const { userId, kind = 'food', imageBase64, clientNonce } = body;

  if (userId == null || userId === '') {
    throw new ValidationError(400, 'userId is required');
  }
  // Phase 1: only food. Weight stays on the existing manual-entry flow.
  if (kind !== 'food') {
    throw new ValidationError(400, "kind must be 'food' (phase 1)");
  }
  if (typeof imageBase64 !== 'string' || !DATA_URL_RE.test(imageBase64)) {
    throw new ValidationError(400, 'imageBase64 must be a data:image/* URL');
  }
  if (imageBase64.length > MAX_BASE64_BYTES) {
    throw new ValidationError(413, 'imageBase64 exceeds size limit');
  }
  if (clientNonce != null && !UUID_RE.test(String(clientNonce))) {
    throw new ValidationError(400, 'clientNonce must be a UUID');
  }

  return {
    userId: String(userId),
    kind,
    imageBase64,
    clientNonce: clientNonce ? String(clientNonce) : null,
  };
}

/**
 * @param {unknown} params
 * @returns {{ token: string }}
 */
export function validatePublicToken(params) {
  const tokenRaw = params?.token;
  if (!tokenRaw || !UUID_RE.test(String(tokenRaw))) {
    throw new ValidationError(400, 'token must be a UUID');
  }
  return { token: String(tokenRaw) };
}
