/**
 * frontend/src/features/nutrition/services/nutritionKnowledge.api.js
 * Client for ADR-0005 nutrition-knowledge APIs.
 */
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';

/**
 * Optional text AI enrich — requires a pending AI credit reservation.
 * Deducts 1 credit only on successful recognised nutrition.
 */
export async function enrichFoodWithAi({
  userId,
  name,
  weightG = 100,
  reservationId,
  macros = null,
  apiBaseUrl = API_BASE_URL,
} = {}) {
  if (!userId || !name || !reservationId) {
    throw new Error('userId, name, and reservationId are required');
  }
  const res = await fetch(`${apiBaseUrl}/api/nutrition-knowledge/enrich`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, name, weightG, reservationId, macros }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    const msg = data?.error?.message || data?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data.data;
}

export async function resolveNutritionProfile({
  name,
  weightG = null,
  userId = null,
  apiBaseUrl = API_BASE_URL,
} = {}) {
  const params = new URLSearchParams({ name });
  if (weightG != null) params.set('weightG', String(weightG));
  if (userId != null) params.set('userId', String(userId));
  const res = await fetch(`${apiBaseUrl}/api/nutrition-knowledge/resolve?${params}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    throw new Error(data?.error?.message || `HTTP ${res.status}`);
  }
  return data.data;
}
