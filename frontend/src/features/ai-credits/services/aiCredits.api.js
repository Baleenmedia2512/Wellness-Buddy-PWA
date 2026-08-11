/**
 * Frontend client for /api/ai-credits/* — status, reserve, confirm, release, admin.
 * Never hardcodes dailyLimit; display API values only.
 */
import { getApiBaseUrl } from '../../../config/api.config.js';

function base(apiBaseUrl) {
  return (apiBaseUrl || getApiBaseUrl() || '').replace(/\/$/, '');
}

async function parseJson(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.ok === false) {
    const msg = data?.message || data?.error?.message || `Request failed (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data?.data ?? data;
}

export async function fetchAiCreditsStatus({ userId, apiBaseUrl } = {}) {
  if (!userId) throw new Error('userId is required');
  const res = await fetch(
    `${base(apiBaseUrl)}/api/ai-credits/status?userId=${encodeURIComponent(userId)}`,
  );
  return parseJson(res);
}

export async function reserveAiCredit({ userId, apiBaseUrl } = {}) {
  if (!userId) throw new Error('userId is required');
  const res = await fetch(`${base(apiBaseUrl)}/api/ai-credits/reserve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  return parseJson(res);
}

export async function confirmAiCredit({
  userId,
  reservationId,
  analysisResult = null,
  apiBaseUrl,
} = {}) {
  if (!userId || !reservationId) throw new Error('userId and reservationId are required');
  const res = await fetch(`${base(apiBaseUrl)}/api/ai-credits/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, reservationId, analysisResult }),
  });
  return parseJson(res);
}

export async function releaseAiCredit({ userId, reservationId, apiBaseUrl } = {}) {
  if (!userId || !reservationId) throw new Error('userId and reservationId are required');
  const res = await fetch(`${base(apiBaseUrl)}/api/ai-credits/release`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, reservationId }),
  });
  return parseJson(res);
}

/**
 * Release a credit hold created by reserveAiCredit().
 * No-op when reservationId or userId is missing.
 * Logs failures (does not throw) so background capture flows can continue.
 *
 * @param {{ userId: string|number, reservationId: string|number|null|undefined, apiBaseUrl?: string, reason?: string }}
 */
export async function releaseReservedAiCredit({
  userId,
  reservationId,
  apiBaseUrl,
  reason = 'unspecified',
} = {}) {
  if (!reservationId || !userId) {
    return { skipped: true, reason: 'no_reservation' };
  }
  try {
    return await releaseAiCredit({ userId, reservationId, apiBaseUrl });
  } catch (err) {
    console.error('[ai-credits] releaseReservedAiCredit failed', {
      reservationId,
      ownerUserId: userId,
      reason,
      message: err?.message || String(err),
      status: err?.status ?? null,
    });
    return { failed: true, reason };
  }
}

export async function fetchAiCreditsAdminConfig({
  requesterUserId,
  requesterEmail,
  apiBaseUrl,
} = {}) {
  const params = new URLSearchParams();
  if (requesterUserId) params.set('requesterUserId', String(requesterUserId));
  if (requesterEmail) params.set('requesterEmail', String(requesterEmail));
  const res = await fetch(
    `${base(apiBaseUrl)}/api/ai-credits/admin-config?${params.toString()}`,
  );
  return parseJson(res);
}

export async function saveAiCreditsAdminConfig({
  requesterUserId,
  requesterEmail,
  dailyAiCredits,
  aiModeEnabled,
  apiBaseUrl,
} = {}) {
  const res = await fetch(`${base(apiBaseUrl)}/api/ai-credits/admin-config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requesterUserId,
      requesterEmail,
      dailyAiCredits,
      aiModeEnabled,
    }),
  });
  return parseJson(res);
}
