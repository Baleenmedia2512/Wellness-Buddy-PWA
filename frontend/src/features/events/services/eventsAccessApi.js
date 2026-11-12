import { apiFetch } from '../../../shared/services/apiFetch.js';

/**
 * @param {object|null} body
 * @returns {{ access: string, daysLeft: number|null, canUseHostTools: boolean }|null}
 */
function readAccess(body) {
  const data = body?.data;
  if (!data || typeof data.access !== 'string' || typeof data.canUseHostTools !== 'boolean') {
    return null;
  }
  const daysLeft = data.daysLeft == null ? null : Number(data.daysLeft);
  return {
    access: data.access,
    daysLeft: Number.isFinite(daysLeft) ? daysLeft : null,
    canUseHostTools: data.canUseHostTools === true,
  };
}

/**
 * @param {string|number} userId
 */
export async function fetchEventsAccess(userId) {
  try {
    const response = await apiFetch(
      `/api/payments/events-access?userId=${encodeURIComponent(userId)}`,
      { method: 'GET', cache: 'no-store' },
    );
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return null;
    return readAccess(body);
  } catch {
    return null;
  }
}

/**
 * @param {string|number} userId
 */
export async function startEventsTrial(userId) {
  const response = await apiFetch('/api/payments/start-events-trial', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof body?.message === 'string' && body.message.trim()
      ? body.message.trim()
      : 'The free trial could not be started';
    throw new Error(message);
  }
  const access = readAccess(body);
  if (!access) throw new Error('The free trial could not be started');
  return access;
}
