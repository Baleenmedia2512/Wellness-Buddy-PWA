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

  if (row?.ID) {
    try {
      const { persistGoodHabitImageKeys } = await import('../../../shared/lib/r2/activity-image-storage.service.js');
      await persistGoodHabitImageKeys(input.userId, row.ID, {
        imageBase64: normalized.imageBase64,
        beforeImageBase64: normalized.beforeImageBase64,
        afterImageBase64: normalized.afterImageBase64,
      }, { captureId: input.captureId });
    } catch (err) {
      logger.warn('good-habits.save: R2 persist skipped', {
        userId: String(input.userId),
        habitId: row.ID,
        message: err?.message || String(err),
      });
    }
  }

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

export async function getHabitImage({ id, userId, slot = null }) {
  const data = await repo.getHabitImage(id, userId);
  if (!data) {
    return { httpStatus: 404, body: { success: false, message: 'Habit not found' } };
  }
  let imageUrl = null;
  let beforeImageUrl = null;
  let afterImageUrl = null;
  try {
    const { r2ActivityImagesEnabled } = await import('../../../shared/lib/r2/activity-image-storage.service.js');
    const { avatarRedirectUrl } = await import('../../../shared/lib/r2/s3.js');
    if (r2ActivityImagesEnabled()) {
      imageUrl = data.ImageKey ? avatarRedirectUrl(data.ImageKey) : null;
      beforeImageUrl = data.BeforeImageKey ? avatarRedirectUrl(data.BeforeImageKey) : null;
      afterImageUrl = data.AfterImageKey ? avatarRedirectUrl(data.AfterImageKey) : null;
    }
  } catch {
    imageUrl = null;
  }
  const bySlot = {
    main: imageUrl || afterImageUrl || beforeImageUrl,
    before: beforeImageUrl,
    after: afterImageUrl,
  };
  const r2Url = slot ? (bySlot[slot] || null) : (bySlot.main || null);
  if (slot) {
    if (!r2Url) return { httpStatus: 404, body: { success: false, message: 'No image' } };
    return { httpStatus: 200, body: { success: true, r2Url } };
  }
  return {
    httpStatus: 200,
    body: {
      success: true,
      r2Url,
      imageUrl,
      beforeImageUrl,
      afterImageUrl,
    },
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
