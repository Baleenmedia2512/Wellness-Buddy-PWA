/**
 * Run: node --test frontend/src/features/payments/domain/externalPremiumCheckout.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  shouldUseExternalWebCheckout,
  resolvePremiumWebOrigin,
  buildPremiumPaidReturnUrl,
  buildPremiumPayPageUrl,
  buildPremiumAppReturnLink,
  buildPremiumAndroidIntentLink,
  externalBrowserCheckoutResult,
} from './externalPremiumCheckout.rules.js';

describe('externalPremiumCheckout.rules', () => {
  it('uses external checkout on native iOS and Android only', () => {
    assert.equal(shouldUseExternalWebCheckout({ isNative: true, platform: 'ios' }), true);
    assert.equal(shouldUseExternalWebCheckout({ isNative: true, platform: 'android' }), true);
    assert.equal(shouldUseExternalWebCheckout({ isNative: false, platform: 'web' }), false);
  });

  it('resolves the pay-page origin from the API base URL', () => {
    assert.equal(
      resolvePremiumWebOrigin('https://wellnessvalley.in/'),
      'https://wellnessvalley.in',
    );
    assert.equal(
      resolvePremiumWebOrigin('https://test.wellnessvalley.in/api'),
      'https://test.wellnessvalley.in',
    );
    assert.equal(resolvePremiumWebOrigin(''), 'https://wellnessvalley.in');
  });

  it('builds Cashfree return and pay URLs', () => {
    assert.equal(
      buildPremiumPaidReturnUrl('https://wellnessvalley.in'),
      'https://wellnessvalley.in/premium/paid?order_id={order_id}',
    );
    const payUrl = buildPremiumPayPageUrl({
      webOrigin: 'https://wellnessvalley.in',
      paymentSessionId: 'sess_1',
      orderId: 'premium_42_abc',
      mode: 'production',
    });
    assert.match(payUrl, /^https:\/\/wellnessvalley\.in\/premium\/pay\?/);
    assert.match(payUrl, /payment_session_id=sess_1/);
    assert.match(payUrl, /order_id=premium_42_abc/);
    assert.match(payUrl, /mode=production/);
  });

  it('builds app return links for paid handoff', () => {
    assert.equal(
      buildPremiumAppReturnLink('premium_42_abc'),
      'wellnessvalley://premium/paid?order_id=premium_42_abc',
    );
    assert.match(
      buildPremiumAndroidIntentLink('premium_42_abc'),
      /^intent:\/\/premium\/paid\?order_id=premium_42_abc#Intent;/,
    );
    assert.deepEqual(externalBrowserCheckoutResult(), { externalBrowser: true });
  });
});
