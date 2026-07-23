/**
 * Single source of truth for API configuration on the frontend.
 * Per VSA rules, this is the ONLY file allowed to read process.env for API config.
 * Components/services must import getApiBaseUrl() from here.
 */

import { Capacitor } from '@capacitor/core';

const WEB_DEV_FALLBACK = 'http://localhost:3000';
/** Production backend — must stay DIFFERENT from capacitor server.hostname */
const NATIVE_PROD_FALLBACK = 'https://wellness-valley.vercel.app';

function resolveFallback() {
  try {
    if (Capacitor.isNativePlatform()) {
      return NATIVE_PROD_FALLBACK;
    }
  } catch {
    // Non-browser contexts (tests)
  }
  return WEB_DEV_FALLBACK;
}

export function getApiBaseUrl() {
  const raw = process.env.REACT_APP_API_BASE_URL || resolveFallback();
  return raw.replace(/\/+$/, '');
}
