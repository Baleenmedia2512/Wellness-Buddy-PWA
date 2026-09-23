/**
 * Activity Report hidden-users API client.
 */
import { getApiBaseUrl } from '../../../config/api.config.js';

const base = () => getApiBaseUrl();

/**
 * @param {number|string} userId
 * @returns {Promise<{ success: boolean, members?: Array, message?: string }>}
 */
export async function listActivityReportHiddenUsers(userId) {
  const params = new URLSearchParams({ userId: String(userId) });
  const res = await fetch(`${base()}/api/activity/report/hidden-users?${params}`, {
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Failed to load hidden users');
  }
  return data;
}

/**
 * @param {number|string} userId
 * @param {number|string} hiddenUserId
 */
export async function hideActivityReportUser(userId, hiddenUserId) {
  const res = await fetch(`${base()}/api/activity/report/hidden-users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: Number(userId),
      hiddenUserId: Number(hiddenUserId),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Failed to hide user');
  }
  return data;
}

/**
 * @param {number|string} userId
 * @param {number|string} hiddenUserId
 */
export async function unhideActivityReportUser(userId, hiddenUserId) {
  const params = new URLSearchParams({
    userId: String(userId),
    hiddenUserId: String(hiddenUserId),
  });
  const res = await fetch(`${base()}/api/activity/report/hidden-users?${params}`, {
    method: 'DELETE',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Failed to unhide user');
  }
  return data;
}
