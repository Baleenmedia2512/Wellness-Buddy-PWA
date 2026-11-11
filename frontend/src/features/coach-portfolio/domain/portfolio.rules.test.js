/**
 * Run: node --test frontend/src/features/coach-portfolio/domain/portfolio.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isCoachPortfolioRole,
  isPortfolioAdminRole,
} from './portfolio.rules.js';

describe('coach-portfolio role helpers', () => {
  it('admin and developer for mark-paid tools', () => {
    assert.equal(isPortfolioAdminRole('admin'), true);
    assert.equal(isPortfolioAdminRole('developer'), true);
    assert.equal(isPortfolioAdminRole('coach'), false);
  });

  it('legacy isCoachPortfolioRole still recognizes coach string', () => {
    assert.equal(isCoachPortfolioRole('coach'), true);
    assert.equal(isCoachPortfolioRole('user'), false);
  });
});
