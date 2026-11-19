/** Display copy for the Premium plan page. Charge amount still comes from the server. */
export const PREMIUM_PLAN_NAME = 'Premium';
export const PREMIUM_PLAN_AMOUNT = 199;

/**
 * @param {unknown} amount
 * @returns {string}
 */
export function formatPremiumPlanAmount(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return '';
  return value % 1 === 0 ? String(value) : value.toFixed(2);
}
