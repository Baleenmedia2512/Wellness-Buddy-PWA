/**
 * Native apps (iOS + Android) open Premium checkout on the public website
 * in Safari/Chrome, then return to the app after payment.
 * Pure: no Capacitor, env, or network.
 */

/**
 * @param {{ isNative?: boolean, platform?: string }} [platformInfo]
 * @returns {boolean}
 */
export function shouldUseExternalWebCheckout(platformInfo = {}) {
  return platformInfo.isNative === true;
}

/**
 * Website origin for /premium/pay and /premium/paid (usually API host).
 * @param {unknown} apiBaseUrl
 * @returns {string}
 */
export function resolvePremiumWebOrigin(apiBaseUrl) {
  try {
    const origin = new URL(String(apiBaseUrl || '').trim()).origin;
    if (origin) return origin;
  } catch {
    // fall through
  }
  return 'https://wellnessvalley.in';
}

/**
 * Cashfree return_url after website payment. `{order_id}` is filled by Cashfree.
 * @param {string} webOrigin
 * @returns {string}
 */
export function buildPremiumPaidReturnUrl(webOrigin) {
  const origin = String(webOrigin || '').replace(/\/+$/, '');
  return `${origin}/premium/paid?order_id={order_id}`;
}

/**
 * Public pay page opened in the system browser from the app.
 * @param {{
 *   webOrigin: string,
 *   paymentSessionId: string,
 *   orderId: string,
 *   mode?: string,
 * }} input
 * @returns {string|null}
 */
export function buildPremiumPayPageUrl(input) {
  const origin = String(input?.webOrigin || '').replace(/\/+$/, '');
  const paymentSessionId = String(input?.paymentSessionId || '').trim();
  const orderId = String(input?.orderId || '').trim();
  const mode = String(input?.mode || 'sandbox').trim() === 'production' ? 'production' : 'sandbox';
  if (!origin || !paymentSessionId || !orderId) return null;
  const url = new URL(`${origin}/premium/pay`);
  url.searchParams.set('payment_session_id', paymentSessionId);
  url.searchParams.set('order_id', orderId);
  url.searchParams.set('mode', mode);
  return url.toString();
}

/**
 * Custom-scheme link used by the paid page to reopen the installed app.
 * @param {unknown} orderId
 * @returns {string}
 */
export function buildPremiumAppReturnLink(orderId) {
  const id = encodeURIComponent(String(orderId || '').trim());
  return `wellnessvalley://premium/paid?order_id=${id}`;
}

/**
 * Android intent:// fallback when App Links / custom scheme need a nudge.
 * @param {unknown} orderId
 * @returns {string}
 */
export function buildPremiumAndroidIntentLink(orderId) {
  const id = encodeURIComponent(String(orderId || '').trim());
  return `intent://premium/paid?order_id=${id}#Intent;scheme=wellnessvalley;package=com.wellnessvalley.app;end`;
}

/** Result shape GoPremiumButton already understands for "left to browser". */
export function externalBrowserCheckoutResult() {
  return { externalBrowser: true };
}
