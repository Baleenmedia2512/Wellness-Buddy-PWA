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
 * @returns {string|null} compact suffix, or null when nothing useful to append
 */
export function buildDiaryShareSuffix(activityType, payload = {}) {
  switch (activityType) {
    case DIARY_FOOD_ACTIVITY.WATER:
    case 'water': {
      const consumed = payload.volumeLabel
        || (payload.volumeMl != null ? formatWaterVolume(payload.volumeMl) : null);
      return consumed
        ? `Consumed: ${consumed} water so far today`
        : 'Consumed water so far today';
    }
    case DIARY_FOOD_ACTIVITY.AFRESH:
    case 'afresh': {
      const scoops = Number(payload.scoops);
      const count = Number.isFinite(scoops) && scoops > 0 ? scoops : 1;
      const scoopWord = count === 1 ? 'scoop' : 'scoops';
      return `Consumed: ${count} ${scoopWord} Afresh so far today`;
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
      if (current == null) return 'weight';
      if (previous == null) return `weight ${current} kg`;

      const delta = Math.round((current - previous) * 100) / 100;
      // Direction as emoji arrows (⬆️/⬇️) — WhatsApp renders them as button-style icons.
      let arrow = '';
      if (delta < 0) arrow = ' ⬇️';
      else if (delta > 0) arrow = ' ⬆️';

      return `Previous: ${previous} kg, Current: ${current} kg${arrow}`;
    }
    case 'workout':
    case 'watch':
    case 'smartwatch':
    case 'calories_burned': {
      const burned = Math.round(Number(payload.caloriesBurned ?? payload.kcal ?? payload.calories) || 0);
      if (burned > 0) return `Calories Burnt: ${burned} kcal so far today`;
      return 'Calories Burnt';
    }
    case DIARY_FOOD_ACTIVITY.FOOD:
    case 'food':
    default: {
      const foodName = (payload.foodName || '').trim();
      const calories = Math.round(Number(payload.calories) || 0);
      const parts = [];
      if (foodName) parts.push(foodName);
      if (calories > 0) parts.push(`${calories} kcal`);

      const protein = roundMacro(payload.protein);
      const carbs = roundMacro(payload.carbs);
      const fat = roundMacro(payload.fat);
      const fiber = roundMacro(payload.fiber);
      const gi = roundMacro(payload.glycemicIndex ?? payload.glycemic_index);

      const facts = [];
      if (protein != null) facts.push(`P ${protein}g`);
      if (carbs != null) facts.push(`C ${carbs}g`);
      if (fat != null) facts.push(`F ${fat}g`);
      if (fiber != null) facts.push(`Fiber ${fiber}g`);
      if (gi != null) facts.push(`GI ${gi}`);

      if (facts.length > 0) {
        const head = parts.length > 0 ? `${parts.join(', ')} · ` : '';
        return `${head}${facts.join(' · ')}`;
      }
      if (parts.length > 0) return parts.join(', ');
      return null;
    }
  }
}

/** Round macro/GI for share text; null when missing or zero. */
function roundMacro(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

/** Weight kg for share captions (2 decimal places max). */
function formatShareKg(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}
