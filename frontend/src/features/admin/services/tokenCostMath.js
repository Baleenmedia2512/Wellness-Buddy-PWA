/**
 * tokenCostMath.js — formatters + INR re-calculation helpers.
 *
 * Pure functions only — UI hooks call these to derive new values without
 * needing setter wiring.
 */
export const formatCurrency = (val) => `₹${Number(val).toFixed(4)}`;
export const formatNumber = (val) => Number(val).toLocaleString();

export const usdPerMillionToInr = (tokens, usdPerMillion, exchangeRate) => {
  if (!exchangeRate || exchangeRate <= 0) return 0;
  return (tokens / 1_000_000) * usdPerMillion * exchangeRate;
};

/**
 * Recalculate one side (input/output) of the INR cost.
 * Returns either the original INR cost (if USD matches the original — restore
 * to avoid floating-point drift) or a freshly calculated value.
 */
export const recalcSideINR = ({ tokens, usdPerMillion, originalUsdPerMillion, originalInr, exchangeRate }) => {
  if (!exchangeRate || exchangeRate <= 0) return null;
  if (Math.abs(usdPerMillion - originalUsdPerMillion) < 0.00001) return originalInr;
  return usdPerMillionToInr(tokens, usdPerMillion, exchangeRate);
};

export const formatInrInput = (val) => (val === 0 ? '0' : Number(val).toFixed(4));
export const formatUsdInput = (val) => Number(val).toFixed(2);
