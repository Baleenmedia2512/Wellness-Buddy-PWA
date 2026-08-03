/**
 * @file Discipline-score thresholds and category constants.
 *
 * These are placeholder values intended to centralize the magic
 * numbers currently scattered across leaderboard / report code.
 * Tune in one place once the canonical scoring spec is locked.
 */

/** Categories that contribute to the overall discipline score. */
export const DISCIPLINE_CATEGORIES = Object.freeze({
  WEIGHT: 'weight',
  NUTRITION: 'nutrition',
  ACTIVITY: 'activity',
  WATER: 'water',
  EDUCATION: 'education',
});

/** @typedef {keyof typeof DISCIPLINE_CATEGORIES} DisciplineCategoryKey */

/**
 * Default per-category weighting. Sum should equal 1.0.
 * @type {Record<string, number>}
 */
export const DEFAULT_CATEGORY_WEIGHTS = Object.freeze({
  [DISCIPLINE_CATEGORIES.WEIGHT]: 0.20,
  [DISCIPLINE_CATEGORIES.NUTRITION]: 0.25,
  [DISCIPLINE_CATEGORIES.ACTIVITY]: 0.20,
  [DISCIPLINE_CATEGORIES.WATER]: 0.10,
  [DISCIPLINE_CATEGORIES.EDUCATION]: 0.15,
});

/** Score thresholds (0-100 scale). */
export const SCORE_THRESHOLDS = Object.freeze({
  EXCELLENT: 90,
  GOOD: 75,
  FAIR: 60,
  POOR: 40,
});

/** UI badge tiers, ordered worst -> best. */
export const SCORE_TIERS = Object.freeze([
  { id: 'critical', label: 'Critical', max: SCORE_THRESHOLDS.POOR },
  { id: 'poor', label: 'Needs Work', max: SCORE_THRESHOLDS.FAIR },
  { id: 'fair', label: 'Fair', max: SCORE_THRESHOLDS.GOOD },
  { id: 'good', label: 'Good', max: SCORE_THRESHOLDS.EXCELLENT },
  { id: 'excellent', label: 'Excellent', max: 100 },
]);

/** Floor / ceiling for any computed discipline score. */
export const SCORE_MIN = 0;
export const SCORE_MAX = 100;

/**
 * Resolve a numeric score to its tier id.
 * @param {number} score 0-100
 * @returns {string} tier id
 */
export function tierForScore(score) {
  const s = Math.max(SCORE_MIN, Math.min(SCORE_MAX, Number(score) || 0));
  for (const tier of SCORE_TIERS) {
    if (s < tier.max) return tier.id;
  }
  return SCORE_TIERS[SCORE_TIERS.length - 1].id;
}
