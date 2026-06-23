/**
 * waterStorageService.js
 * Persistence + remote IO for the water-tracker slice.
 *
 * Read  : GET /api/water/intake?userId=X&date=YYYY-MM-DD
 * Write : POST via shared nutritionPersistence (stores a food_nutrition_data_table
 *         row with AnalysisData.foods = [{ name:"water", volume_ml: N, calories: 0 }])
 *
 * All UI / state / calculations live in useWaterTracker. This module is
 * intentionally side-effect free except for fetch + localStorage.
 */
import { getApiBaseUrl } from '../../../config/api.config.js';
import { saveNutritionAnalysis } from '../../../shared/services/nutritionPersistence';

const STORAGE_KEY_USER_ID = 'dbUserId';
const STORAGE_KEY_EMAIL = 'userEmail';

/** Returns today's date as YYYY-MM-DD in the user's local timezone. */
export function todayLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Pure formatter: 1500 -> "1.5 L", 250 -> "250 ml". */
export function formatMl(ml) {
  if (ml >= 1000) return `${(ml / 1000).toFixed(1).replace(/\.0$/, '')} L`;
  return `${ml} ml`;
}

/** Reads cached numeric user id from localStorage (or null). */
export function getCachedUserId() {
  const raw = localStorage.getItem(STORAGE_KEY_USER_ID);
  return raw ? Number(raw) : null;
}

/** Returns the cached user email (prop fallback handled by caller). */
export function getCachedUserEmail() {
  return localStorage.getItem(STORAGE_KEY_EMAIL);
}

/** Looks up a user id via /api/user/lookup and caches it. Returns id or null. */
export async function resolveUserIdByEmail(email) {
  if (!email) return null;
  const res = await fetch(`${getApiBaseUrl()}/api/user/lookup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const data = await res.json().catch(() => ({}));
  if (data?.success && data.userId) {
    localStorage.setItem(STORAGE_KEY_USER_ID, String(data.userId));
    return data.userId;
  }
  return null;
}

/** Fetches today's water intake summary for a user. Throws on non-2xx. */
export async function fetchWaterIntake(userId, date = todayLocal()) {
  const url = `${getApiBaseUrl()}/api/water/intake?userId=${encodeURIComponent(
    userId,
  )}&date=${encodeURIComponent(date)}&_t=${Date.now()}`;
  const res = await fetch(url, {
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache' },
  });
  if (!res.ok) throw new Error(`Server error ${res.status}`);
  return res.json();
}

/** Logs a water intake event. ml must be > 0. */
export async function logWaterIntake({ userId, ml, userEmail, source = 'WaterTracker' }) {
  if (!userId) throw new Error('userId required');
  if (!ml || ml <= 0) throw new Error('Please enter a valid amount.');
  const analysisResult = {
    foods: [
      {
        name: 'water',
        volume_ml: ml,
        calories: 0,
        weight_g: ml, // 1 ml ≈ 1 g for water
        unit: 'ml',
        isLiquid: true,
        portion: `${ml} ml`,
        nutrition: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
      },
    ],
    total: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
    confidence: 'high',
  };
  return saveNutritionAnalysis({
    userId,
    imagePath: null,
    imageBase64: null,
    analysisResult,
    deviceInfo: { source },
    userEmail,
    taskTypeHint: 'water',
  }).then((result) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('wellness:tasks-changed'));
    }
    return result;
  });
}
