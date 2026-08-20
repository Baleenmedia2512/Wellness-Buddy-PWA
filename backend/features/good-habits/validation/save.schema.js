import { ValidationError } from '../../../shared/lib/ValidationError.js';
import { isHabitType } from '../domain/habit.rules.js';

/**
 * @param {Record<string, unknown>} body
 */
export function validateSaveHabit(body) {
  const userIdRaw = body?.userId;
  if (userIdRaw == null || String(userIdRaw).trim() === '') {
    throw new ValidationError(400, 'userId is required');
  }

  const habitType = String(body?.habitType || '').trim();
  if (!isHabitType(habitType)) {
    throw new ValidationError(400, 'habitType must be before_after or image_notes');
  }

  const captureIdRaw = body?.captureId;
  const clientTimestampRaw = body?.clientTimestamp || body?.originalCapturedAt || null;

  return {
    userId: String(userIdRaw).trim(),
    habitType,
    notes: body?.notes == null ? '' : String(body.notes),
    imageBase64: body?.imageBase64 || null,
    beforeImageBase64: body?.beforeImageBase64 || null,
    afterImageBase64: body?.afterImageBase64 || null,
    captureId: captureIdRaw != null && String(captureIdRaw).trim() !== ''
      ? String(captureIdRaw).trim()
      : null,
    clientTimestamp: clientTimestampRaw != null && String(clientTimestampRaw).trim() !== ''
      ? String(clientTimestampRaw).trim()
      : null,
  };
}

/**
 * @param {Record<string, unknown>} query
 */
export function validateGetHabitImage(query) {
  const userIdRaw = query?.userId;
  const idRaw = query?.id ?? query?.logId;
  if (userIdRaw == null || String(userIdRaw).trim() === '') {
    throw new ValidationError(400, 'userId is required');
  }
  if (idRaw == null || String(idRaw).trim() === '') {
    throw new ValidationError(400, 'id is required');
  }
  return {
    userId: String(userIdRaw).trim(),
    id: String(idRaw).trim(),
  };
}

/**
 * @param {Record<string, unknown>} body
 */
export function validateDeleteHabit(body) {
  const userIdRaw = body?.userId;
  const idRaw = body?.id ?? body?.logId;
  if (userIdRaw == null || String(userIdRaw).trim() === '') {
    throw new ValidationError(400, 'userId is required');
  }
  if (idRaw == null || String(idRaw).trim() === '') {
    throw new ValidationError(400, 'id is required');
  }
  return {
    userId: String(userIdRaw).trim(),
    id: String(idRaw).trim(),
  };
}
