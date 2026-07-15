/**
 * platform-store.rules.js — Pure domain logic for store-link selection.
 * No React, no Capacitor imports — those live in the hook layer.
 */

export const STORE_LINKS = {
  android: process.env.REACT_APP_PLAY_STORE_URL  || 'https://play.google.com/store/apps/details?id=com.wellnessvalley.app',
  ios:     process.env.REACT_APP_APP_STORE_URL   || 'https://apps.apple.com/in/app/wellness-valley/id6764327692',
  web:     process.env.REACT_APP_LANDING_URL     || 'https://wellnessvalley.app',
};

/**
 * Return the correct app store URL for the given platform string.
 *
 * @param {'android'|'ios'|'web'|string} platform - from Capacitor.getPlatform()
 * @returns {string} store URL
 */
export function getStoreLink(platform) {
  if (platform === 'android') return STORE_LINKS.android;
  if (platform === 'ios')     return STORE_LINKS.ios;
  return STORE_LINKS.web;
}

/**
 * Generic onboarding link shared after a Body Parameters Card is created.
 * No tokens or member data in the URL — profile data is already on team_table
 * via the member phone number entered by the coach.
 *
 * @param {string} [apiBaseUrl] - from getApiBaseUrl()
 * @returns {string}
 */
export function buildOnboardingShareUrl(apiBaseUrl) {
  const base = String(apiBaseUrl || process.env.REACT_APP_API_BASE_URL || '')
    .replace(/\/+$/, '');
  if (base) return `${base}/app`;
  return STORE_LINKS.web;
}

/**
 * Build the WhatsApp share text for a body-parameters card.
 *
 * @param {string|null} shareUrl - generic /app link (no personal data)
 * @param {string} memberName
 * @returns {string}
 */
export function buildShareText(shareUrl, memberName) {
  const firstName = memberName?.trim().split(/\s+/)[0] || 'there';
  if (!shareUrl) {
    return `Hey ${firstName}! Your coach shared your body parameters. Install the Wellness Valley app to get started.`;
  }
  return `Hey ${firstName}! Your coach shared your body parameters. Open or install Wellness Valley:\n${shareUrl}`;
}
