/**
 * App invite / share rules.
 * URL: https://wellnessvalley.in/share
 */

export const APP_SHARE_URL = 'https://wellnessvalley.in/share';
export const PLAY_STORE_APP_URL = 'https://play.google.com/store/apps/details?id=com.wellnessvalley.app';

export const APP_INVITE_MESSAGE = [
  '🎉 Welcome to Wellness Valley! 🌿',
  '',
  '📲 Download the app using the link below:',
  APP_SHARE_URL,
  '',
  'Step 1: Enter your mobile number and verify it using the OTP.',
  '',
  "Step 2: Select the Sponsor's email address who invited you and verify it using the OTP sent to that email.",
  '',
  'Step 3: Fill in all the required details in the Complete Profile form.',
].join('\n');

/**
 * Builds the text message for inviting friends to the Wellness Valley app.
 * @param {{ inviterName?: string }} [opts]
 * @returns {string}
 */
export function buildAppInviteShareText({ inviterName = '' } = {}) {
  void inviterName;
  return APP_INVITE_MESSAGE;
}

/**
 * Builds the complete share payload for Web Share API / Capacitor Share.
 * @param {{ inviterName?: string }} [opts]
 */
export function buildAppInviteSharePayload({ inviterName = '' } = {}) {
  const text = buildAppInviteShareText({ inviterName });
  return {
    title: 'Welcome to Wellness Valley',
    text,
    url: APP_SHARE_URL,
    dialogTitle: 'Invite Friends to Wellness Valley',
    fileName: 'wellness-valley-invite.png',
  };
}
