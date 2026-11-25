/**
 * Cashfree order id helpers for portfolio site slots.
 * Pure: no env / network.
 */
import {
  cashfreeApiBase,
  cashfreeCheckoutMode,
  normalizeIndianPhone,
  sanitizeReturnUrl,
} from '../../payments/domain/premium.rules.js';
import { PORTFOLIO_SITE_ORDER_KIND } from './siteSlots.rules.js';

const ORDER_ID_MAX = 45;
const ORDER_ID_PATTERN = /^portfolio_site_(\d+)_[a-z0-9]+$/;

export {
  cashfreeApiBase,
  cashfreeCheckoutMode,
  normalizeIndianPhone,
  sanitizeReturnUrl,
};

/**
 * Local/dev only: skip Cashfree and treat Buy as paid.
 * Never on production NODE_ENV / VERCEL_ENV / CASHFREE_ENV=production.
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {boolean}
 */
export function isPortfolioSiteMockPayEnabled(env = process.env) {
  const on = ['1', 'true', 'yes', 'on'].includes(
    String(env.PORTFOLIO_SITE_MOCK_PAY || '').trim().toLowerCase(),
  );
  if (!on) return false;
  if (String(env.CASHFREE_ENV || 'sandbox').trim().toLowerCase() === 'production') {
    return false;
  }
  if (String(env.NODE_ENV || '').trim().toLowerCase() === 'production') return false;
  if (String(env.VERCEL_ENV || '').trim().toLowerCase() === 'production') return false;
  return true;
}

/**
 * @param {unknown} userId
 * @param {number} nowMs
 * @returns {string}
 */
export function buildPortfolioSiteOrderId(userId, nowMs) {
  const id = String(userId).replace(/\D/g, '') || '0';
  const stamp = Number(nowMs).toString(36);
  return `portfolio_site_${id}_${stamp}`.slice(0, ORDER_ID_MAX);
}

/**
 * @param {unknown} orderId
 * @returns {number|null}
 */
export function parsePortfolioSiteOrderUserId(orderId) {
  const match = ORDER_ID_PATTERN.exec(String(orderId || ''));
  if (!match) return null;
  const userId = Number(match[1]);
  return Number.isSafeInteger(userId) && userId > 0 ? userId : null;
}

/**
 * @param {unknown} order
 * @returns {string}
 */
export function cashfreeOrderStatus(order) {
  return String(order?.order_status || '').trim().toUpperCase();
}

/**
 * @param {unknown} order
 * @param {{ userId: number, allowedAmounts: number[] }} expected
 * @returns {boolean}
 */
export function isPortfolioSiteOrderPaid(order, expected) {
  if (!order || typeof order !== 'object') return false;
  if (cashfreeOrderStatus(order) !== 'PAID') return false;
  if (parsePortfolioSiteOrderUserId(order.order_id) !== expected.userId) return false;
  if (String(order.customer_details?.customer_id || '') !== `user_${expected.userId}`) {
    return false;
  }
  const paidPaise = Math.round(Number(order.order_amount) * 100);
  if (!Number.isFinite(paidPaise)) return false;
  return expected.allowedAmounts.some(
    (total) => Math.round(Number(total) * 100) === paidPaise,
  );
}

/**
 * @param {{
 *   userId: number|string,
 *   phone10: string,
 *   customerName?: string|null,
 *   amount: number,
 *   returnUrl?: string|null,
 *   nowMs: number,
 * }} input
 */
export function buildPortfolioSiteOrderPayload(input) {
  const name = String(input.customerName || '').trim().slice(0, 100);
  const payload = {
    order_amount: input.amount,
    order_currency: 'INR',
    order_id: buildPortfolioSiteOrderId(input.userId, input.nowMs),
    customer_details: {
      customer_id: `user_${input.userId}`,
      customer_phone: input.phone10,
    },
    order_note: 'Wellness Valley Digital Portfolio website (1 year)',
  };
  if (name) payload.customer_details.customer_name = name;
  if (input.returnUrl) {
    payload.order_meta = { return_url: input.returnUrl };
  }
  return payload;
}

/**
 * @param {unknown} kind
 * @returns {'credit'|'renew'}
 */
export function normalizePortfolioSiteOrderKind(kind) {
  return String(kind || '').trim().toLowerCase() === PORTFOLIO_SITE_ORDER_KIND.RENEW
    ? PORTFOLIO_SITE_ORDER_KIND.RENEW
    : PORTFOLIO_SITE_ORDER_KIND.CREDIT;
}
