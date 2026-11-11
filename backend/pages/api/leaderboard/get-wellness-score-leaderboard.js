import { getMysqlClient } from '../../../utils/mysqlClient.js';
import { isEnabled } from '../../../shared/lib/feature-flags.js';
import {
  resolveRequestedDateYmd,
  todayInTimezone,
  shiftDateYmd,
  IANA_IST,
} from '../../../shared/lib/datetime/index.js';
import logger from '../../../shared/lib/logger.js';
import { resolveSponsorAndIdealCoachForMembers } from '../../../utils/sponsorCoachResolution.js';
import { filterPublicAggregateUsers } from '../../../features/user/domain/aggregate-eligibility.rules.js';
import { cache } from '../../../utils/cache.js';
import {
  loadReportingContextForCoach,
  collectVisibleHierarchyUsers,
} from '../../../utils/reportingHierarchyService.js';
import { isActiveTeamStatus } from '../../../utils/teamHierarchyBuilder.js';
import {
  aggregateWellnessWindowScores,
  rankWellnessLeaderboardEntries,
  WELLNESS_LEADERBOARD_WINDOW_DAYS,
} from '../../../utils/wellnessScoreLeaderboard.js';
import { computeDailyScoreForDate } from '../../../features/wellness-score/api/daily-score.handler.js';
import { resolveLeaderboardViewerId } from '../../../utils/leaderboardViewer.js';
import { cashfreeCheckoutMode } from '../../../features/payments/domain/premium.rules.js';
import { attachPremiumFlags } from '../../../features/payments/data/premium.repository.js';

const LEADERBOARD_CACHE_TTL_MS = 15 * 1000;

/** PostgREST `.in()` URL limit — batch score lookups for large allowed sets. */
const SCORE_LOOKUP_CHUNK = 150;

/**
 * Hierarchy-scoped Wellness Score Leaderboard — top performers for today's IST score.
 * Reads persisted rows from wellness_score_daily_table (not discipline %).
 *
 * Order of work (must NOT global-top then filter):
 *   logged-in user → allowed hierarchy → app users (Active + public-aggregate) →
 *   existing scores → sort → Top N.
 *
 * Ranking (days omitted or not 10): wellness % desc, then total_earned desc.
 * Ranking (days=10): summed earned points over the last 10 IST days (ending on
 * scoreDate), then wellness % of that sum. A day with no row adds 0/0.
 * Equal scores share the same rank. Display order: Rank 1 → Rank N (best first).
 * Missing `days` stays on today's board so already released apps are unchanged.
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cache-Control, Pragma');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ success: false, message: 'Method not allowed' });
    return;
  }

  if (!isEnabled('ff.wellness-score-sheet')) {
    return res.status(200).json({ success: true, data: [], topN: 0, message: 'Feature disabled' });
  }

  try {
    const db = getMysqlClient();
    const topN = Math.min(parseInt(req.query.topN, 10) || 10, 10);
    // Missing or any value other than 10 stays on today's board (released apps).
    const windowDays = parseInt(req.query.days, 10) === WELLNESS_LEADERBOARD_WINDOW_DAYS
      ? WELLNESS_LEADERBOARD_WINDOW_DAYS
      : 1;
    const viewerUserId = await resolveLeaderboardViewerId({
      userId: req.query.userId,
      email: req.query.email,
    });
    const scoreDate = req.query.date
      ? resolveRequestedDateYmd(req.query.date, IANA_IST)
      : todayInTimezone(IANA_IST);
    const scoreDateStart = windowDays === 1
      ? scoreDate
      : shiftDateYmd(scoreDate, -(windowDays - 1), IANA_IST);

    if (!viewerUserId) {
      return res.status(200).json({
        success: true,
        data: [],
        topN,
        scoreDate,
        scoreDateStart,
        scoreDateEnd: scoreDate,
        windowDays,
        message: 'userId is required',
      });
    }

    const cacheKey = `lb:hierarchy:wellness:v4:${viewerUserId}:${topN}:${scoreDate}:d${windowDays}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.status(200).json(cached);
    }

    logger.debug(`[WELLNESS-LB] Top ${topN} for ${scoreDateStart}..${scoreDate} days=${windowDays} viewer=${viewerUserId}`);

    // Indexed subtree: viewer + ancestors (people only) + own downline + co-coach peers.
    // Does not scan team_table and does not load other branches under an upline.
    const context = await loadReportingContextForCoach(db, viewerUserId);
    const visibleUsers = collectVisibleHierarchyUsers(viewerUserId, context);

    // Only trust the hierarchy-scoped visible list.
    // This prevents leaking peer-descendants via indexed subtree load.
    const visibleById = new Map(
      visibleUsers.map((u) => [Number(u.UserId), u]),
    );

    // Existing app-user rule: Active + public-aggregate (excludes prod developers).
    const appUsers = filterPublicAggregateUsers(
      [...visibleById.values()].filter((u) => isActiveTeamStatus(u.Status)),
      { viewerUserId },
    );

    const allowedIds = appUsers
      .map((u) => Number(u.UserId))
      .filter((id) => Number.isFinite(id) && id > 0);

    if (allowedIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        topN,
        scoreDate,
        scoreDateStart,
        scoreDateEnd: scoreDate,
        windowDays,
        message: 'No allowed users in hierarchy',
      });
    }

    let scores = await fetchScoresForUsers(db, allowedIds, {
      scoreDate,
      startDate: windowDays === 1 ? null : scoreDateStart,
      endDate: windowDays === 1 ? null : scoreDate,
    });

    // Keep the viewer's row in sync with Home (/daily). Missing OR stale
    // snapshots used to leave you off Top 10 while the card already showed
    // the live score (persist can lag or fail without blocking /daily).
    const VIEWER_SCORE_MAX_AGE_MS = 20 * 1000;
    if (allowedIds.includes(viewerUserId)) {
      const viewerRow = scores.find((row) => (
        Number(row.user_id) === viewerUserId
        && (windowDays === 1 || String(row.score_date || '').slice(0, 10) === scoreDate)
      ));
      const computedAtMs = viewerRow?.computed_at
        ? Date.parse(viewerRow.computed_at)
        : NaN;
      const viewerStale =
        !viewerRow
        || !Number.isFinite(computedAtMs)
        || Date.now() - computedAtMs > VIEWER_SCORE_MAX_AGE_MS;
      if (viewerStale) {
        try {
          await computeDailyScoreForDate({ userId: viewerUserId, date: scoreDate });
          scores = await fetchScoresForUsers(db, allowedIds, {
            scoreDate,
            startDate: windowDays === 1 ? null : scoreDateStart,
            endDate: windowDays === 1 ? null : scoreDate,
          });
        } catch (computeErr) {
          logger.debug('[WELLNESS-LB] Viewer score compute skipped', {
            err: computeErr.message,
          });
        }
      }
    }

    if (!scores.length) {
      return res.status(200).json({
        success: true,
        data: [],
        topN,
        scoreDate,
        scoreDateStart,
        scoreDateEnd: scoreDate,
        windowDays,
        message: windowDays === 1
          ? 'No wellness scores for today'
          : 'No wellness scores in the last 10 days',
      });
    }

    const activeMap = new Map(appUsers.map((u) => [Number(u.UserId), u]));
    const candidates = windowDays === 1
      ? candidatesFromSingleDay(activeMap, scores)
      : candidatesFromWindow(activeMap, scores);

    const ranked = rankWellnessLeaderboardEntries(
      candidates,
      topN,
      windowDays === 1 ? undefined : { orderBy: 'earned' },
    );

    const sponsorByUser = await resolveSponsorAndIdealCoachForMembers(
      ranked.map((entry) => {
        const user = activeMap.get(Number(entry.userId));
        return { userId: entry.userId, coachId: user?.CoachId };
      }),
    );

    const withSponsors = ranked.map((entry) => {
      const resolved = sponsorByUser.get(String(entry.userId));
      const sponsorName = resolved?.sponsorName || null;
      return {
        ...entry,
        coachName: sponsorName || 'No Sponsor',
        sponsorName: sponsorName || 'No Sponsor',
        idealCoachId: resolved?.idealCoachId || null,
        idealCoachName: resolved?.idealCoachName || null,
      };
    });

    const withPremium = await attachPremiumFlags(withSponsors, {
      mode: cashfreeCheckoutMode(process.env.CASHFREE_ENV || 'sandbox'),
    });

    const payload = {
      success: true,
      data: withPremium,
      topN,
      scoreDate,
      scoreDateStart,
      scoreDateEnd: scoreDate,
      windowDays,
      totalEligible: candidates.length,
    };
    cache.set(cacheKey, payload, LEADERBOARD_CACHE_TTL_MS);
    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json(payload);
  } catch (error) {
    logger.error('[WELLNESS-LB] Error', { err: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to calculate wellness score leaderboard',
      error: error.message,
    });
  }
}

/**
 * @param {Map<number, object>} activeMap
 * @param {Array<object>} scores
 */
function candidatesFromSingleDay(activeMap, scores) {
  const scoreByUser = new Map();
  for (const row of scores) {
    const uid = Number(row.user_id);
    if (!scoreByUser.has(uid)) scoreByUser.set(uid, row);
  }

  const candidates = [];
  for (const [uid, row] of scoreByUser) {
    const user = activeMap.get(uid);
    if (!user) continue;
    candidates.push(toCandidate(user, {
      wellnessPercentage: Number(row.percentage) || 0,
      totalEarned: row.total_earned,
      totalPossible: row.total_possible,
    }));
  }
  return candidates;
}

/**
 * @param {Map<number, object>} activeMap
 * @param {Array<object>} scores
 */
function candidatesFromWindow(activeMap, scores) {
  const totalsByUser = aggregateWellnessWindowScores(scores);
  const candidates = [];
  for (const [uid, totals] of totalsByUser) {
    const user = activeMap.get(uid);
    if (!user) continue;
    candidates.push(toCandidate(user, totals));
  }
  return candidates;
}

function toCandidate(user, totals) {
  return {
    userId: user.UserId,
    userName: user.UserName || 'Unknown',
    email: user.Email,
    coachName: 'No Sponsor',
    sponsorName: 'No Sponsor',
    idealCoachId: null,
    idealCoachName: null,
    profileImage: null,
    wellnessPercentage: totals.wellnessPercentage,
    totalEarned: totals.totalEarned,
    totalPossible: totals.totalPossible,
  };
}

/**
 * @param {object} db
 * @param {number[]} userIds
 * @param {{ scoreDate: string, startDate: string|null, endDate: string|null }} range
 * @returns {Promise<Array<{ user_id: number, score_date: string, percentage: number, total_earned: number, total_possible: number, computed_at: string }>>}
 */
async function fetchScoresForUsers(db, userIds, range) {
  const rows = [];
  for (let i = 0; i < userIds.length; i += SCORE_LOOKUP_CHUNK) {
    const chunk = userIds.slice(i, i + SCORE_LOOKUP_CHUNK);
    let query = db
      .from('wellness_score_daily_table')
      .select('user_id, score_date, percentage, total_earned, total_possible, computed_at')
      .in('user_id', chunk);
    if (range.startDate && range.endDate) {
      query = query.gte('score_date', range.startDate).lte('score_date', range.endDate);
    } else {
      query = query.eq('score_date', range.scoreDate);
    }
    const { data, error } = await query;
    if (error) throw error;
    if (data?.length) rows.push(...data);
  }
  return rows;
}
