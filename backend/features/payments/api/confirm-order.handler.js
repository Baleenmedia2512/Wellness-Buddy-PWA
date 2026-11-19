/**
 * Confirm a Premium payment server to server, then remember it.
 * The app never says "I paid": we ask Cashfree for the order and only a real
 * PAID order for this member at the Premium price is saved.
 */
import { ValidationError } from '../../../shared/lib/ValidationError.js';
import logger from '../../../shared/lib/logger.js';
import { fetchCashfreeOrder } from '../data/cashfree.client.js';
import { recordPaidPremiumOrder, hasPaidPremium } from '../data/premium.repository.js';
import {
  parsePremiumAmount,
  cashfreeApiBase,
  cashfreeCheckoutMode,
} from '../domain/premium.rules.js';
import {
  parsePremiumOrderUserId,
  cashfreeOrderStatus,
  isPremiumOrderPaid,
} from '../domain/premium-confirm.rules.js';

function parseUserId(raw) {
  const userId = Number.parseInt(String(raw ?? ''), 10);
  return Number.isFinite(userId) && userId > 0 ? userId : null;
}

/**
 * @param {{ userId: unknown, orderId: unknown }} input
 * @param {{ fetchOrder?: Function, record?: Function }} [deps]
 */
export async function confirmPremiumOrder(input, deps = {}) {
  const fetchOrder = deps.fetchOrder || fetchCashfreeOrder;
  const record = deps.record || recordPaidPremiumOrder;

  const userId = parseUserId(input.userId);
  if (!userId) {
    throw new ValidationError(400, 'Sign in again before confirming payment');
  }

  const orderId = String(input.orderId || '').trim();
  if (parsePremiumOrderUserId(orderId) !== userId) {
    throw new ValidationError(400, 'This payment does not belong to this account');
  }

  const clientId = String(process.env.CASHFREE_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.CASHFREE_CLIENT_SECRET || '').trim();
  const amount = parsePremiumAmount(process.env.CASHFREE_ORDER_AMOUNT || '99');
  if (!clientId || !clientSecret || amount == null) {
    throw new ValidationError(500, 'Payment is not configured');
  }

  const envName = process.env.CASHFREE_ENV || 'sandbox';
  const mode = cashfreeCheckoutMode(envName);

  const order = await fetchOrder({
    apiBase: cashfreeApiBase(envName),
    clientId,
    clientSecret,
    orderId,
  });
  const status = cashfreeOrderStatus(order);

  if (!isPremiumOrderPaid(order, { userId, amount })) {
    return { httpStatus: 200, body: { ok: true, data: { premium: false, status } } };
  }

  await record({ orderId, userId, amount, mode });
  logger.info('Premium payment confirmed', { userId, orderId, mode });

  return { httpStatus: 200, body: { ok: true, data: { premium: true, status } } };
}

/**
 * Read-only: does this member have a confirmed Premium payment?
 * Any failure answers "not premium" so the profile page never breaks.
 * @param {{ userId: unknown }} input
 * @param {{ hasPaid?: Function }} [deps]
 */
export async function getPremiumStatus(input, deps = {}) {
  const hasPaid = deps.hasPaid || hasPaidPremium;
  const userId = parseUserId(input.userId);
  if (!userId) {
    throw new ValidationError(400, 'userId is required');
  }
  const mode = cashfreeCheckoutMode(process.env.CASHFREE_ENV || 'sandbox');
  let premium = false;
  try {
    premium = await hasPaid({ userId, mode });
  } catch (error) {
    logger.warn('Premium status lookup failed', { userId, message: error?.message || String(error) });
  }
  return { httpStatus: 200, body: { ok: true, data: { premium } } };
}
