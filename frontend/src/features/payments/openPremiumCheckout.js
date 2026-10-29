import { apiFetch } from '../../shared/services/apiFetch.js';

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

/**
 * Ask the server for a Premium payment session, then open Cashfree's payment options.
 * @param {{ userId: string|number }} input
 */
export async function openPremiumCheckout({ userId }) {
  const returnUrl = typeof window !== 'undefined' ? window.location.href : '';
  const response = await apiFetch('/api/payments/create-premium-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, returnUrl }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body?.data?.paymentSessionId) {
    throw new Error(body?.message || 'Payment could not start');
  }

  await loadCashfreeScript();
  const cashfree = window.Cashfree({ mode: body.data.mode === 'production' ? 'production' : 'sandbox' });
  const result = await cashfree.checkout({
    paymentSessionId: body.data.paymentSessionId,
    redirectTarget: '_modal',
  });
  if (result?.error) {
    throw new Error(result.error.message || 'Payment could not open');
  }
  return result;
}
