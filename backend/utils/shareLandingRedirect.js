/**
 * shareLandingRedirect.js — device-aware redirect for /share onboarding links.
 *
 * Real users: HTTP 302 straight to Play Store / App Store (no landing UI).
 * Link-preview bots (WhatsApp, etc.): return props so the page can emit OG tags.
 *
 * When the native app is installed, Android App Links open the app before
 * this page loads — the user never hits these redirects.
 */

export const APP_PACKAGE = 'com.wellnessvalley.app';
export const APP_STORE_ID = '6764327692';

/** HTTPS fallbacks — work in any browser. */
export const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${APP_PACKAGE}`;
export const APP_STORE_URL = `https://apps.apple.com/in/app/wellness-valley/id${APP_STORE_ID}`;

/** Opens the Play Store app on Android when supported. */
export const PLAY_STORE_NATIVE_URL = `market://details?id=${APP_PACKAGE}`;

/** Opens the App Store app on iOS when supported. */
export const APP_STORE_NATIVE_URL = `itms-apps://apps.apple.com/in/app/wellness-valley/id${APP_STORE_ID}`;

const BOT_UA_RE = /facebookexternalhit|WhatsApp|Twitterbot|Slackbot|LinkedInBot|TelegramBot|Discordbot|Pinterest|Googlebot/i;
const IOS_UA_RE = /iPhone|iPad|iPod/i;
const ANDROID_UA_RE = /Android/i;

/**
 * @param {string} [userAgent]
 * @returns {boolean}
 */
export function isLinkPreviewBot(userAgent = '') {
  return BOT_UA_RE.test(userAgent);
}

/**
 * Pick the store URL for this device.
 *
 * @param {string} [userAgent]
 * @returns {string}
 */
export function resolveStoreUrl(userAgent = '') {
  if (IOS_UA_RE.test(userAgent)) return APP_STORE_NATIVE_URL;
  // HTTPS Play Store link opens the store app reliably inside WhatsApp / in-app browsers.
  if (ANDROID_UA_RE.test(userAgent)) return PLAY_STORE_URL;
  return PLAY_STORE_URL;
}

/**
 * Build getServerSideProps result for share landing pages.
 *
 * @param {{ req: { headers: Record<string, string> } }} context
 * @returns {Promise<{ redirect: object } | { props: object }>}
 */
export async function resolveShareLandingProps({ req }) {
  const ua = req.headers['user-agent'] || '';
  const proto = req.headers['x-forwarded-proto'] || (req.socket?.encrypted ? 'https' : 'http');
  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  const baseUrl = `${proto}://${host}`;

  if (isLinkPreviewBot(ua)) {
    return {
      props: {
        baseUrl,
        isBot: true,
        ogPath: '/share',
      },
    };
  }

  const destination = resolveStoreUrl(ua);
  return {
    redirect: {
      destination,
      permanent: false,
    },
  };
}
