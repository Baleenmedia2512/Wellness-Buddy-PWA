/**
 * Run: node --test backend/features/coach-portfolio/__tests__/siteSlots.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PORTFOLIO_SITE_SLOTS_MIN,
  computeExtendedExpiresAt,
  countUnusedCredits,
  isEntitlementActive,
  isSubmissionEntitlementActive,
  latestExpiryForSubmission,
  usesPortfolioSiteSlots,
} from '../domain/siteSlots.rules.js';

describe('siteSlots.rules', () => {
  it('routes next-release clients to site slots; older/missing stay legacy', () => {
    assert.equal(usesPortfolioSiteSlots(PORTFOLIO_SITE_SLOTS_MIN), true);
    assert.equal(usesPortfolioSiteSlots('3.5.7'), true);
    assert.equal(usesPortfolioSiteSlots('3.5.6'), false);
    assert.equal(usesPortfolioSiteSlots(null), false);
    assert.equal(usesPortfolioSiteSlots(''), false);
  });

  it('counts only paid unbound non-expired credits', () => {
    const now = Date.parse('2026-11-20T00:00:00.000Z');
    const rows = [
      { status: 'paid', submissionId: null, expiresAt: '2027-01-01T00:00:00.000Z' },
      { status: 'paid', submissionId: 9, expiresAt: '2027-01-01T00:00:00.000Z' },
      { status: 'pending', submissionId: null, expiresAt: '2027-01-01T00:00:00.000Z' },
      { status: 'paid', submissionId: null, expiresAt: '2026-01-01T00:00:00.000Z' },
    ];
    assert.equal(countUnusedCredits(rows, now), 1);
  });

  it('extends expiry from max(now, current)', () => {
    const now = Date.parse('2026-06-01T00:00:00.000Z');
    const fromNow = computeExtendedExpiresAt(null, now, 365);
    assert.equal(fromNow.toISOString().slice(0, 10), '2027-06-01');

    const future = computeExtendedExpiresAt('2026-12-01T00:00:00.000Z', now, 365);
    assert.equal(future.toISOString().slice(0, 10), '2027-12-01');
  });

  it('detects active bound entitlement for a submission', () => {
    const now = Date.parse('2026-11-20T00:00:00.000Z');
    const rows = [
      { status: 'paid', submissionId: 5, expiresAt: '2026-01-01T00:00:00.000Z' },
      { status: 'paid', submissionId: 5, expiresAt: '2027-05-01T00:00:00.000Z' },
    ];
    assert.ok(latestExpiryForSubmission(rows, 5));
    assert.equal(isSubmissionEntitlementActive(rows, 5, now), true);
    assert.equal(isEntitlementActive('2026-01-01T00:00:00.000Z', now), false);
  });
});
