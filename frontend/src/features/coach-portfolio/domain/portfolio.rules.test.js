/**
 * Run: node --test frontend/src/features/coach-portfolio/domain/portfolio.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PORTFOLIO_SITE_SLOTS_MIN,
  isAtLeastAppVersion,
  usesPortfolioSiteSlots,
} from './portfolio.rules.js';

describe('portfolio.rules site slots', () => {
  it('treats next-release min as site-slots clients', () => {
    assert.equal(isAtLeastAppVersion('3.5.7', PORTFOLIO_SITE_SLOTS_MIN), true);
    assert.equal(isAtLeastAppVersion('3.5.6', PORTFOLIO_SITE_SLOTS_MIN), false);
    assert.equal(isAtLeastAppVersion(null, PORTFOLIO_SITE_SLOTS_MIN), false);
    assert.equal(usesPortfolioSiteSlots('3.5.7'), true);
    assert.equal(usesPortfolioSiteSlots('3.5.6'), false);
  });
});
