/**
 * Default website services = Wellness University programs
 * except Extra Income + Product Cost (6 remain).
 */

export const DEFAULT_PORTFOLIO_OFFERINGS = Object.freeze([
  'Family Healthy Breakfast Programme',
  'Weight Loss',
  'Weight Gain',
  'Kids Nutrition',
  'Sports Nutrition',
  'Targeted Nutrition',
]);

/** Excluded from website defaults (still exist in Wellness University). */
export const EXCLUDED_PORTFOLIO_OFFERING_IDS = Object.freeze([
  'earn-product-cost',
  'extra-income',
]);

/**
 * @param {unknown} offerings
 * @returns {boolean}
 */
export function offeringsAreEmpty(offerings) {
  return !Array.isArray(offerings) || offerings.filter((x) => String(x || '').trim()).length === 0;
}
