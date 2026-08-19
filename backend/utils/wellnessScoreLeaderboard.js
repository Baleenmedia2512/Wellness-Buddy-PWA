/**
 * Wellness Score home-strip ranking — applied AFTER hierarchy + app-user filter.
 * Does not change score calculation; only orders existing persisted scores.
 */

/**
 * @param {Array<{ wellnessPercentage?: number, totalEarned?: number }>} entries
 * @param {number} [topN=10]
 * @returns {Array<object>} Rank N → Rank 1 (home marquee order), length ≤ topN
 */
export function rankWellnessLeaderboardEntries(entries, topN = 10) {
  const limit = Math.min(Math.max(parseInt(topN, 10) || 10, 1), 10);

  const sorted = [...(entries || [])].sort((a, b) => {
    if (b.wellnessPercentage !== a.wellnessPercentage) {
      return b.wellnessPercentage - a.wellnessPercentage;
    }
    return (Number(b.totalEarned) || 0) - (Number(a.totalEarned) || 0);
  });

  const ranked = [];
  let currentRank = 1;
  let previousKey = null;

  for (const entry of sorted) {
    if (ranked.length >= limit) break;

    const earned = Number(entry.totalEarned) || 0;
    const scoreKey = `${entry.wellnessPercentage}:${earned}`;
    if (previousKey !== null && scoreKey !== previousKey) {
      currentRank = ranked.length + 1;
    }

    ranked.push({
      ...entry,
      rank: currentRank,
    });
    previousKey = scoreKey;
  }

  ranked.reverse();
  return ranked;
}
