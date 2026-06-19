/**
 * marathon.display.js — Pure client-side display logic for Marathon cards.
 *
 * No I/O. No React. No network calls.
 * Used by the dashboard and card components.
 */

/**
 * Build the public share URL for a marathon card.
 *
 * @param {string} baseUrl    — e.g. "https://app.wellnessvalley.com"
 * @param {string} shareToken — UUID from the API
 * @returns {string}
 */
export function buildShareUrl(baseUrl, shareToken) {
  if (!shareToken) return null;
  return `${baseUrl}/share/marathon/${shareToken}`;
}

/**
 * Map card type to a human-readable button label.
 *
 * @param {string} cardType
 * @returns {string}
 */
export function cardTypeLabel(cardType) {
  switch (cardType) {
    case 'team':             return 'Share Team Card';
    case 'day_leader':       return 'Share Day Leader';
    case 'lap_leader':       return 'Share Lap Leader';
    case 'community_leader': return 'Share Community Leader';
    default:                 return 'Share Card';
  }
}

/**
 * Returns true if the marathon has at least one participant with a daily change.
 *
 * @param {object} cardData
 * @returns {boolean}
 */
export function hasLiveData(cardData) {
  return (cardData?.participants || []).some(p => p.dailyChange != null);
}

/**
 * Sort participants for display:
 *   - Coach first
 *   - Then by lapChange ascending (most loss first)
 *   - Members with no data last
 *
 * @param {Array} participants
 * @returns {Array}
 */
export function sortParticipantsForDisplay(participants) {
  return [...participants].sort((a, b) => {
    if (a.role === 'coach' && b.role !== 'coach') return -1;
    if (b.role === 'coach' && a.role !== 'coach') return  1;
    const ac = a.lapChange ?? Infinity;
    const bc = b.lapChange ?? Infinity;
    return ac - bc;
  });
}
