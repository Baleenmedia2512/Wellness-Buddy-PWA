/**
 * Run: node --test frontend/src/features/payments/openPremiumCheckout.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { openPremiumCheckout } from './openPremiumCheckout.js';

function okSession() {
  return {
    ok: true,
    json: async () => ({
      data: {
        orderId: 'premium_42_abc',
        paymentSessionId: 'session_abc',
        mode: 'production',
      },
    }),
  };
}

describe('openPremiumCheckout', () => {
  it('keeps the JS modal on web', async () => {
    const calls = [];
    const result = await openPremiumCheckout(
      { userId: 42 },
      {
        apiFetch: async () => okSession(),
        savePendingPremiumOrder: (row) => calls.push(['pending', row]),
        platformInfo: { isNative: false, platform: 'web' },
        startNativeUpiIntent: async () => {
          throw new Error('native must not run on web');
        },
        openJsCheckout: async (input) => {
          calls.push(['js', input.paymentSessionId, input.mode]);
          return { from: 'js' };
        },
      },
    );
    assert.deepEqual(result, { orderId: 'premium_42_abc', result: { from: 'js' } });
    assert.equal(calls[0][0], 'pending');
    assert.deepEqual(calls[1], ['js', 'session_abc', 'production']);
  });

  it('opens native UPI Intent on Android APK', async () => {
    const result = await openPremiumCheckout(
      { userId: 42 },
      {
        apiFetch: async () => okSession(),
        savePendingPremiumOrder: () => {},
        platformInfo: { isNative: true, platform: 'android' },
        startNativeUpiIntent: async () => ({ status: 'verify', orderId: 'premium_42_abc' }),
        openJsCheckout: async () => {
          throw new Error('JS modal must not run when native works');
        },
      },
    );
    assert.deepEqual(result, {
      orderId: 'premium_42_abc',
      result: { paymentDetails: { orderId: 'premium_42_abc' } },
    });
  });

  it('falls back to the JS modal if native cannot start', async () => {
    const error = new Error('NATIVE_UNAVAILABLE');
    error.code = 'UNAVAILABLE';
    const result = await openPremiumCheckout(
      { userId: 42 },
      {
        apiFetch: async () => okSession(),
        savePendingPremiumOrder: () => {},
        platformInfo: { isNative: true, platform: 'android' },
        startNativeUpiIntent: async () => {
          throw error;
        },
        openJsCheckout: async () => ({ from: 'js-fallback' }),
      },
    );
    assert.deepEqual(result, { orderId: 'premium_42_abc', result: { from: 'js-fallback' } });
  });

  it('does not open a second JS checkout after a native payment error', async () => {
    await assert.rejects(
      () => openPremiumCheckout(
        { userId: 42 },
        {
          apiFetch: async () => okSession(),
          savePendingPremiumOrder: () => {},
          platformInfo: { isNative: true, platform: 'android' },
          startNativeUpiIntent: async () => {
            throw new Error('Payment could not complete');
          },
          openJsCheckout: async () => ({ from: 'js' }),
        },
      ),
      /Payment could not complete/,
    );
  });

  it('opens the JS modal when Google Pay blocks a sideloaded APK', async () => {
    const result = await openPremiumCheckout(
      { userId: 42 },
      {
        apiFetch: async () => okSession(),
        savePendingPremiumOrder: () => {},
        platformInfo: { isNative: true, platform: 'android' },
        startNativeUpiIntent: async () => {
          throw new Error('com.google.android.packageinstaller is not a trusted source');
        },
        openJsCheckout: async () => ({ from: 'js-sideload' }),
      },
    );
    assert.deepEqual(result, { orderId: 'premium_42_abc', result: { from: 'js-sideload' } });
  });
});
