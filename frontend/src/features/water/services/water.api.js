import { getApiBaseUrl } from '../../../config/api.config.js';

const base = () => getApiBaseUrl();

export async function getIntake(userId, date, { cacheBust = true } = {}) {
  const ts = cacheBust ? `&_t=${Date.now()}` : '';
  const url = `${base()}/api/water/intake?userId=${encodeURIComponent(userId)}&date=${encodeURIComponent(date)}${ts}`;
  const res = await fetch(url);
  return res.json();
}
