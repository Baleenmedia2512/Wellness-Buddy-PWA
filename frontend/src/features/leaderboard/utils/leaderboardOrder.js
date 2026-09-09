/**
 * Home leaderboard strip order: #1, #2, … #N (best first).
 */
export function sortLeaderboardByRankAsc(data) {
  return [...(data || [])].sort(
    (a, b) => (Number(a.rank) || 0) - (Number(b.rank) || 0),
  );
}
