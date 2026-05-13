/**
 * adminApi.js — all admin REST calls in one place.
 *
 * Wraps the four endpoints used by AdminDashboard:
 *   GET  /api/token/usage
 *   GET  /api/token/pricing
 *   GET  /api/token/correction
 *   POST /api/token/correction
 *
 * Returns plain JSON envelopes so hooks can stay free of fetch wiring.
 */
import { formatLocalDate } from './dateRangeUtils';

const BASE = process.env.REACT_APP_API_BASE_URL;
const NO_CACHE = { 'Cache-Control': 'no-cache', Pragma: 'no-cache' };

const buildUsageUrl = ({ email, timeRange, startDate, endDate }) => {
  const today = formatLocalDate(new Date());
  let url = `${BASE}/api/token/usage?email=${encodeURIComponent(email)}&userToday=${today}`;
  if (timeRange === 'custom' && startDate && endDate) {
    url += `&startDate=${formatLocalDate(startDate)}&endDate=${formatLocalDate(endDate)}`;
  } else {
    url += `&timeRange=${timeRange}`;
  }
  return url;
};

export const fetchTokenUsage = async (params) => {
  const res = await fetch(buildUsageUrl(params), { cache: 'no-store', headers: NO_CACHE });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || `HTTP ${res.status}`);
  return json.data;
};

export const fetchTokenPricing = async (email, modelName = 'gemini-2.5-flash-lite') => {
  const url = `${BASE}/api/token/pricing?email=${encodeURIComponent(email)}&modelName=${modelName}&t=${Date.now()}`;
  const res = await fetch(url, { cache: 'no-store', headers: NO_CACHE });
  if (!res.ok) return null;
  const json = await res.json();
  return json.success ? json.data : null;
};

export const fetchTokenCorrection = async ({ email, timeRange, startDate, endDate }) => {
  const params = new URLSearchParams({ email, timeRange });
  if (timeRange === 'custom' && startDate && endDate) {
    params.append('startDate', formatLocalDate(startDate));
    params.append('endDate', formatLocalDate(endDate));
  }
  const res = await fetch(`${BASE}/api/token/correction?${params}`, { cache: 'no-store', headers: NO_CACHE });
  if (!res.ok) return null;
  const json = await res.json();
  return json.success ? { ...json.data, latestUsageTimestamp: json.latestUsageTimestamp } : null;
};

export const saveTokenCorrection = async (payload) => {
  const body = {
    ...payload,
    startDate: payload.timeRange === 'custom' ? formatLocalDate(payload.startDate) : null,
    endDate: payload.timeRange === 'custom' ? formatLocalDate(payload.endDate) : null,
  };
  const res = await fetch(`${BASE}/api/token/correction`, {
    method: 'POST', cache: 'no-store',
    headers: { 'Content-Type': 'application/json', ...NO_CACHE },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || `HTTP ${res.status}`);
  return json.data;
};
