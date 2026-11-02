import { Capacitor, registerPlugin } from '@capacitor/core';

function unavailable() {
  const error = new Error('NATIVE_UNAVAILABLE');
  error.code = 'UNAVAILABLE';
  return Promise.reject(error);
}

const CashfreeCheckout = registerPlugin('CashfreeCheckout', {
  web: () => ({ startUpiIntent: unavailable }),
  ios: () => ({ startUpiIntent: unavailable }),
});

export function getCheckoutPlatform() {
  return {
    isNative: Capacitor.isNativePlatform(),
    platform: Capacitor.getPlatform(),
  };
}

/**
 * Opens Cashfree native checkout on Android (card, UPI apps, net banking).
 * Web/iOS implementations reject UNAVAILABLE so Pay Now keeps the JS modal.
 * @param {{ paymentSessionId: string, orderId: string, mode?: string }} input
 */
export function startNativeUpiIntent(input) {
  return CashfreeCheckout.startUpiIntent({
    paymentSessionId: String(input?.paymentSessionId || ''),
    orderId: String(input?.orderId || ''),
    mode: String(input?.mode || 'sandbox'),
  });
}
