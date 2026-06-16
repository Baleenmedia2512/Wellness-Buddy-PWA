/**
 * platform-store.rules.js — Pure domain logic for store-link selection.
 * No React, no Capacitor imports — those live in the hook layer.
 */

export const STORE_LINKS = {
  android: process.env.REACT_APP_PLAY_STORE_URL  || 'https://play.google.com/store/apps/details?id=com.wellnessvalley.app',
  ios:     process.env.REACT_APP_APP_STORE_URL   || 'https://apps.apple.com/app/wellness-valley/id000000000',
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
 * Build the WhatsApp share text for a body-parameters card.
 *
 * Shows a clean base URL (no UUID) in the message so recipients don't
 * see an internal token. The real shareUrl with token is used for
 * deep-link routing inside the app.
 *
 * @param {string} shareUrl  - e.g. https://host/share/bpc/<token>
 * @param {string} memberName
 * @returns {string}
 */
export function buildShareText(shareUrl, memberName) {
  const name = memberName ? memberName.trim() : 'you';
  // Strip the token so the message shows https://host/share instead of the full UUID URL.
  const cleanUrl = shareUrl ? shareUrl.replace(/\/share\/bpc\/[^?#]+.*$/, '/share').replace(/\/share\/[^?#]+.*$/, '/share') : '';
  const urlLine  = cleanUrl ? `\nTap to view → ${cleanUrl}` : '';
  return `👋 Hey ${name}! Your body parameters card is ready.${urlLine}`;
}
