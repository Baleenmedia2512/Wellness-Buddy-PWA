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
 * Uses /share (already deployed) — opens app or store; no tokens or member data.
 *
 * @param {string} [apiBaseUrl] - from getApiBaseUrl()
 * @returns {string}
 */
export function buildOnboardingShareUrl(apiBaseUrl) {
  const base = String(apiBaseUrl || process.env.REACT_APP_API_BASE_URL || '')
    .replace(/\/+$/, '');
  if (base) return `${base}/share`;
  return STORE_LINKS.web;
}

/**
 * Caption for WhatsApp when the body-parameters card IMAGE is the attachment.
 * Omits a full https:// URL so WhatsApp does not replace the image with an OG link card.
 *
 * @param {string} memberName
 * @param {string|null} shareUrl - generic /app link (host/path only in caption)
 * @returns {string}
 */
export function buildShareCaptionForImage(memberName, shareUrl) {
  const firstName = memberName?.trim().split(/\s+/)[0] || 'there';
  const lines = [
    `Hey ${firstName}! Your coach shared your body parameters.`,
    'Install or open Wellness Valley app.',
  ];
  if (shareUrl) {
    lines.push(shareUrl.replace(/^https?:\/\//i, ''));
  }
  return lines.join('\n');
}

/**
 * Build plain-text WhatsApp message (text-only fallback — no image).
 *
 * @param {string|null} shareUrl
 * @param {string} memberName
 * @returns {string}
 */
export function buildShareText(shareUrl, memberName) {
  return buildShareCaptionForImage(memberName, shareUrl);
}
