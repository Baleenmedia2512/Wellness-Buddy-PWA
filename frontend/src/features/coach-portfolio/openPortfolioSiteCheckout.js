import { apiFetch } from '../../shared/services/apiFetch.js';
import { savePendingPortfolioSiteOrder } from './services/portfolioSiteApi.js';
import {
  getCheckoutPlatform,
  startNativeUpiIntent,
} from '../../shared/plugins/cashfreeCheckoutPlugin.js';
import {
  memberCheckoutErrorMessage,
  nativeCheckoutResultForJs,
  shouldFallbackToJsCheckout,
  shouldUseNativeUpiCheckout,
} from '../payments/domain/nativePremiumCheckout.rules.js';

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

async function createSiteSession({ userId, kind, submissionId, centerId, fetchApi }) {
  const returnUrl = typeof window !== 'undefined' ? window.location.href : '';
  let response;
  try {
    response = await fetchApi('/api/payments/create-portfolio-site-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        returnUrl,
        kind: kind || 'credit',
        submissionId: submissionId ?? null,
        centerId: centerId ?? null,
      }),
    });
  } catch (err) {
    const raw = String(err?.message || '');
    if (/Failed to fetch|NetworkError|Load failed/i.test(raw)) {
      throw new Error(
        'Payment could not reach the server. Deploy the latest backend, or point the app at a local API.',
      );
    }
    throw err;
  }
  const body = await response.json().catch(() => ({}));
  if (response.status === 404) {
    throw new Error(
      'Website payment is not on this server yet. Deploy the latest backend to continue.',
    );
  }
  if (!response.ok || !body?.data?.paymentSessionId) {
    throw new Error(
      body?.error?.message || body?.message || 'Payment could not start',
    );
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
 * ₹399/yr Digital Portfolio website checkout (create credit or renew).
 * @param {{
 *   userId: string|number,
 *   kind?: 'credit'|'renew',
 *   submissionId?: number|null,
 *   centerId?: number|null,
 * }} input
 * @param {object} [deps]
 */
export async function openPortfolioSiteCheckout(input, deps = {}) {
  const fetchApi = deps.apiFetch || apiFetch;
  const savePending = deps.savePendingPortfolioSiteOrder || savePendingPortfolioSiteOrder;
  const loadScript = deps.loadCashfreeScript || loadCashfreeScript;
  const startNative = deps.startNativeUpiIntent || startNativeUpiIntent;
  const openJs = deps.openJsCheckout || openJsModalCheckout;
  const platformInfo = deps.platformInfo || getCheckoutPlatform();

  const session = await createSiteSession({
    userId: input.userId,
    kind: input.kind,
    submissionId: input.submissionId,
    centerId: input.centerId,
    fetchApi,
  });
  savePending({ userId: input.userId, orderId: session.orderId });

  // Local mock (PORTFOLIO_SITE_MOCK_PAY) — skip Cashfree UI; confirm marks paid.
  if (session?.mock === true) {
    return {
      orderId: session.orderId,
      result: { paymentDetails: null, error: null, redirect: false },
      session,
    };
  }

  if (shouldUseNativeUpiCheckout(platformInfo)) {
    try {
      const nativeResult = await startNative({
        paymentSessionId: session.paymentSessionId,
        orderId: session.orderId,
        mode: session.mode,
      });
      return { orderId: session.orderId, result: nativeCheckoutResultForJs(nativeResult), session };
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
  return { orderId: session.orderId, result, session };
}
