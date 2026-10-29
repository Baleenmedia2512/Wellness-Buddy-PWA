import { apiFetch } from '../../shared/services/apiFetch.js';
import { savePendingPremiumOrder } from './services/premiumApi.js';
import {
  getCheckoutPlatform,
  startNativeUpiIntent,
} from '../../shared/plugins/cashfreeCheckoutPlugin.js';
import {
  memberCheckoutErrorMessage,
  nativeCheckoutResultForJs,
  shouldFallbackToJsCheckout,
  shouldUseNativeUpiCheckout,
} from './domain/nativePremiumCheckout.rules.js';

const SDK_SRC = 'https://sdk.cashfree.com/js/v3/cashfree.js';

function loadCashfreeScript() {
  if (typeof window !== 'undefined' && typeof window.Cashfree === 'function') {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-cashfree-sdk="v3"]');
    const finish = () => {
      if (typeof window.Cashfree === 'function') resolve();
      else reject(new Error('Cashfree could not load'));
    };
    if (existing) {
      existing.addEventListener('load', finish, { once: true });
      existing.addEventListener('error', () => reject(new Error('Cashfree could not load')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = SDK_SRC;
    script.async = true;
    script.dataset.cashfreeSdk = 'v3';
    script.onload = finish;
    script.onerror = () => reject(new Error('Cashfree could not load'));
    document.body.appendChild(script);
  });
}

async function createPremiumSession({ userId, fetchApi }) {
  const returnUrl = typeof window !== 'undefined' ? window.location.href : '';
  const response = await fetchApi('/api/payments/create-premium-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, returnUrl }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body?.data?.paymentSessionId) {
    throw new Error(body?.message || 'Payment could not start');
  }
  return body.data;
}

async function openJsModalCheckout({ paymentSessionId, mode, loadScript }) {
  await loadScript();
  const cashfree = window.Cashfree({ mode: mode === 'production' ? 'production' : 'sandbox' });
  const result = await cashfree.checkout({
    paymentSessionId,
    redirectTarget: '_modal',
  });
  if (result?.error) {
    throw new Error(result.error.message || 'Payment could not open');
  }
  return result;
}

/**
 * Ask the server for a Premium payment session, then open Cashfree's payment options.
 * Android APK uses Cashfree native checkout (card + UPI apps). Web, iOS, and native-start failures keep the JS modal.
 * @param {{ userId: string|number }} input
 * @param {object} [deps]
 */
export async function openPremiumCheckout({ userId }, deps = {}) {
  const fetchApi = deps.apiFetch || apiFetch;
  const savePending = deps.savePendingPremiumOrder || savePendingPremiumOrder;
  const loadScript = deps.loadCashfreeScript || loadCashfreeScript;
  const startNative = deps.startNativeUpiIntent || startNativeUpiIntent;
  const openJs = deps.openJsCheckout || openJsModalCheckout;
  const platformInfo = deps.platformInfo || getCheckoutPlatform();

  const session = await createPremiumSession({ userId, fetchApi });
  savePending({ userId, orderId: session.orderId });

  if (shouldUseNativeUpiCheckout(platformInfo)) {
    try {
      const nativeResult = await startNative({
        paymentSessionId: session.paymentSessionId,
        orderId: session.orderId,
        mode: session.mode,
      });
      return { orderId: session.orderId, result: nativeCheckoutResultForJs(nativeResult) };
    } catch (error) {
      if (!shouldFallbackToJsCheckout(error)) {
        const mapped = new Error(memberCheckoutErrorMessage(error));
        mapped.code = error?.code;
        throw mapped;
      }
    }
  }

  const result = await openJs({
    paymentSessionId: session.paymentSessionId,
    mode: session.mode,
    loadScript,
  });
  return { orderId: session.orderId, result };
}
