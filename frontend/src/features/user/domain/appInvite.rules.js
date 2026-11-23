/**
 * App invite / share rules.
 * URL: https://wellnessvalley.in/share
 */

export const APP_SHARE_URL = 'https://wellnessvalley.in/share';
export const APP_SHARE_DISPLAY_URL = 'wellnessvalley.in/share';
export const PLAY_STORE_APP_URL = 'https://play.google.com/store/apps/details?id=com.wellnessvalley.app';

/**
 * Builds the text message for inviting friends to the Wellness Valley app.
 * @param {{ inviterName?: string }} [opts]
 * @returns {string}
 */
export function buildAppInviteShareText({ inviterName = '' } = {}) {
  const trimmed = String(inviterName || '').trim();
  const sponsorName = trimmed || 'your sponsor';
  return [
    'Join me on the Wellness Valley app!',
    '',
    'Download the app using the link below:',
    APP_SHARE_DISPLAY_URL,
    '',
    'Step 1: Enter your mobile number.',
    '',
    'Step 2: Enter the OTP sent to your mobile number.',
    '',
    `Step 3: Enter ${sponsorName} under Sponsor Name and select it.`,
    '',
    'Step 4: Enter the OTP received by your sponsor.',
    '',
    'Step 5: Complete your profile and enjoy the app!',
  ].join('\n');
}

export const APP_INVITE_MESSAGE = buildAppInviteShareText();

/**
 * Builds the WhatsApp share URL directly with the invite message.
 * @param {{ inviterName?: string }} [opts]
 * @returns {string}
 */
export function buildWhatsAppInviteUrl({ inviterName = '' } = {}) {
  const text = buildAppInviteShareText({ inviterName });
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
}

/**
 * Builds the complete share payload for Web Share API / Capacitor Share.
 * @param {{ inviterName?: string }} [opts]
 */
export function buildAppInviteSharePayload({ inviterName = '' } = {}) {
  const text = buildAppInviteShareText({ inviterName });
  return {
    title: 'Wellness Valley Invite',
    text,
    url: APP_SHARE_URL,
    dialogTitle: 'Share on WhatsApp',
    whatsappUrl: buildWhatsAppInviteUrl({ inviterName }),
  };
}
