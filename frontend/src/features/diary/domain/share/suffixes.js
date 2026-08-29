/**
 * diary/domain/share/suffixes.js
 *
 * Compact activity suffixes for Quick Share captions:
 *   "Name · Wellness Valley v X.Y.Z, Consumed: 1 L water so far today"
 * Food is kcal on the brand line, then each item on its own line with GI:
 *   "Name · Wellness Valley v 3.4.5, 1890 kcal\nMasala Dosa - GI 65 m\nRagi Dosa - GI 45 l"
 *
 * Rich multi-line templates stay in the per-activity builders for Diary share.
 */

import { DIARY_FOOD_ACTIVITY } from '../activityType';
import { formatPositiveWeightKg } from './weightShare';
import { formatWaterVolume } from '../formatVolume';
import { formatShakeProductScoops } from './shakeShare';
import { giZone } from '../../../nutrition/domain/foodItemNutritionFacts';

function waBold(text) {
  const clean = String(text || '').trim();
  return clean ? `*${clean}*` : '';
}

/**
 * @param {'food'|'water'|'afresh'|'shake'|'education'|'weight'|string} activityType
 * @param {object} [payload]
 * @param {number} [payload.idealWeight] kg target (BMI 19–23) shown as "Ideal: X kg"
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
        ? `${waBold(`Consumed: ${consumed}`)} water${day}`
        : `Consumed water${day}`;
    }
    case DIARY_FOOD_ACTIVITY.AFRESH:
    case 'afresh': {
      const scoops = Number(payload.scoops);
      const count = Number.isFinite(scoops) && scoops > 0 ? scoops : 1;
      const scoopWord = count === 1 ? 'scoop' : 'scoops';
      return `${waBold(`Consumed: ${count} ${scoopWord}`)} Afresh${dayTotalSuffix(payload)},`;
    }
    case DIARY_FOOD_ACTIVITY.SHAKE:
    case 'shake': {
      const name = (payload.shakeName || 'Protein Shake').trim();
      const scoopLine = formatShakeProductScoops(payload.shakeProducts);
      if (scoopLine) {
        return [
          waBold(`${name},`),
          ...scoopLine.split(', ').map((line) => waBold(`${line},`)),
        ].join('\n');
      }
      const servings = Number(payload.servings);
      const count = Number.isFinite(servings) && servings > 0 ? servings : 1;
      return `${name}, serving ${count}`;
    }
    case 'education': {
      // Session first, then platform — no "education" type prefix (redundant with session names like "Daily Education").
      const platform = (payload.platform || '').trim();
      const session = (payload.session || payload.topic || '').trim();
      if (platform && session) return waBold(`${session} · ${platform},`);
      if (session) return session;
      if (platform) return platform;
      return null;
    }
    case 'weight': {
      const current = formatShareKg(payload.currentWeight);
      const previous = formatShareKg(payload.previousWeight);
      const ideal = formatShareKg(payload.idealWeight);
      if (current == null) return 'weight';

      const lines = [];
      if (ideal != null) lines.push(`Ideal: ${ideal} kg`);
      if (previous != null) lines.push(`Before: ${previous} kg`);

      let after = `After: ${current} kg`;
      if (previous != null) {
        const delta = Math.round((current - previous) * 100) / 100;
        if (delta < 0) after += ' ⬇️';
        else if (delta > 0) after += ' ⬆️';
      }
      lines.push(after);
      return lines.join('\n');
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
      const items = resolveFoodShareItems(payload);
      const calories = Math.round(Number(payload.calories) || 0);
      const lines = [];
      const gi = readShareGi(payload);
      const zone = giZone(gi);
      if (calories > 0 || gi != null) {
        if (gi != null && zone) {
          lines.push(waBold(`${calories} kcal, GI : ${gi} (${zone.label.toUpperCase()})`));
        } else if (calories > 0) {
          lines.push(waBold(`${calories} kcal`));
        }
      }
      for (const item of items) {
        lines.push(formatFoodShareLine(item.name, item.glycemicIndex));
      }
      return lines.length > 0 ? lines.join('\n') : null;
    }
  }
}

/**
 * Prefer the full item list for food captions.
 * Falls back to compact foodName ("White Rice+4more") when items are missing.
 * @param {{ foodItems?: unknown[], itemNames?: unknown[], foodName?: string }} payload
 * @returns {Array<{ name: string, glycemicIndex: number|null }>}
 */
function resolveFoodShareItems(payload) {
  const fromFoodItems = Array.isArray(payload.foodItems) ? payload.foodItems : [];
  const mapped = [];
  const seen = new Set();
  for (const item of fromFoodItems) {
    const name = typeof item === 'string'
      ? item.trim()
      : String(item?.name || item?.foodName || '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    mapped.push({
      name,
      glycemicIndex: typeof item === 'string' ? null : readShareGi(item),
    });
  }
  if (mapped.length > 0) return mapped;

  const fromNames = Array.isArray(payload.itemNames)
    ? payload.itemNames.map((n) => String(n || '').trim()).filter(Boolean)
    : [];
  if (fromNames.length > 0) {
    const names = [];
    for (const name of fromNames) {
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      names.push({ name, glycemicIndex: null });
    }
    return names;
  }
  const foodName = (payload.foodName || '').trim();
  return foodName ? [{ name: foodName, glycemicIndex: null }] : [];
}

function readShareGi(item) {
  const raw = item?.glycemicIndex
    ?? item?.glycemic_index
    ?? item?.nutrition?.glycemic_index;
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.round(n) : null;
}

/**
 * Splits "Herbalife Aloe Plus (Digestive Health)" into
 * boldPart = "Herbalife Aloe Plus" and suffix = " (Digestive Health)"
 * so the parenthetical sub-category stays plain text outside the bold markers.
 */
function splitNameAndSuffix(name) {
  const match = String(name || '').match(/^(.*?)(\s*\([^)]*\)\s*)$/);
  if (match) return { bold: match[1].trim(), suffix: match[2].trimEnd() };
  return { bold: String(name || '').trim(), suffix: '' };
}

/**
 * @param {string} name
 * @param {number|null} glycemicIndex
 * @returns {string}
 */
function formatFoodShareLine(name, glycemicIndex) {
  const { bold, suffix } = splitNameAndSuffix(name);
  if (glycemicIndex != null) {
    return `${waBold(bold)}${suffix}`;
  }
  return `${waBold(`${bold},`)}${suffix}`;
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
  return formatPositiveWeightKg(value);
}
