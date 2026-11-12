/**
 * Premium plan display helpers.
 * Charge amount always comes from the server quote (env-driven bases + GST).
 * Do not hard-code level prices here — change PREMIUM_LEVEL_BASES / PREMIUM_GST_RATE on the backend.
 */
export const PREMIUM_PLAN_NAME = 'Premium';

/** Fallback only if the quote omits gstRate (server should always send it). */
const DEFAULT_GST_RATE = 0.18;

/**
 * @param {unknown} amount
 * @returns {string}
 */
export function formatPremiumPlanAmount(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return '';
  return value % 1 === 0 ? String(value) : value.toFixed(2);
}

/**
 * @param {unknown} quote
 * @returns {{
 *   positionCode: string,
 *   baseAmount: number,
 *   gstAmount: number,
 *   gstRate: number,
 *   amount: number,
 * }|null}
 */
export function normalizePremiumQuote(quote) {
  if (!quote || typeof quote !== 'object') return null;
  const amount = Number(quote.amount);
  const baseAmount = Number(quote.baseAmount);
  const gstAmount = Number(quote.gstAmount);
  if (![amount, baseAmount, gstAmount].every(Number.isFinite)) return null;
  const positionCode = String(quote.positionCode || '').trim();
  if (!positionCode) return null;
  const gstRate = Number(quote.gstRate);
  return {
    positionCode,
    baseAmount,
    gstAmount,
    gstRate: Number.isFinite(gstRate) ? gstRate : DEFAULT_GST_RATE,
    amount,
  };
}
