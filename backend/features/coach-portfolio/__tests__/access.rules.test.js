/**
 * Run: node --test backend/features/coach-portfolio/__tests__/access.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isPortfolioPaid,
  statusFromPaidFlag,
  toPublicAccess,
  PORTFOLIO_STATUS,
} from '../domain/access.rules.js';
import {
  assertPortfolioAdmin,
  isPortfolioAdmin,
} from '../domain/permissions/portfolio.policy.js';

describe('coach-portfolio access.rules', () => {
  it('treats only paid as unlocked', () => {
    assert.equal(isPortfolioPaid('paid'), true);
    assert.equal(isPortfolioPaid('PAID'), true);
    assert.equal(isPortfolioPaid('not_paid'), false);
    assert.equal(isPortfolioPaid(null), false);
  });

  it('maps boolean to status', () => {
    assert.equal(statusFromPaidFlag(true), PORTFOLIO_STATUS.PAID);
    assert.equal(statusFromPaidFlag(false), PORTFOLIO_STATUS.NOT_PAID);
  });

  it('builds a public access payload', () => {
    const data = toPublicAccess({
      userId: 42,
      status: 'paid',
      source: 'admin',
      markedAt: '2026-11-03T05:00:00.000Z',
      userName: 'Test Coach',
    });
    assert.deepEqual(data, {
      userId: 42,
      paid: true,
      status: 'paid',
      source: 'admin',
      markedAt: '2026-11-03T05:00:00.000Z',
      userName: 'Test Coach',
    });
  });
});

describe('coach-portfolio portfolio.policy', () => {
  it('allows admin and developer only', () => {
    assert.equal(isPortfolioAdmin({ Role: 'admin' }), true);
    assert.equal(isPortfolioAdmin({ Role: 'developer' }), true);
    assert.equal(isPortfolioAdmin({ Role: 'coach' }), false);
    assert.equal(isPortfolioAdmin({ Role: 'user' }), false);
    assert.equal(isPortfolioAdmin(null), false);
  });

  it('throws 403 for non-admin', () => {
    assert.throws(
      () => assertPortfolioAdmin({ Role: 'coach' }),
      (err) => err?.status === 403,
    );
  });
});
