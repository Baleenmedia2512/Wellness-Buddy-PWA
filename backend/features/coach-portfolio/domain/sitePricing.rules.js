/**
 * Fixed Digital Portfolio website price: base INR + GST (same GST helper pattern as Premium).
 * Env: PORTFOLIO_SITE_BASE_INR (default 399), PORTFOLIO_SITE_GST_RATE (default 0.18).
 */
import {
  PREMIUM_GST_RATE,
  applyPremiumGst,
  parsePremiumGstRate,
  roundPremiumRupees,
} from '../../payments/domain/premiumPricing.rules.js';

export const PORTFOLIO_SITE_BASE_INR_DEFAULT = 399;

/**
 * @param {unknown} raw
 * @returns {number}
 */
export function parsePortfolioSiteBaseInr(raw) {
  if (raw == null || String(raw).trim() === '') return PORTFOLIO_SITE_BASE_INR_DEFAULT;
  const n = roundPremiumRupees(Number(raw));
  if (!Number.isFinite(n) || n < 1) return PORTFOLIO_SITE_BASE_INR_DEFAULT;
  return n;
}

/**
 * @param {Record<string, unknown>|NodeJS.ProcessEnv} [env]
 * @returns {{ baseAmount: number, gstAmount: number, totalAmount: number, gstRate: number }}
 */
export function resolvePortfolioSiteQuote(env = process.env) {
  const baseAmount = parsePortfolioSiteBaseInr(env.PORTFOLIO_SITE_BASE_INR);
  const gstRate = parsePremiumGstRate(env.PORTFOLIO_SITE_GST_RATE) ?? PREMIUM_GST_RATE;
  return applyPremiumGst(baseAmount, gstRate);
}

/**
 * @param {Record<string, unknown>|NodeJS.ProcessEnv} [env]
 * @returns {number[]}
 */
export function listPortfolioSitePayableTotals(env = process.env) {
  return [resolvePortfolioSiteQuote(env).totalAmount];
}
