import * as repo from '../data/good-habits.repo.js';
import {
  assertHabitImages,
  normalizeHabitPayload,
} from '../domain/habit.rules.js';
import logger from '../../../shared/lib/logger.js';
import {
  nowUtc,
  parseClientTimestampToUtc,
  utcInstantToLegacyIstWallStorage,
  IANA_IST,
} from '../../../shared/lib/datetime/index.js';

function resolveCreatedAt(clientTimestamp) {
  let utcInstant = nowUtc();
  if (clientTimestamp) {
    try {
      utcInstant = parseClientTimestampToUtc(clientTimestamp).utcIso;
    } catch (err) {
      logger.warn('good-habits.save: invalid clientTimestamp, using server now', {
        err: err.message,
      });
    }
  }
  return utcInstantToLegacyIstWallStorage(utcInstant, IANA_IST);
}

export async function saveHabit(input) {
  const normalized = normalizeHabitPayload(input);
  assertHabitImages(normalized);

  const createdAt = resolveCreatedAt(input.clientTimestamp);
  const row = await repo.insertHabit({
    UserId: input.userId,
    HabitType: normalized.habitType,
    Notes: normalized.notes || null,
    ImageBase64: normalized.imageBase64,
    BeforeImageBase64: normalized.beforeImageBase64,
    AfterImageBase64: normalized.afterImageBase64,
    CaptureID: input.captureId || null,
    IsDeleted: 0,
    CreatedAt: createdAt,
    UpdatedAt: createdAt,
  });

  return {
    httpStatus: 201,
    body: {
      ok: true,
      data: {
        id: row?.ID,
        habitType: row?.HabitType,
        notes: row?.Notes || '',
        createdAt: row?.CreatedAt,
      },
    },
  };
}

export async function getHabitImage({ id, userId }) {
  const data = await repo.getHabitImage(id, userId);
  if (!data) {
    return { httpStatus: 404, body: { success: false, message: 'Habit not found' } };
  }
  const imageBase64 = data.ImageBase64 || data.AfterImageBase64 || data.BeforeImageBase64 || null;
  return {
    httpStatus: 200,
    body: { success: true, imageBase64 },
  };
}

export async function deleteHabit({ id, userId }) {
  const updatedAt = utcInstantToLegacyIstWallStorage(nowUtc(), IANA_IST);
  const data = await repo.softDeleteHabit(id, userId, updatedAt);
  if (!data) {
    return { httpStatus: 404, body: { success: false, message: 'Habit not found' } };
  }
  return { httpStatus: 200, body: { ok: true, data: { deleted: true } } };
}

export async function undoDeleteHabit({ id, userId }) {
  const updatedAt = utcInstantToLegacyIstWallStorage(nowUtc(), IANA_IST);
  const data = await repo.restoreHabit(id, userId, updatedAt);
  if (!data) {
    return { httpStatus: 404, body: { success: false, message: 'Habit not found' } };
  }
  return { httpStatus: 200, body: { ok: true, data: { restored: true } } };
}
