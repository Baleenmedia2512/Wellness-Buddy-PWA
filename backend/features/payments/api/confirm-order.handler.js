/**
 * Confirm a Premium payment server to server, then remember it.
 * The app never says "I paid": we ask Cashfree for the order and only a real
 * PAID order for this member at the Premium price is saved.
 * Confirmed payment starts or extends a 30-day Premium window.
 */
import { ValidationError } from '../../../shared/lib/ValidationError.js';
import logger from '../../../shared/lib/logger.js';
import { todayInTimezone, IANA_IST } from '../../../shared/lib/datetime/datetime.js';
import { fetchCashfreeOrder } from '../data/cashfree.client.js';
import {
  recordPaidPremiumOrder,
  getPremiumMembership,
} from '../data/premium.repository.js';
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
import {
  getPremiumPricingConfig,
  listPremiumPayableTotals,
} from '../domain/premiumPricing.rules.js';
import { resolvePremiumMembership } from '../domain/premium-subscription.rules.js';

function parseUserId(raw) {
  const userId = Number.parseInt(String(raw ?? ''), 10);
  return Number.isFinite(userId) && userId > 0 ? userId : null;
}

function membershipPayload(membership) {
  return {
    premium: membership?.premium === true,
    daysLeft: membership?.daysLeft ?? null,
    expiresAt: membership?.expiresAt ?? null,
    expiresAtDisplay: membership?.expiresAtDisplay ?? null,
    showExpiryWarning: membership?.showExpiryWarning === true,
  };
}

function inactivePayload(status) {
  return {
    premium: false,
    status,
    daysLeft: null,
    expiresAt: null,
    expiresAtDisplay: null,
    showExpiryWarning: false,
  };
}

/**
 * @param {{ userId: unknown, orderId: unknown }} input
 * @param {{ fetchOrder?: Function, record?: Function, todayYmd?: string }} [deps]
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
  if (!clientId || !clientSecret) {
    throw new ValidationError(500, 'Payment is not configured');
  }

  const envName = process.env.CASHFREE_ENV || 'sandbox';
  const mode = cashfreeCheckoutMode(envName);
  const allowedAmounts = listPremiumPayableTotals(getPremiumPricingConfig());
  const todayYmd = deps.todayYmd || todayInTimezone(IANA_IST);

  const order = await fetchOrder({
    apiBase: cashfreeApiBase(envName),
    clientId,
    clientSecret,
    orderId,
  });
  const status = cashfreeOrderStatus(order);

  if (!isPremiumOrderPaid(order, { userId, allowedAmounts })) {
    return { httpStatus: 200, body: { ok: true, data: inactivePayload(status) } };
  }

  const amount = parsePremiumAmount(order.order_amount);
  if (amount == null) {
    return { httpStatus: 200, body: { ok: true, data: inactivePayload(status) } };
  }

  const recorded = await record({ orderId, userId, amount, mode, todayYmd });
  const membership = resolvePremiumMembership({
    expiresAtYmd: recorded?.expiresAt || null,
    todayYmd,
  });
  logger.info('Premium payment confirmed', {
    userId,
    orderId,
    mode,
    amount,
    expiresAt: membership.expiresAt,
  });

  return {
    httpStatus: 200,
    body: {
      ok: true,
      data: {
        ...membershipPayload(membership),
        status,
      },
    },
  };
}

/**
 * Read-only: active Premium window for this member.
 * Any failure answers "not premium" so the profile page never breaks.
 * @param {{ userId: unknown }} input
 * @param {{ getMembership?: Function, hasPaid?: Function, todayYmd?: string }} [deps]
 */
export async function getPremiumStatus(input, deps = {}) {
  const getMembership = deps.getMembership
    || (deps.hasPaid
      ? async (args) => ({
        premium: await deps.hasPaid(args),
        daysLeft: null,
        expiresAt: null,
        expiresAtDisplay: null,
        showExpiryWarning: false,
      })
      : getPremiumMembership);
  const userId = parseUserId(input.userId);
  if (!userId) {
    throw new ValidationError(400, 'userId is required');
  }
  const mode = cashfreeCheckoutMode(process.env.CASHFREE_ENV || 'sandbox');
  const todayYmd = deps.todayYmd || todayInTimezone(IANA_IST);
  let membership = {
    premium: false,
    daysLeft: null,
    expiresAt: null,
    expiresAtDisplay: null,
    showExpiryWarning: false,
  };
  try {
    membership = await getMembership({ userId, mode, todayYmd });
  } catch (error) {
    logger.warn('Premium status lookup failed', { userId, message: error?.message || String(error) });
  }
  return { httpStatus: 200, body: { ok: true, data: membershipPayload(membership) } };
}
