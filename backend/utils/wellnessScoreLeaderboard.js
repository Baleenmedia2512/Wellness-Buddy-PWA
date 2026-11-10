/**
 * Wellness Score home-strip ranking — applied AFTER hierarchy + app-user filter.
 * Does not change score calculation; only orders existing persisted scores.
 */

/** Inclusive IST window for the home "Show more" board. */
export const WELLNESS_LEADERBOARD_WINDOW_DAYS = 10;

/**
 * @param {Array<{ wellnessPercentage?: number, totalEarned?: number }>} entries
 * @param {number} [topN=10]
 * @param {{ orderBy?: 'percentage' | 'earned' }} [options]
 *   percentage — today's board: wellness % desc, then earned desc.
 *   earned — last-10-days board: summed points desc, then % desc.
 * @returns {Array<object>} Rank 1 → Rank N (best first), length ≤ topN
 */
export function rankWellnessLeaderboardEntries(entries, topN = 10, options = {}) {
  const limit = Math.min(Math.max(parseInt(topN, 10) || 10, 1), 10);
  const orderByEarned = options.orderBy === 'earned';

  const sorted = [...(entries || [])].sort((a, b) => {
    const earnedA = Number(a.totalEarned) || 0;
    const earnedB = Number(b.totalEarned) || 0;
    const pctA = Number(a.wellnessPercentage) || 0;
    const pctB = Number(b.wellnessPercentage) || 0;
    if (orderByEarned) {
      if (earnedB !== earnedA) return earnedB - earnedA;
      return pctB - pctA;
    }
    if (pctB !== pctA) return pctB - pctA;
    return earnedB - earnedA;
  });

  const ranked = [];
  let currentRank = 1;
  let previousKey = null;

  for (const entry of sorted) {
    if (ranked.length >= limit) break;

    const earned = Number(entry.totalEarned) || 0;
    const pct = Number(entry.wellnessPercentage) || 0;
    const scoreKey = orderByEarned ? `${earned}:${pct}` : `${pct}:${earned}`;
    if (previousKey !== null && scoreKey !== previousKey) {
      currentRank = ranked.length + 1;
    }

    ranked.push({
      ...entry,
      rank: currentRank,
    });
    previousKey = scoreKey;
  }

  return ranked;
}

/**
 * Sum persisted daily rows inside a window.
 * A calendar day with no row adds nothing (0 earned, 0 possible).
 * One row per user per score_date; a later computed_at wins if duplicated.
 *
 * @param {Array<{ user_id: number, score_date?: string, total_earned?: number, total_possible?: number, computed_at?: string }>} rows
 * @returns {Map<number, { totalEarned: number, totalPossible: number, wellnessPercentage: number }>}
 */
export function aggregateWellnessWindowScores(rows) {
  const byUserDate = new Map();
  for (const row of rows || []) {
    const uid = Number(row?.user_id);
    const date = calendarDateKey(row?.score_date);
    if (!Number.isFinite(uid) || uid <= 0 || !date) continue;
    const key = `${uid}:${date}`;
    const existing = byUserDate.get(key);
    if (!existing) {
      byUserDate.set(key, row);
      continue;
    }
    const existingAt = Date.parse(existing.computed_at || '') || 0;
    const nextAt = Date.parse(row.computed_at || '') || 0;
    if (nextAt >= existingAt) byUserDate.set(key, row);
  }

  const byUser = new Map();
  for (const row of byUserDate.values()) {
    const uid = Number(row.user_id);
    const prev = byUser.get(uid) || { totalEarned: 0, totalPossible: 0 };
    prev.totalEarned += Number(row.total_earned) || 0;
    prev.totalPossible += Number(row.total_possible) || 0;
    byUser.set(uid, prev);
  }

  for (const totals of byUser.values()) {
    totals.wellnessPercentage = totals.totalPossible > 0
      ? Math.round((totals.totalEarned / totals.totalPossible) * 100)
      : 0;
  }

  return byUser;
}

function calendarDateKey(value) {
  const match = String(value || '').match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : '';
}
