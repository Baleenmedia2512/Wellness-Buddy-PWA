/**
 * Start one Premium Cashfree checkout for a member already loaded from the database.
 */
import { ValidationError } from '../../../shared/lib/ValidationError.js';
import logger from '../../../shared/lib/logger.js';
import { createCashfreeOrder } from '../data/cashfree.client.js';
import {
  parsePremiumAmount,
  cashfreeApiBase,
  cashfreeCheckoutMode,
  normalizeIndianPhone,
  sanitizeReturnUrl,
  buildPremiumOrderPayload,
} from '../domain/premium.rules.js';

/**
 * @param {{ userId: unknown, phone: unknown, customerName?: unknown, returnUrl?: unknown, nowMs?: number }} input
 */
export async function createPremiumOrder(input) {
  const userId = Number.parseInt(String(input.userId ?? ''), 10);
  if (!Number.isFinite(userId) || userId <= 0) {
    throw new ValidationError(400, 'Sign in again before paying');
  }

  const phone10 = normalizeIndianPhone(input.phone);
  if (!phone10) {
    throw new ValidationError(422, 'Add a mobile number on your profile before paying');
  }

  const clientId = String(process.env.CASHFREE_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.CASHFREE_CLIENT_SECRET || '').trim();
  const amount = parsePremiumAmount(process.env.CASHFREE_ORDER_AMOUNT || '99');
  if (!clientId || !clientSecret || amount == null) {
    throw new ValidationError(500, 'Payment is not configured');
  }

  const envName = process.env.CASHFREE_ENV || 'sandbox';
  const payload = buildPremiumOrderPayload({
    userId,
    phone10,
    customerName: input.customerName,
    amount,
    returnUrl: sanitizeReturnUrl(input.returnUrl),
    nowMs: input.nowMs ?? Date.now(),
  });

  const created = await createCashfreeOrder({
    apiBase: cashfreeApiBase(envName),
    clientId,
    clientSecret,
    payload,
  });

  logger.info('Premium Cashfree order created', { userId, orderId: created.orderId });

  return {
    httpStatus: 200,
    body: {
      ok: true,
      data: {
        orderId: created.orderId,
        paymentSessionId: created.paymentSessionId,
        mode: cashfreeCheckoutMode(envName),
        amount,
      },
    },
  };
}
