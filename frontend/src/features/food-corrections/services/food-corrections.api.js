import { getApiBaseUrl } from '../../../config/api.config.js';

const base = () => getApiBaseUrl();

export async function listCorrections(userId) {
  const res = await fetch(`${base()}/api/food-corrections?userId=${encodeURIComponent(userId)}`);
  return res.json();
}

export async function saveCorrection(payload) {
  const res = await fetch(`${base()}/api/food-corrections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function getGlobalCorrections(userId) {
  const url = userId
    ? `${base()}/api/food-corrections/global?userId=${encodeURIComponent(userId)}&t=${Date.now()}`
    : `${base()}/api/food-corrections/global?t=${Date.now()}`;
  const res = await fetch(url);
  return res.json();
}

export async function searchFoodHistory(userId, query) {
  const res = await fetch(
    `${base()}/api/food-corrections/search?userId=${encodeURIComponent(userId)}&query=${encodeURIComponent(query)}`
  );
  return res.json();
}

export async function updateNutritionAnalysis(payload) {
  const res = await fetch(`${base()}/api/food-corrections/nutrition`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function getNutritionStats(userId, { date, detailed = false } = {}) {
  const params = new URLSearchParams({ userId: String(userId) });
  if (date) params.set('date', date);
  if (detailed) params.set('detailed', 'true');
  const res = await fetch(`${base()}/api/food-corrections/stats?${params.toString()}`);
  return res.json();
}
