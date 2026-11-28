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
        apiBaseUrl: 'https://wellnessvalley.in',
        startNativeUpiIntent: async () => {
          throw new Error('native must not run on web');
        },
        openExternalBrowser: async () => {
          throw new Error('external browser must not run on web');
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

  it('opens the website pay page on native iOS', async () => {
    const opened = [];
    const result = await openPremiumCheckout(
      { userId: 42 },
      {
        apiFetch: async (_url, init) => {
          const body = JSON.parse(init.body);
          assert.match(body.returnUrl, /\/premium\/paid\?order_id=\{order_id\}$/);
          return okSession();
        },
        savePendingPremiumOrder: () => {},
        platformInfo: { isNative: true, platform: 'ios' },
        apiBaseUrl: 'https://wellnessvalley.in',
        openExternalBrowser: async (url) => {
          opened.push(url);
        },
        startNativeUpiIntent: async () => {
          throw new Error('native UPI must not run when external web is used');
        },
        openJsCheckout: async () => {
          throw new Error('JS modal must not run on native external checkout');
        },
      },
    );
    assert.deepEqual(result, {
      orderId: 'premium_42_abc',
      result: { externalBrowser: true },
    });
    assert.equal(opened.length, 1);
    assert.match(opened[0], /^https:\/\/wellnessvalley\.in\/premium\/pay\?/);
    assert.match(opened[0], /payment_session_id=session_abc/);
  });

  it('opens the website pay page on native Android', async () => {
    const opened = [];
    const result = await openPremiumCheckout(
      { userId: 42 },
      {
        apiFetch: async () => okSession(),
        savePendingPremiumOrder: () => {},
        platformInfo: { isNative: true, platform: 'android' },
        apiBaseUrl: 'https://wellnessvalley.in',
        openExternalBrowser: async (url) => {
          opened.push(url);
        },
        startNativeUpiIntent: async () => {
          throw new Error('native UPI must not run when external web is used');
        },
        openJsCheckout: async () => {
          throw new Error('JS modal must not run on native external checkout');
        },
      },
    );
    assert.equal(result.result.externalBrowser, true);
    assert.match(opened[0], /mode=production/);
  });
});
