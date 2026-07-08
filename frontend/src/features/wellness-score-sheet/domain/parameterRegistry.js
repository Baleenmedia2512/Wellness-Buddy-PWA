/**
 * Wellness Score Sheet — parameter registry (UI + future API contract).
 *
 * scoringType:
 *   binary       — on-time / done → maxMark, else 0
 *   limit        — exceed 100% of target → 0; else proportional
 *   proportional — no upper penalty; mark ∝ min(consumed/target, 1)
 *   deferred     — not scored yet (physical activity)
 */

export const SCORING_TYPES = Object.freeze({
  BINARY: 'binary',
  LIMIT: 'limit',
  PROPORTIONAL: 'proportional',
  DEFERRED: 'deferred',
});

export const PARAMETER_SECTIONS = Object.freeze([
  { id: 'posts', label: 'Daily posts', description: 'On-time upload earns full mark' },
  { id: 'limits', label: 'Within limits', description: 'Over limit → 0 marks' },
  { id: 'goals', label: 'Nutrition goals', description: 'Proportional to target' },
  { id: 'vitamins', label: 'Vitamins', description: 'Proportional to RDA' },
  { id: 'minerals', label: 'Minerals', description: 'Proportional to RDA' },
  { id: 'progress', label: 'Progress', description: 'Weight & activity' },
]);

/** @typedef {'binary'|'limit'|'proportional'|'deferred'} ScoringType */

/**
 * @type {Array<{
 *   key: string,
 *   label: string,
 *   section: string,
 *   scoringType: ScoringType,
 *   defaultMaxMark: number,
 *   defaultEnabled: boolean,
 *   unit?: string,
 * }>}
 */
export const WELLNESS_PARAMETERS = Object.freeze([
  { key: 'weight_post', label: 'Weight post', section: 'posts', scoringType: 'binary', defaultMaxMark: 100, defaultEnabled: true },
  { key: 'edu_post', label: 'Edu post', section: 'posts', scoringType: 'binary', defaultMaxMark: 100, defaultEnabled: true },
  { key: 'breakfast_post', label: 'Breakfast post', section: 'posts', scoringType: 'binary', defaultMaxMark: 100, defaultEnabled: true },
  { key: 'lunch_post', label: 'Lunch post', section: 'posts', scoringType: 'binary', defaultMaxMark: 100, defaultEnabled: true },
  { key: 'dinner_post', label: 'Dinner post', section: 'posts', scoringType: 'binary', defaultMaxMark: 100, defaultEnabled: true },

  { key: 'water_pct', label: 'Water qty %', section: 'limits', scoringType: 'limit', defaultMaxMark: 100, defaultEnabled: true, unit: '%' },
  { key: 'calorie_pct', label: 'Calorie qty %', section: 'limits', scoringType: 'limit', defaultMaxMark: 100, defaultEnabled: true, unit: '%' },
  { key: 'carbs_pct', label: 'Carbs %', section: 'limits', scoringType: 'limit', defaultMaxMark: 100, defaultEnabled: true, unit: '%' },
  { key: 'fat_pct', label: 'Fat %', section: 'limits', scoringType: 'limit', defaultMaxMark: 100, defaultEnabled: true, unit: '%' },
  { key: 'sodium_pct', label: 'Sodium %', section: 'limits', scoringType: 'limit', defaultMaxMark: 100, defaultEnabled: true, unit: '%' },
  { key: 'cholesterol_pct', label: 'Cholesterol %', section: 'limits', scoringType: 'limit', defaultMaxMark: 100, defaultEnabled: true, unit: '%' },
  { key: 'sugar_pct', label: 'Sugar %', section: 'limits', scoringType: 'limit', defaultMaxMark: 100, defaultEnabled: true, unit: '%' },

  { key: 'protein_pct', label: 'Protein %', section: 'goals', scoringType: 'proportional', defaultMaxMark: 100, defaultEnabled: true, unit: '%' },
  { key: 'fiber_pct', label: 'Fiber %', section: 'goals', scoringType: 'proportional', defaultMaxMark: 100, defaultEnabled: true, unit: '%' },
  { key: 'gi', label: 'GI', section: 'goals', scoringType: 'proportional', defaultMaxMark: 100, defaultEnabled: true },

  { key: 'vit_a', label: 'Vit A %', section: 'vitamins', scoringType: 'proportional', defaultMaxMark: 100, defaultEnabled: true, unit: '%' },
  { key: 'vit_c', label: 'Vit C %', section: 'vitamins', scoringType: 'proportional', defaultMaxMark: 100, defaultEnabled: true, unit: '%' },
  { key: 'vit_d', label: 'Vit D %', section: 'vitamins', scoringType: 'proportional', defaultMaxMark: 100, defaultEnabled: true, unit: '%' },
  { key: 'vit_e', label: 'Vit E %', section: 'vitamins', scoringType: 'proportional', defaultMaxMark: 100, defaultEnabled: true, unit: '%' },
  { key: 'vit_k', label: 'Vit K %', section: 'vitamins', scoringType: 'proportional', defaultMaxMark: 100, defaultEnabled: true, unit: '%' },
  { key: 'vit_b1', label: 'Vit B1 %', section: 'vitamins', scoringType: 'proportional', defaultMaxMark: 100, defaultEnabled: true, unit: '%' },
  { key: 'vit_b2', label: 'Vit B2 %', section: 'vitamins', scoringType: 'proportional', defaultMaxMark: 100, defaultEnabled: true, unit: '%' },
  { key: 'vit_b3', label: 'Vit B3 %', section: 'vitamins', scoringType: 'proportional', defaultMaxMark: 100, defaultEnabled: true, unit: '%' },
  { key: 'vit_b6', label: 'Vit B6 %', section: 'vitamins', scoringType: 'proportional', defaultMaxMark: 100, defaultEnabled: true, unit: '%' },
  { key: 'vit_b9', label: 'Vit B9 %', section: 'vitamins', scoringType: 'proportional', defaultMaxMark: 100, defaultEnabled: true, unit: '%' },
  { key: 'vit_b12', label: 'Vit B12 %', section: 'vitamins', scoringType: 'proportional', defaultMaxMark: 100, defaultEnabled: true, unit: '%' },

  { key: 'calcium', label: 'Calcium %', section: 'minerals', scoringType: 'proportional', defaultMaxMark: 100, defaultEnabled: true, unit: '%' },
  { key: 'iron', label: 'Iron %', section: 'minerals', scoringType: 'proportional', defaultMaxMark: 100, defaultEnabled: true, unit: '%' },
  { key: 'magnesium', label: 'Magnesium %', section: 'minerals', scoringType: 'proportional', defaultMaxMark: 100, defaultEnabled: true, unit: '%' },
  { key: 'potassium', label: 'Potass %', section: 'minerals', scoringType: 'proportional', defaultMaxMark: 100, defaultEnabled: true, unit: '%' },
  { key: 'zinc', label: 'Zinc %', section: 'minerals', scoringType: 'proportional', defaultMaxMark: 100, defaultEnabled: true, unit: '%' },
  { key: 'phosphorus', label: 'Phos %', section: 'minerals', scoringType: 'proportional', defaultMaxMark: 100, defaultEnabled: true, unit: '%' },

  { key: 'weight_improvement', label: 'Weight improvement', section: 'progress', scoringType: 'binary', defaultMaxMark: 100, defaultEnabled: true },
  { key: 'physical_activity', label: 'Physical activity', section: 'progress', scoringType: 'deferred', defaultMaxMark: 100, defaultEnabled: false },
]);

export function getParametersBySection(sectionId) {
  return WELLNESS_PARAMETERS.filter((p) => p.section === sectionId);
}

export function buildDefaultCoachConfig() {
  return WELLNESS_PARAMETERS.map((p) => ({
    key: p.key,
    enabled: p.defaultEnabled,
    maxMark: p.defaultMaxMark,
    scoringType: p.scoringType,
  }));
}
