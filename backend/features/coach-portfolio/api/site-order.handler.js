/**
 * Create / confirm Cashfree orders for Digital Portfolio site slots (₹399/yr).
 */
import { ValidationError } from '../../../shared/lib/ValidationError.js';
import logger from '../../../shared/lib/logger.js';
import { isEnabled } from '../../../shared/lib/feature-flags.js';
import { createCashfreeOrder, fetchCashfreeOrder } from '../../payments/data/cashfree.client.js';
import { parsePremiumAmount } from '../../payments/domain/premium.rules.js';
import * as submissionRepo from '../data/submission.repo.js';
import * as entitlementsRepo from '../data/site-entitlements.repo.js';
import {
  resolvePortfolioSiteQuote,
  listPortfolioSitePayableTotals,
} from '../domain/sitePricing.rules.js';
import {
  PORTFOLIO_SITE_ORDER_KIND,
  toSiteCreditsPayload,
} from '../domain/siteSlots.rules.js';
import {
  buildPortfolioSiteOrderPayload,
  cashfreeApiBase,
  cashfreeCheckoutMode,
  cashfreeOrderStatus,
  isPortfolioSiteMockPayEnabled,
  isPortfolioSiteOrderPaid,
  normalizeIndianPhone,
  normalizePortfolioSiteOrderKind,
  parsePortfolioSiteOrderUserId,
  sanitizeReturnUrl,
} from '../domain/siteOrder.rules.js';

function parseUserId(raw) {
  const userId = Number.parseInt(String(raw ?? ''), 10);
  return Number.isFinite(userId) && userId > 0 ? userId : null;
}

function checkoutEnabled() {
  // Emergency kill for Cashfree SKU only; portfolio feature flag is separate.
  if (isEnabled('ff.portfolio-site-checkout') === false) return false;
  return true;
}

/**
 * @param {{
 *   userId: unknown,
 *   phone: unknown,
 *   customerName?: unknown,
 *   returnUrl?: unknown,
 *   kind?: unknown,
 *   submissionId?: unknown,
 *   centerId?: unknown,
 *   nowMs?: number,
 * }} input
 */
export async function createPortfolioSiteOrder(input) {
  if (!checkoutEnabled()) {
    throw new ValidationError(404, 'Website checkout is not available');
  }

  const userId = parseUserId(input.userId);
  if (!userId) {
    throw new ValidationError(400, 'Sign in again before paying');
  }

  const phone10 = normalizeIndianPhone(input.phone);
  if (!phone10) {
    throw new ValidationError(422, 'Add a mobile number on your profile before paying');
  }

  const kind = normalizePortfolioSiteOrderKind(input.kind);
  let submissionId = null;
  let centerId = null;

  if (kind === PORTFOLIO_SITE_ORDER_KIND.RENEW) {
    submissionId = Number(input.submissionId);
    if (!Number.isFinite(submissionId) || submissionId <= 0) {
      throw new ValidationError(400, 'Choose a website to renew');
    }
    const row = await submissionRepo.findSubmissionById(submissionId);
    if (!row || Number(row.userId) !== userId) {
      throw new ValidationError(404, 'Website not found');
    }
    centerId = row.centerId != null ? Number(row.centerId) : null;
  } else if (input.centerId != null && String(input.centerId).trim() !== '') {
    centerId = Number(input.centerId);
    if (!Number.isFinite(centerId) || centerId <= 0) centerId = null;
  }

  const mockPay = isPortfolioSiteMockPayEnabled();
  const clientId = String(process.env.CASHFREE_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.CASHFREE_CLIENT_SECRET || '').trim();
  if (!mockPay && (!clientId || !clientSecret)) {
    throw new ValidationError(500, 'Payment is not configured');
  }

  const quote = resolvePortfolioSiteQuote();
  const envName = process.env.CASHFREE_ENV || 'sandbox';
  const mode = mockPay ? 'sandbox' : cashfreeCheckoutMode(envName);
  const nowMs = input.nowMs ?? Date.now();
  const payload = buildPortfolioSiteOrderPayload({
    userId,
    phone10,
    customerName: input.customerName,
    amount: quote.totalAmount,
    returnUrl: sanitizeReturnUrl(input.returnUrl),
    nowMs,
  });

  try {
    await entitlementsRepo.insertPendingEntitlement({
      orderId: payload.order_id,
      userId,
      amount: quote.totalAmount,
      mode,
      kind,
      submissionId,
      centerId,
    });
  } catch (error) {
    logger.warn('Portfolio site pending entitlement insert failed', {
      message: error?.message || String(error),
    });
    throw new ValidationError(500, 'Could not start website payment. Try again.');
  }

  if (mockPay) {
    logger.info('Portfolio site mock pay — order created without Cashfree', {
      userId,
      orderId: payload.order_id,
      kind,
    });
    return {
      httpStatus: 200,
      body: {
        ok: true,
        data: {
          orderId: payload.order_id,
          paymentSessionId: `mock_${payload.order_id}`,
          mode,
          mock: true,
          amount: quote.totalAmount,
          baseAmount: quote.baseAmount,
          gstAmount: quote.gstAmount,
          gstRate: quote.gstRate,
          kind,
          submissionId,
          centerId,
        },
      },
    };
  }

  let created;
  try {
    created = await createCashfreeOrder({
      apiBase: cashfreeApiBase(envName),
      clientId,
      clientSecret,
      payload,
    });
  } catch (error) {
    logger.warn('Portfolio site Cashfree order failed', {
      message: error?.message || String(error),
      userId,
    });
    throw new ValidationError(502, 'Payment provider could not start. Try again in a moment.');
  }

  logger.info('Portfolio site Cashfree order created', {
    userId,
    orderId: created.orderId,
    kind,
    amount: quote.totalAmount,
    submissionId,
  });

  return {
    httpStatus: 200,
    body: {
      ok: true,
      data: {
        orderId: created.orderId,
        paymentSessionId: created.paymentSessionId,
        mode,
        amount: quote.totalAmount,
        baseAmount: quote.baseAmount,
        gstAmount: quote.gstAmount,
        gstRate: quote.gstRate,
        kind,
        submissionId,
        centerId,
      },
    },
  };
}

/**
 * @param {{ userId: unknown, orderId: unknown, nowMs?: number }} input
 * @param {{ fetchOrder?: Function, confirm?: Function }} [deps]
 */
export async function confirmPortfolioSiteOrder(input, deps = {}) {
  if (!checkoutEnabled()) {
    throw new ValidationError(404, 'Website checkout is not available');
  }

  const fetchOrder = deps.fetchOrder || fetchCashfreeOrder;
  const confirm = deps.confirm || entitlementsRepo.confirmPaidEntitlement;

  const userId = parseUserId(input.userId);
  if (!userId) {
    throw new ValidationError(400, 'Sign in again before confirming payment');
  }

  const orderId = String(input.orderId || '').trim();
  if (parsePortfolioSiteOrderUserId(orderId) !== userId) {
    throw new ValidationError(400, 'This payment does not belong to this account');
  }

  const mockPay = isPortfolioSiteMockPayEnabled();
  const clientId = String(process.env.CASHFREE_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.CASHFREE_CLIENT_SECRET || '').trim();
  if (!mockPay && (!clientId || !clientSecret)) {
    throw new ValidationError(500, 'Payment is not configured');
  }

  const quote = resolvePortfolioSiteQuote();
  const envName = process.env.CASHFREE_ENV || 'sandbox';
  const mode = mockPay ? 'sandbox' : cashfreeCheckoutMode(envName);
  const allowedAmounts = listPortfolioSitePayableTotals();
  const nowMs = input.nowMs ?? Date.now();

  if (mockPay) {
    await confirm({
      orderId,
      userId,
      amount: quote.totalAmount,
      mode,
      nowMs,
    });
    const summary = await entitlementsRepo.getSiteCreditsSummary(userId);
    logger.info('Portfolio site mock pay confirmed', { userId, orderId, amount: quote.totalAmount });
    return {
      httpStatus: 200,
      body: {
        ok: true,
        data: {
          paid: true,
          status: 'PAID',
          mock: true,
          ...toSiteCreditsPayload({
            unusedCredits: summary.unusedCredits,
            sites: summary.sites,
          }),
          priceBaseInr: quote.baseAmount,
        },
      },
    };
  }

  const order = await fetchOrder({
    apiBase: cashfreeApiBase(envName),
    clientId,
    clientSecret,
    orderId,
  });
  const status = cashfreeOrderStatus(order);

  if (!isPortfolioSiteOrderPaid(order, { userId, allowedAmounts })) {
    return {
      httpStatus: 200,
      body: { ok: true, data: { paid: false, status, unusedCredits: 0, sites: [] } },
    };
  }

  const amount = parsePremiumAmount(order.order_amount);
  if (amount == null) {
    return {
      httpStatus: 200,
      body: { ok: true, data: { paid: false, status, unusedCredits: 0, sites: [] } },
    };
  }

  await confirm({
    orderId,
    userId,
    amount,
    mode,
    nowMs,
  });

  const summary = await entitlementsRepo.getSiteCreditsSummary(userId);
  logger.info('Portfolio site payment confirmed', { userId, orderId, mode, amount });

  return {
    httpStatus: 200,
    body: {
      ok: true,
      data: {
        paid: true,
        status,
        ...toSiteCreditsPayload({
          unusedCredits: summary.unusedCredits,
          sites: summary.sites,
        }),
        priceBaseInr: resolvePortfolioSiteQuote().baseAmount,
      },
    },
  };
}

/**
 * @param {{ userId: unknown }} input
 */
export async function getPortfolioSiteCredits({ userId: rawUserId }) {
  const userId = parseUserId(rawUserId);
  if (!userId) {
    throw new ValidationError(400, 'Sign in again');
  }
  const summary = await entitlementsRepo.getSiteCreditsSummary(userId);
  const quote = resolvePortfolioSiteQuote();
  return {
    httpStatus: 200,
    body: {
      ok: true,
      data: {
        ...toSiteCreditsPayload(summary),
        priceBaseInr: quote.baseAmount,
        priceTotalInr: quote.totalAmount,
        gstAmount: quote.gstAmount,
        gstRate: quote.gstRate,
      },
    },
  };
}
