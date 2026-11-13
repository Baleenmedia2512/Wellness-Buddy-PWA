/**
 * App invite / share rules.
 * URL: https://play.google.com/store/apps/details?id=com.wellnessvalley.app
 */

export const PLAY_STORE_APP_URL = 'https://play.google.com/store/apps/details?id=com.wellnessvalley.app';

/**
 * Builds the text message for inviting friends to the Wellness Valley app.
 * @param {{ inviterName?: string }} [opts]
 * @returns {string}
 */
export function buildAppInviteShareText({ inviterName = '' } = {}) {
  const inviter = String(inviterName || '').trim();
  const greeting = inviter
    ? `🌟 ${inviter} invites you to join Wellness Valley!`
    : '🌟 Join me on Wellness Valley!';

  return [
    greeting,
    'Your personal health and wellness companion for daily nutrition tracking, body parameters, healthy habits, and expert coaching.',
    '',
    'Download the app on Google Play Store:',
    PLAY_STORE_APP_URL,
  ].join('\n');
}

/**
 * Builds the complete share payload for Web Share API / Capacitor Share.
 * @param {{ inviterName?: string }} [opts]
 */
export function buildAppInviteSharePayload({ inviterName = '' } = {}) {
  const text = buildAppInviteShareText({ inviterName });
  return {
    title: 'Join me on Wellness Valley',
    text,
    url: PLAY_STORE_APP_URL,
    dialogTitle: 'Invite Friends to Wellness Valley',
    fileName: 'wellness-valley-invite.png',
  };
}

