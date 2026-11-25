/**
 * Wellness Score home-strip ranking — applied AFTER hierarchy + app-user filter.
 * Does not change score calculation; only orders existing persisted scores.
 */

/** Preset length for home "Last 10 Days". */
export const WELLNESS_LEADERBOARD_WINDOW_DAYS = 10;

/** Inclusive custom-range / API window cap (IST). */
export const WELLNESS_LEADERBOARD_MAX_WINDOW_DAYS = 30;

/**
 * Resolve `days` query for wellness leaderboard.
 * Missing / invalid / 1 → today (legacy released apps).
 * 2..30 → multi-day IST window ending on `date` (or today).
 * 31+ → today (do not expand past the cap).
 * Released apps only omit `days` or send `days=10` — both stay unchanged.
 *
 * @param {unknown} rawDays
 * @returns {number}
 */
export function resolveWellnessLeaderboardWindowDays(rawDays) {
  const n = parseInt(rawDays, 10);
  if (!Number.isFinite(n) || n < 2) return 1;
  if (n > WELLNESS_LEADERBOARD_MAX_WINDOW_DAYS) return 1;
  return n;
}

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
 * A calendar day with no row adds 0 earned towards the window total.
 * One row per user per score_date; a later computed_at wins if duplicated.
 * When `windowDays` is provided (e.g. 10), each user's totalPossible is fixed
 * at windowDays * dailyPossible (e.g. 10 * 1000 = 10000, or 10 * 1100 = 11000)
 * so that every user is evaluated out of the same total.
 *
 * @param {Array<{ user_id: number, score_date?: string, total_earned?: number, total_possible?: number, computed_at?: string }>} rows
 * @param {number|null} [windowDays=null]
 * @param {number} [dailyPossible=1000] Daily max score configured by admin (defaults to 1000)
 * @returns {Map<number, { totalEarned: number, totalPossible: number, wellnessPercentage: number }>}
 */
export function aggregateWellnessWindowScores(rows, windowDays = null, dailyPossible = 1000) {
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

  const dailyTarget = Number(dailyPossible) > 0 ? Number(dailyPossible) : 1000;
  const fixedPossible = Number(windowDays) > 0 ? Math.round(Number(windowDays) * dailyTarget) : null;

  const byUser = new Map();
  for (const row of byUserDate.values()) {
    const uid = Number(row.user_id);
    const prev = byUser.get(uid) || { totalEarned: 0, totalPossible: 0 };
    prev.totalEarned += Number(row.total_earned) || 0;
    prev.totalPossible += Number(row.total_possible) || 0;
    byUser.set(uid, prev);
  }

  for (const totals of byUser.values()) {
    if (fixedPossible != null) {
      totals.totalPossible = fixedPossible;
    }
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
