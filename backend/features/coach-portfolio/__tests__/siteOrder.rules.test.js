/**
 * Run: node --test backend/features/coach-portfolio/__tests__/siteOrder.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPortfolioSiteOrderId,
  isPortfolioSiteMockPayEnabled,
  isPortfolioSiteOrderPaid,
  parsePortfolioSiteOrderUserId,
} from '../domain/siteOrder.rules.js';
import { resolvePortfolioSiteQuote } from '../domain/sitePricing.rules.js';

describe('siteOrder.rules', () => {
  it('enables mock pay only for local non-production', () => {
    assert.equal(isPortfolioSiteMockPayEnabled({ PORTFOLIO_SITE_MOCK_PAY: '1' }), true);
    assert.equal(isPortfolioSiteMockPayEnabled({
      PORTFOLIO_SITE_MOCK_PAY: '1',
      CASHFREE_ENV: 'production',
    }), false);
    assert.equal(isPortfolioSiteMockPayEnabled({
      PORTFOLIO_SITE_MOCK_PAY: '1',
      NODE_ENV: 'production',
    }), false);
    assert.equal(isPortfolioSiteMockPayEnabled({ PORTFOLIO_SITE_MOCK_PAY: '0' }), false);
  });

  it('builds and parses portfolio_site order ids', () => {
    const orderId = buildPortfolioSiteOrderId(42, 1_700_000_000_000);
    assert.match(orderId, /^portfolio_site_42_/);
    assert.equal(parsePortfolioSiteOrderUserId(orderId), 42);
    assert.equal(parsePortfolioSiteOrderUserId('premium_42_abc'), null);
  });

  it('accepts only PAID orders for this user at the site price', () => {
    const quote = resolvePortfolioSiteQuote({
      PORTFOLIO_SITE_BASE_INR: '399',
      PORTFOLIO_SITE_GST_RATE: '0.18',
    });
    const order = {
      order_status: 'PAID',
      order_id: 'portfolio_site_7_abc',
      order_amount: quote.totalAmount,
      customer_details: { customer_id: 'user_7' },
    };
    assert.equal(
      isPortfolioSiteOrderPaid(order, { userId: 7, allowedAmounts: [quote.totalAmount] }),
      true,
    );
    assert.equal(
      isPortfolioSiteOrderPaid(order, { userId: 8, allowedAmounts: [quote.totalAmount] }),
      false,
    );
    assert.equal(
      isPortfolioSiteOrderPaid(
        { ...order, order_amount: 1 },
        { userId: 7, allowedAmounts: [quote.totalAmount] },
      ),
      false,
    );
  });
});
