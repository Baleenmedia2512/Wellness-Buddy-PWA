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
} from '../domain/comboSuggestions.rules.js';
import { slotFromTimeOfDay } from '../domain/timeSlots.rules.js';

const PROVIDER_ID = 'slot-combo-v1';

function flattenHistoryFood(item) {
  const src = item?.food || {};
  const nutrition = (src.nutrition && typeof src.nutrition === 'object')
    ? src.nutrition
    : src;
  const calories = Number(nutrition.calories);
  const protein = Number(nutrition.protein);
  const carbs = Number(nutrition.carbs);
  const fat = Number(nutrition.fat);
  const fiber = Number(nutrition.fiber);
  const weight = Number(src.weight_g);
  return {
    name: item.name,
    source: 'history',
    calories: Number.isFinite(calories) ? Math.round(calories) : null,
    protein: Number.isFinite(protein) ? Math.round(protein) : null,
    carbs: Number.isFinite(carbs) ? Math.round(carbs) : null,
    fat: Number.isFinite(fat) ? Math.round(fat) : null,
    fiber: Number.isFinite(fiber) ? Math.round(fiber) : null,
    weight_g: Number.isFinite(weight) && weight > 0 ? Math.round(weight) : 100,
    portion: src.portion || src.portion_label || null,
    nutrition: {
      calories: Number.isFinite(calories) ? Math.round(calories) : null,
      protein: Number.isFinite(protein) ? Math.round(protein) : null,
      carbs: Number.isFinite(carbs) ? Math.round(carbs) : null,
      fat: Number.isFinite(fat) ? Math.round(fat) : null,
      fiber: Number.isFinite(fiber) ? Math.round(fiber) : null,
    },
  };
}

function toSearchItem(item, catalogByKey) {
  const row = catalogByKey.get(item.key);
  if (row) {
    return {
      ...profileToSearchItem(row),
      source: 'dry-salad',
    };
  }
  return flattenHistoryFood(item);
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
