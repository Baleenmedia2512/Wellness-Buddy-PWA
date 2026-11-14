/**
 * Start one Premium Cashfree checkout for a member already loaded from the database.
 * Charge = Community Position base + 18% GST (server price; client never sets amount).
 */
import { ValidationError } from '../../../shared/lib/ValidationError.js';
import logger from '../../../shared/lib/logger.js';
import { createCashfreeOrder } from '../data/cashfree.client.js';
import {
  cashfreeApiBase,
  cashfreeCheckoutMode,
  normalizeIndianPhone,
  sanitizeReturnUrl,
  buildPremiumOrderPayload,
} from '../domain/premium.rules.js';
import {
  getPremiumPricingConfig,
  resolvePremiumQuote,
} from '../domain/premiumPricing.rules.js';

/**
 * @param {{
 *   userId: unknown,
 *   phone: unknown,
 *   customerName?: unknown,
 *   returnUrl?: unknown,
 *   eventLevel?: unknown,
 *   nowMs?: number,
 * }} input
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

  const pricing = getPremiumPricingConfig();
  const quote = resolvePremiumQuote(input.eventLevel, pricing);
  if (!quote) {
    throw new ValidationError(
      422,
      'Fill Community Position on your profile.',
    );
  }

  const clientId = String(process.env.CASHFREE_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.CASHFREE_CLIENT_SECRET || '').trim();
  if (!clientId || !clientSecret) {
    throw new ValidationError(500, 'Payment is not configured');
  }

  const envName = process.env.CASHFREE_ENV || 'sandbox';
  const payload = buildPremiumOrderPayload({
    userId,
    phone10,
    customerName: input.customerName,
    amount: quote.totalAmount,
    returnUrl: sanitizeReturnUrl(input.returnUrl),
    nowMs: input.nowMs ?? Date.now(),
  });
  payload.order_note = 'Wellness Valley Premium';

  const created = await createCashfreeOrder({
    apiBase: cashfreeApiBase(envName),
    clientId,
    clientSecret,
    payload,
  });

  logger.info('Premium Cashfree order created', {
    userId,
    orderId: created.orderId,
    positionCode: quote.positionCode,
    amount: quote.totalAmount,
  });

  return {
    httpStatus: 200,
    body: {
      ok: true,
      data: {
        orderId: created.orderId,
        paymentSessionId: created.paymentSessionId,
        mode: cashfreeCheckoutMode(envName),
        amount: quote.totalAmount,
        baseAmount: quote.baseAmount,
        gstAmount: quote.gstAmount,
        gstRate: quote.gstRate,
        positionCode: quote.positionCode,
      },
    },
  };
}
