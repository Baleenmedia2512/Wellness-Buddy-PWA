/**
 * Weight feature — HTTP layer.
 * The ONLY place in the frontend allowed to call /api/weight/*.
 * Components and hooks must import from here.
 */
import { getApiBaseUrl } from '../../../config/api.config.js';
import { toStorageThumbnail } from '../../../shared/utils/storageThumbnail.js';
import { setMarathonWeightComparisonCache } from '../../marathon/marathonWeightComparisonCache.js';

/** In-memory latest-weight cache — sync read for instant manual-entry pre-fill. */
const latestWeightCache = new Map();

export function getCachedLatestWeight(userId) {
  if (!userId) return null;
  return latestWeightCache.get(String(userId)) ?? null;
}

export function setCachedLatestWeight(userId, entry) {
  if (!userId || entry?.value == null) return;
  const parsed = parseFloat(entry.value);
  if (!Number.isFinite(parsed)) return;
  latestWeightCache.set(String(userId), {
    value: parsed,
    unit: entry.unit || 'kg',
    date: entry.date || null,
  });
}

async function request(path, opts = {}) {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  let json = null;
  try { json = await res.json(); } catch { /* tolerate empty body */ }
  return { ok: res.ok, status: res.status, data: json };
}

export async function saveWeight(payload) {
  const next = { ...payload };
  if (next.imageBase64ToSave) {
    next.imageBase64ToSave = await toStorageThumbnail(next.imageBase64ToSave);
  }
  const result = await request('/api/weight/save', {
    method: 'POST',
    body: JSON.stringify(next),
  });
  if (result.ok && result.data?.success && next?.userId != null) {
    const raw = result.data.data?.weightValue ?? next.weightValue;
    const parsed = parseFloat(raw);
    if (Number.isFinite(parsed)) {
      setCachedLatestWeight(next.userId, {
        value: parsed,
        unit: next.unit || 'kg',
        date: result.data.data?.createdAt || new Date().toISOString(),
      });
    }
    void refreshMarathonWeightComparisonCache(next.userId);
  }
  return result;
}

/**
 * Refresh cached marathon Day 0 weight comparison (WhatsApp shares).
 * @param {string|number} userId
 */
export async function refreshMarathonWeightComparisonCache(userId, {
  todayYmd = null,
  currentDay0Weight = null,
} = {}) {
  if (!userId) return null;
  const params = new URLSearchParams({ userId: String(userId) });
  if (todayYmd) params.set('todayYmd', todayYmd);
  if (currentDay0Weight != null && currentDay0Weight !== '') {
    params.set('currentDay0Weight', String(currentDay0Weight));
  }
  const { ok, data } = await request(
    `/api/weight/marathon-comparison?${params.toString()}`,
    {
      method: 'GET',
      headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
    },
  );
  if (!ok || !data?.success) return null;
  setMarathonWeightComparisonCache(data.data ?? null);
  return data.data ?? null;
}

export function getWeightHistory(userId, { includeImage = false, cacheBust = true, viewerUserId } = {}) {
  const params = new URLSearchParams({ userId, includeImage: String(includeImage) });
  if (cacheBust) params.set('_t', String(Date.now()));
  if (viewerUserId != null && viewerUserId !== '') {
    params.set('viewerUserId', String(viewerUserId));
  }
  return request(`/api/weight/history?${params.toString()}`, {
    method: 'GET',
    headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
  });
}

/**
 * Most recently saved weight entry — used as reference in manual entry.
 * @returns {Promise<{ value: number, unit: string, date: string } | null>}
 */
export async function fetchLatestWeightEntry(userId) {
  if (!userId) return null;
  const { ok, data } = await getWeightHistory(userId, { includeImage: false, cacheBust: true });
  if (!ok || !data?.success || !data.stats?.latestWeight) return null;
  const { value, date } = data.stats.latestWeight;
  const parsed = parseFloat(value);
  if (!Number.isFinite(parsed)) return null;
  const entry = { value: parsed, unit: 'kg', date };
  setCachedLatestWeight(userId, entry);
  return entry;
}

/** Warm cache in background — safe to call on page mount. */
export function warmLatestWeightCache(userId) {
  if (!userId) return;
  fetchLatestWeightEntry(userId).catch(() => {});
}

export function deleteWeight({ userId, entryId }) {
  return request('/api/weight/delete', {
    method: 'DELETE',
    body: JSON.stringify({ userId, entryId }),
  });
}

export function undoDeleteWeight({ id, userId }) {
  return request('/api/weight/undo', {
    method: 'POST',
    body: JSON.stringify({ id, userId }),
  });
}
