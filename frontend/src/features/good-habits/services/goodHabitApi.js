import { getApiBaseUrl } from '../../../config/api.config.js';
import { apiFetch } from '../../../shared/services/apiFetch.js';
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

async function compressPayload(payload) {
  const next = { ...payload };
  if (next.imageBase64) next.imageBase64 = (await compress(next.imageBase64)) || next.imageBase64;
  if (next.beforeImageBase64) {
    next.beforeImageBase64 = (await compress(next.beforeImageBase64)) || next.beforeImageBase64;
  }
  if (next.afterImageBase64) {
    next.afterImageBase64 = (await compress(next.afterImageBase64)) || next.afterImageBase64;
  }
  return next;
}

/**
 * Legacy immediate save (apps &lt; 3.5.7 / no version header on server).
 * New apps should use requestGoodHabitOtp → verifyGoodHabitOtp.
 */
export async function saveGoodHabit(payload) {
  const next = await compressPayload(payload);
  const res = await apiFetch(`${getApiBaseUrl()}/api/good-habits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(next),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || body?.ok === false) {
    throw new Error(body?.error?.message || body?.message || "Couldn't save Task by Coach");
  }
  return body;
}

/** Step 1: email OTP + photo to the member's coach (no habit row yet). */
export async function requestGoodHabitOtp(payload) {
  const next = await compressPayload(payload);
  // Dedicated /otp path: old servers 404 instead of silently saving without otpKey.
  const res = await apiFetch(`${getApiBaseUrl()}/api/good-habits/otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...next, action: 'request-otp' }),
  });
  const body = await res.json().catch(() => null);
  if (res.status === 404) {
    throw new Error(
      'Server is outdated for coach OTP. Use localhost backend or deploy the new good-habits OTP API.',
    );
  }
  if (!res.ok || body?.ok === false || body?.success === false) {
    throw new Error(
      body?.error?.message || body?.message || "Couldn't email your coach",
    );
  }
  // runService returns { ok, data }; tolerate a nested data wrapper.
  const data = body?.data?.otpKey ? body.data : (body?.data?.data || body?.data || body);
  if (!data?.otpKey) {
    throw new Error('Could not start coach verification. Try Save again.');
  }
  return data;
}

/** Step 2: coach OTP → persist habit for today's IST score day. */
export async function verifyGoodHabitOtp({ userId, otp, otpKey }) {
  const res = await apiFetch(`${getApiBaseUrl()}/api/good-habits/otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'verify-otp',
      userId,
      otp,
      otpKey,
    }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || body?.ok === false) {
    throw new Error(body?.error?.message || body?.message || 'Invalid or expired OTP');
  }
  return body;
}

export async function deleteGoodHabit({ userId, id }) {
  const res = await apiFetch(`${getApiBaseUrl()}/api/good-habits`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, id }),
  });
  return res.json();
}

export async function undoDeleteGoodHabit({ userId, id }) {
  const res = await apiFetch(`${getApiBaseUrl()}/api/good-habits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, id, undo: true }),
  });
  return res.json();
}

export async function fetchGoodHabitImages({ userId, id }) {
  const res = await apiFetch(
    `${getApiBaseUrl()}/api/good-habits?id=${encodeURIComponent(id)}&userId=${encodeURIComponent(userId)}`,
    { cache: 'no-store' },
  );
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.success) {
    throw new Error(body?.message || "Couldn't load Task by Coach photos");
  }
  return {
    imageUrl: body.imageUrl || body.r2Url || null,
    beforeImageUrl: body.beforeImageUrl || null,
    afterImageUrl: body.afterImageUrl || null,
  };
}
