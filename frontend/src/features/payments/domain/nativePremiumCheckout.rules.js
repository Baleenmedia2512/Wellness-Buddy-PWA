/**
 * Android native UPI Intent vs existing Cashfree JS modal.
 * Pure: web and iOS stay on the JS modal. Native only when Android can start it.
 */

export function shouldUseNativeUpiCheckout({ isNative, platform } = {}) {
  return isNative === true && platform === 'android';
}

export function shouldFallbackToJsCheckout(error) {
  if (!error) return false;
  const code = String(error.code || '');
  if (code === 'UNAVAILABLE' || code === 'UNIMPLEMENTED' || code === 'SIDELOAD_UPI') return true;
  const message = String(error.message || '');
  if (isSideloadUpiBlock(message)) return true;
  return /NATIVE_UNAVAILABLE|not implemented|plugin is not implemented/i.test(message);
}

export function isSideloadUpiBlock(raw) {
  const blob = String(raw || '').toLowerCase();
  return (
    blob.includes('packageinstaller')
    || blob.includes('not a trusted source')
    || blob.includes('whitelisted app store')
  );
}

export function memberCheckoutErrorMessage(error) {
  const raw = String(error?.message || '');
  if (error?.code === 'SIDELOAD_UPI' || isSideloadUpiBlock(raw)) {
    return 'Google Pay needs the Play Store app. Try PhonePe or card.';
  }
  return raw || 'Payment could not start';
}

/**
 * Map native plugin payload to the shape GoPremiumButton already reads.
 * @param {unknown} nativeResult
 */
export function nativeCheckoutResultForJs(nativeResult) {
  const result = nativeResult && typeof nativeResult === 'object' ? nativeResult : {};
  const status = String(result.status || '');
  if (status === 'cancelled') return {};
  if (status === 'verify') {
    const orderId = String(result.orderId || result.paymentDetails?.orderId || '');
    return orderId ? { paymentDetails: { orderId } } : { paymentDetails: {} };
  }
  if (result.paymentDetails) return result;
  return result;
}
