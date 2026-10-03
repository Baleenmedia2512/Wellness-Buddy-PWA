/**
 * backend/features/dry-salad/api/suggestions.handler.js
 * Usual dry-salad combo for the current (or requested) time slot.
 */
import { getUserTimezoneIana } from '../../user/domain/userTimezone.js';
import {
  IANA_IST,
  resolveFoodTimestamp,
  timeOfDayInTimezone,
} from '../../../shared/lib/datetime/index.js';
import { profileToSearchItem } from '../../nutrition-knowledge/domain/nutrition.rules.js';
import * as repo from '../data/dry-salad.repo.js';
import {
  buildCatalogIndex,
  collectOftenItems,
  DEFAULT_COMBO_LOOKBACK,
  DEFAULT_OFTEN_LIMIT,
  DRY_SALAD_MEAL_KIND,
  extractDrySaladFoods,
  intakeSlotFromAnalysis,
  parseAnalysisData,
  pickUsualCombo,
  resolveServingsFromFood,
} from '../domain/comboSuggestions.rules.js';
import { slotFromTimeOfDay } from '../domain/timeSlots.rules.js';

const PROVIDER_ID = 'slot-combo-v1';

function flattenHistoryFood(item, servings = 1) {
  const src = item?.food || {};
  const nutrition = (src.nutrition && typeof src.nutrition === 'object')
    ? src.nutrition
    : src;
  const scale = servings > 0 ? servings : 1;
  const per = (raw) => {
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    return Math.round((n / scale) * 10) / 10;
  };
  const calories = per(nutrition.calories);
  const protein = per(nutrition.protein);
  const carbs = per(nutrition.carbs);
  const fat = per(nutrition.fat);
  const fiber = per(nutrition.fiber);
  const weightTotal = Number(src.weight_g);
  const weightPer = Number.isFinite(weightTotal) && weightTotal > 0
    ? Math.round(weightTotal / scale)
    : 100;
  return {
    name: item.name,
    source: 'history',
    calories: calories != null ? Math.round(calories) : null,
    protein: protein != null ? Math.round(protein) : null,
    carbs: carbs != null ? Math.round(carbs) : null,
    fat: fat != null ? Math.round(fat) : null,
    fiber: fiber != null ? Math.round(fiber) : null,
    weight_g: weightPer > 0 ? weightPer : 100,
    portion: src.portion || src.portion_label || null,
    servings,
    nutrition: {
      calories: calories != null ? Math.round(calories) : null,
      protein: protein != null ? Math.round(protein) : null,
      carbs: carbs != null ? Math.round(carbs) : null,
      fat: fat != null ? Math.round(fat) : null,
      fiber: fiber != null ? Math.round(fiber) : null,
    },
  };
}

function toSearchItem(item, catalogByKey) {
  const row = catalogByKey.get(item.key);
  const servings = resolveServingsFromFood(item.food, row);
  if (row) {
    return {
      ...profileToSearchItem(row),
      source: 'dry-salad',
      servings,
    };
  }
  return flattenHistoryFood(item, servings);
}

/**
 * @param {{ userId: string, slot?: string|null, now?: Date }} input
 */
export async function getDrySaladSuggestions({ userId, slot: requestedSlot = null, now = new Date() } = {}) {
  // "Is it evening now?" → device-synced profile zone (after lookup/login).
  const timezoneIana = await getUserTimezoneIana(userId);
  const nowTimeOfDay = timeOfDayInTimezone(
    now instanceof Date ? now.toISOString() : String(now),
    timezoneIana,
  );
  const slot = requestedSlot || slotFromTimeOfDay(nowTimeOfDay);

  const [catalogRows, mealRows] = await Promise.all([
    repo.listApproved({ status: 'approved', limit: 200 }),
    repo.listRecentUserMeals(userId, DEFAULT_COMBO_LOOKBACK),
  ]);

  const catalog = buildCatalogIndex(catalogRows || []);
  const intakes = [];
  for (const row of mealRows || []) {
    const foods = extractDrySaladFoods(row.AnalysisData, catalog.keys);
    if (foods.length === 0) continue;
    const storedSlot = intakeSlotFromAnalysis(row.AnalysisData);
    const tagged = parseAnalysisData(row.AnalysisData)?.mealKind === DRY_SALAD_MEAL_KIND;
    let mealSlot = storedSlot;
    if (!mealSlot) {
      try {
        // Tagged save without intakeSlot: same zone as "now" so a just-logged
        // evening meal still matches. Older untagged rows stay on IST hour.
        const zone = tagged ? timezoneIana : IANA_IST;
        mealSlot = slotFromTimeOfDay(
          resolveFoodTimestamp(row.CreatedAt, zone).timeOfDay,
        );
      } catch {
        continue;
      }
    }
    intakes.push({
      slot: mealSlot,
      foods,
    });
  }

  const inSlot = intakes.filter((intake) => intake.slot === slot);
  const usual = pickUsualCombo(inSlot);
  const exclude = new Set(usual.items.map((item) => item.key));
  const often = collectOftenItems(inSlot, exclude, DEFAULT_OFTEN_LIMIT);

  return {
    httpStatus: 200,
    body: {
      success: true,
      slot,
      selected: usual.items.map((item) => toSearchItem(item, catalog.byKey)),
      suggestions: often.map((item) => toSearchItem(item, catalog.byKey)),
      provider: PROVIDER_ID,
    },
  };
}
