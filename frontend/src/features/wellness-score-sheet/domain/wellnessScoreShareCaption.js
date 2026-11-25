/**
 * WhatsApp caption lines for the member's current wellness score.
 * Used on food / water / education / weight / leaderboard shares.
 */

/**
 * @param {unknown} earned
 * @param {unknown} possible
 * @returns {string[]}
 */
export function formatWellnessScoreWhatsAppNoticeLines(earned, possible) {
  if (earned == null || possible == null || earned === '' || possible === '') {
    return [];
  }
  const earnedN = Number(earned);
  const possibleN = Number(possible);
  if (!Number.isFinite(earnedN) || !Number.isFinite(possibleN) || possibleN <= 0) {
    return [];
  }
  return ['*Wellness Score*', `${Math.round(earnedN)} / ${Math.round(possibleN)}`];
}
