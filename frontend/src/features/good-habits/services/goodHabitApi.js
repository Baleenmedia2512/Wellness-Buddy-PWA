import { getApiBaseUrl } from '../../../config/api.config.js';
import { toStorageThumbnail } from '../../../shared/utils/storageThumbnail.js';
import {
  GOOD_HABIT_IMAGE_MAX_DIMENSION_PX,
  GOOD_HABIT_IMAGE_TARGET_BYTES,
} from '../../../shared/constants/limits.js';

const THUMB_OPTS = {
  targetBytes: GOOD_HABIT_IMAGE_TARGET_BYTES,
  maxDim: GOOD_HABIT_IMAGE_MAX_DIMENSION_PX,
};

async function compress(imageBase64) {
  if (!imageBase64) return null;
  return toStorageThumbnail(imageBase64, THUMB_OPTS);
}

export async function saveGoodHabit(payload) {
  const next = { ...payload };
  if (next.imageBase64) next.imageBase64 = (await compress(next.imageBase64)) || next.imageBase64;
  if (next.beforeImageBase64) {
    next.beforeImageBase64 = (await compress(next.beforeImageBase64)) || next.beforeImageBase64;
  }
  if (next.afterImageBase64) {
    next.afterImageBase64 = (await compress(next.afterImageBase64)) || next.afterImageBase64;
  }

  const res = await fetch(`${getApiBaseUrl()}/api/good-habits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(next),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || body?.ok === false) {
    throw new Error(body?.error?.message || body?.message || "Couldn't save Good Habit");
  }
  return body;
}

export async function deleteGoodHabit({ userId, id }) {
  const res = await fetch(`${getApiBaseUrl()}/api/good-habits`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, id }),
  });
  return res.json();
}

export async function undoDeleteGoodHabit({ userId, id }) {
  const res = await fetch(`${getApiBaseUrl()}/api/good-habits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, id, undo: true }),
  });
  return res.json();
}

export async function fetchGoodHabitImages({ userId, id }) {
  const res = await fetch(
    `${getApiBaseUrl()}/api/good-habits?id=${encodeURIComponent(id)}&userId=${encodeURIComponent(userId)}&view=detail`,
    { cache: 'no-store' },
  );
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.success) {
    throw new Error(body?.message || "Couldn't load Good Habit photos");
  }
  return {
    imageBase64: body.imageBase64 || null,
    beforeImageBase64: body.beforeImageBase64 || null,
    afterImageBase64: body.afterImageBase64 || body.imageBase64 || null,
  };
}
