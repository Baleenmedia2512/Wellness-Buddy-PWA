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
 * Uses the creating coach's name and the card Venue (locationName).
 *
 * @param {string} coachName - coach who created the BCP
 * @param {string} [venue] - venue / location entered on the card
 * @param {string|null} [shareUrl] - optional app link (host/path only in caption)
 * @returns {string}
 */
export function buildShareCaptionForImage(coachName, venue, shareUrl) {
  const shortName = String(coachName || '').trim().split(/\s+/).filter(Boolean)[0] || 'your coach';
  const place = String(venue || '').trim();
  const meetLine = place
    ? `It was good to meet you at the fat camp in ${place}. I'm enclosing your body composition metrics here with.`
    : `It was good to meet you at the fat camp. I'm enclosing your body composition metrics here with.`;
  const lines = [
    `Hi, this is ${shortName}.`,
    '',
    meetLine,
  ];
  if (shareUrl) {
    lines.push('', String(shareUrl).replace(/^https?:\/\//i, ''));
  }
  return lines.join('\n');
}

/**
 * Build plain-text WhatsApp message (text-only fallback — no image).
 *
 * @param {string|null} shareUrl
 * @param {string} coachName
 * @param {string} [venue]
 * @returns {string}
 */
export function buildShareText(shareUrl, coachName, venue) {
  return buildShareCaptionForImage(coachName, venue, shareUrl);
}
