import { ValidationError } from '../../shared/lib/ValidationError.js';

/** Minimum decoded payload length — rejects empty / tiny crops like `data:,`. */
const MIN_IMAGE_BYTES = 64;

/**
 * Strip a data-URL prefix and return raw base64 + mime.
 * Rejects empty payloads (e.g. `data:,`) that would fail Gemini TYPE_BYTES decode.
 */
export function parseImageBase64(imageBase64) {
  if (!imageBase64 || typeof imageBase64 !== 'string') {
    throw new ValidationError(400, 'imageBase64 is required');
  }

  const trimmed = imageBase64.trim();
  if (!trimmed || trimmed === 'data:,') {
    throw new ValidationError(400, 'imageBase64 is empty or invalid');
  }

  const mimeMatch = trimmed.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/i);
  const mimeType = mimeMatch ? mimeMatch[1].toLowerCase() : 'image/jpeg';
  const base64Data = trimmed
    .replace(/^data:[^;]*;base64,/i, '')
    .replace(/\s/g, '');

  if (!base64Data || base64Data === ',' || !/^[A-Za-z0-9+/]+=*$/.test(base64Data)) {
    throw new ValidationError(400, 'imageBase64 is not valid base64 image data');
  }

  let byteLength;
  try {
    byteLength = Buffer.from(base64Data, 'base64').length;
  } catch {
    throw new ValidationError(400, 'imageBase64 could not be decoded');
  }

  if (byteLength < MIN_IMAGE_BYTES) {
    throw new ValidationError(400, 'imageBase64 is too small to be a valid image');
  }

  return { mimeType, base64Data };
}

export function validateDetectFace(body) {
  const { imageBase64, userId, module } = body || {};
  const image = parseImageBase64(imageBase64);
  return {
    ...image,
    // User ID is optional because face detection is also used during profile
    // completion. When present, it is forwarded solely for AI telemetry.
    userId: userId == null || userId === '' ? null : String(userId),
    module: module == null || module === '' ? null : String(module),
  };
}

export function validateClubAttendance(query) {
  if (!query?.userId) throw new ValidationError(400, 'Missing required parameter: userId');
  return {
    userId: parseInt(query.userId, 10),
    startDate: query.startDate || null,
    endDate: query.endDate || null,
  };
}
