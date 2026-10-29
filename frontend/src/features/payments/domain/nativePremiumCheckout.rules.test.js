/**
 * Run: node --test frontend/src/features/payments/domain/nativePremiumCheckout.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  memberCheckoutErrorMessage,
  nativeCheckoutResultForJs,
  shouldFallbackToJsCheckout,
  shouldUseNativeUpiCheckout,
} from './nativePremiumCheckout.rules.js';

describe('shouldUseNativeUpiCheckout', () => {
  it('uses native only on Android APK', () => {
    assert.equal(shouldUseNativeUpiCheckout({ isNative: true, platform: 'android' }), true);
  });

  it('keeps the JS modal on web and iOS', () => {
    assert.equal(shouldUseNativeUpiCheckout({ isNative: false, platform: 'web' }), false);
    assert.equal(shouldUseNativeUpiCheckout({ isNative: true, platform: 'ios' }), false);
    assert.equal(shouldUseNativeUpiCheckout({}), false);
  });
});

describe('shouldFallbackToJsCheckout', () => {
  it('falls back only when native checkout cannot start', () => {
    assert.equal(shouldFallbackToJsCheckout({ code: 'UNAVAILABLE' }), true);
    assert.equal(shouldFallbackToJsCheckout({ code: 'UNIMPLEMENTED' }), true);
    assert.equal(shouldFallbackToJsCheckout({ message: 'plugin is not implemented' }), true);
    assert.equal(shouldFallbackToJsCheckout({ code: 'SIDELOAD_UPI' }), true);
    assert.equal(shouldFallbackToJsCheckout({
      message: 'com.google.android.packageinstaller is not a trusted source',
    }), true);
  });

  it('does not fall back after a real payment error', () => {
    assert.equal(shouldFallbackToJsCheckout({ message: 'Payment could not complete' }), false);
    assert.equal(shouldFallbackToJsCheckout(null), false);
  });
});

describe('memberCheckoutErrorMessage', () => {
  it('hides the Play installer string and tells the member to use PhonePe or card', () => {
    assert.equal(
      memberCheckoutErrorMessage({
        message: 'com.google.android.packageinstaller is not a trusted source. App should be installed from play store or another whitelisted app store.',
      }),
      'Google Pay needs the Play Store app. Try PhonePe or card.',
    );
  });
});

describe('nativeCheckoutResultForJs', () => {
  it('maps verify to paymentDetails so Premium confirm still retries', () => {
    assert.deepEqual(
      nativeCheckoutResultForJs({ status: 'verify', orderId: 'premium_1' }),
      { paymentDetails: { orderId: 'premium_1' } },
    );
  });

  it('maps cancel to an empty result like closing the JS modal', () => {
    assert.deepEqual(nativeCheckoutResultForJs({ status: 'cancelled' }), {});
  });
});
