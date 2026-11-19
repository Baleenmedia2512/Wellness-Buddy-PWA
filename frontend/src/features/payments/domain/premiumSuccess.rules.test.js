/**
 * Run: node --test frontend/src/features/payments/domain/premiumSuccess.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { shouldShowPremiumSuccess } from './premiumSuccess.rules.js';

describe('premium success popup', () => {
  it('shows only for the member who just paid', () => {
    assert.equal(shouldShowPremiumSuccess('42', 42), true);
    assert.equal(shouldShowPremiumSuccess('42', '42'), true);
  });

  it('stays hidden when nobody just paid', () => {
    assert.equal(shouldShowPremiumSuccess('', 42), false);
    assert.equal(shouldShowPremiumSuccess(null, 42), false);
    assert.equal(shouldShowPremiumSuccess('42', ''), false);
  });

  it('does not show one member another member\'s payment', () => {
    assert.equal(shouldShowPremiumSuccess('7', 42), false);
  });
});
