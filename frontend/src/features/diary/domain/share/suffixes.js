/**
 * diary/domain/share/suffixes.js
 *
 * Compact one-line activity suffixes for Quick Share captions:
 *   "Name · Wellness Valley v X.Y.Z, Consumed: 1 L water so far today"
 *
 * Rich multi-line templates stay in the per-activity builders for Diary share.
 */

import { DIARY_FOOD_ACTIVITY } from '../activityType';
import { formatWaterVolume } from '../formatVolume';
import { formatShakeProductScoops } from './shakeShare';

/**
 * @param {'food'|'water'|'afresh'|'shake'|'education'|'weight'|string} activityType
 * @param {object} [payload]
 * @param {number} [payload.idealWeight] kg target (BMI 19–23) appended as "Ideal Weight: X kg"
 * @returns {string|null} compact suffix, or null when nothing useful to append
 */
export function buildDiaryShareSuffix(activityType, payload = {}) {
  switch (activityType) {
    case DIARY_FOOD_ACTIVITY.WATER:
    case 'water': {
      const consumed = payload.volumeLabel
        || (payload.volumeMl != null ? formatWaterVolume(payload.volumeMl) : null);
      const day = dayTotalSuffix(payload);
      return consumed
        ? `Consumed: ${consumed} water${day}`
        : `Consumed water${day}`;
    }
    case DIARY_FOOD_ACTIVITY.AFRESH:
    case 'afresh': {
      const scoops = Number(payload.scoops);
      const count = Number.isFinite(scoops) && scoops > 0 ? scoops : 1;
      const scoopWord = count === 1 ? 'scoop' : 'scoops';
      return `Consumed: ${count} ${scoopWord} Afresh${dayTotalSuffix(payload)}`;
    }
    case DIARY_FOOD_ACTIVITY.SHAKE:
    case 'shake': {
      const name = (payload.shakeName || 'Protein Shake').trim();
      const scoopLine = formatShakeProductScoops(payload.shakeProducts);
      if (scoopLine) return `${name}, ${scoopLine}`;
      const servings = Number(payload.servings);
      const count = Number.isFinite(servings) && servings > 0 ? servings : 1;
      return `${name}, serving ${count}`;
    }
    case 'education': {
      // Session first, then platform — no "education" type prefix (redundant with session names like "Daily Education").
      const platform = (payload.platform || '').trim();
      const session = (payload.session || payload.topic || '').trim();
      if (platform && session) return `${session} · ${platform}`;
      if (session) return session;
      if (platform) return platform;
      return null;
    }
    case 'weight': {
      const current = formatShareKg(payload.currentWeight);
      const previous = formatShareKg(payload.previousWeight);
      const ideal = formatShareKg(payload.idealWeight);
      const idealPart = ideal != null ? `, Ideal Weight: ${ideal} kg` : '';
      if (current == null) return 'weight';
      if (previous == null) return `weight ${current} kg${idealPart}`;

      const delta = Math.round((current - previous) * 100) / 100;
      let arrow = '';
      if (delta < 0) arrow = ' ↓';
      else if (delta > 0) arrow = ' ↑';

      return `Previous: ${previous} kg, Current: ${current} kg${arrow}${idealPart}`;
    }
    case 'workout':
    case 'watch':
    case 'smartwatch':
    case 'calories_burned': {
      const burned = Math.round(Number(payload.caloriesBurned ?? payload.kcal ?? payload.calories) || 0);
      if (burned > 0) return `Calories Burnt: ${burned} kcal so far today`;
      return 'Calories Burnt';
    }
    case 'good-habit': {
      const notes = String(payload.notes || '').trim();
      return notes ? `Good Habit — ${notes}` : 'Good Habit';
    }
    case DIARY_FOOD_ACTIVITY.FOOD:
    case 'food':
    default: {
      const names = resolveFoodShareNames(payload);
      const calories = Math.round(Number(payload.calories) || 0);
      const parts = [];
      if (names.length > 0) parts.push(names.join(', '));
      if (calories > 0) parts.push(`${calories} kcal`);
      return parts.length > 0 ? parts.join(', ') : null;
    }
  }
}

/**
 * Prefer the full item list for food captions.
 * Falls back to compact foodName ("White Rice+4more") when items are missing.
 * @param {{ itemNames?: unknown[], foodName?: string }} payload
 * @returns {string[]}
 */
function resolveFoodShareNames(payload) {
  const fromItems = Array.isArray(payload.itemNames)
    ? payload.itemNames.map((n) => String(n || '').trim()).filter(Boolean)
    : [];
  if (fromItems.length > 0) {
    const seen = new Set();
    const names = [];
    for (const name of fromItems) {
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      names.push(name);
    }
    return names;
  }
  const foodName = (payload.foodName || '').trim();
  return foodName ? [foodName] : [];
}

/**
 * Manual Log / day-total share keeps "so far today".
 * Diary card share passes soFarToday: false (this entry only).
 */
function dayTotalSuffix(payload) {
  return payload.soFarToday === false ? '' : ' so far today';
}

/** Weight kg for share captions (2 decimal places max). */
function formatShareKg(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}
