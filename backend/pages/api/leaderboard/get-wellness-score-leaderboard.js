import { getSupabaseClient } from '../../../utils/supabaseClient.js';
import { isEnabled } from '../../../shared/lib/feature-flags.js';
import {
  resolveRequestedDateYmd,
  todayInTimezone,
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
import { rankWellnessLeaderboardEntries } from '../../../utils/wellnessScoreLeaderboard.js';

const LEADERBOARD_CACHE_TTL_MS = 2 * 60 * 1000;
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
 * Ranking: wellness % desc, then total_earned desc; equal scores share the same rank
 * (competition / “1224” ranking on the % + earned score pair).
 * Display order: Rank N → Rank 1 (reversed for home marquee, same as weight LB).
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
    const supabase = getSupabaseClient();
    const topN = Math.min(parseInt(req.query.topN, 10) || 10, 10);
    const viewerUserId = Number.parseInt(String(req.query.userId ?? ''), 10);
    const scoreDate = req.query.date
      ? resolveRequestedDateYmd(req.query.date, IANA_IST)
      : todayInTimezone(IANA_IST);

    if (!Number.isFinite(viewerUserId) || viewerUserId <= 0) {
      return res.status(200).json({
        success: true,
        data: [],
        topN,
        scoreDate,
        message: 'userId is required',
      });
    }

    const cacheKey = `lb:hierarchy:wellness:v1:${viewerUserId}:${topN}:${scoreDate}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.status(200).json(cached);
    }

    logger.debug(`[WELLNESS-LB] Top ${topN} for ${scoreDate} viewer=${viewerUserId}`);

    // Indexed subtree: viewer + ancestors (people only) + own downline + co-coach peers.
    // Does not scan team_table and does not load other branches under an upline.
    const context = await loadReportingContextForCoach(supabase, viewerUserId);
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
        message: 'No allowed users in hierarchy',
      });
    }

    const scores = await fetchScoresForUsers(supabase, allowedIds, scoreDate);

    if (!scores.length) {
      return res.status(200).json({
        success: true,
        data: [],
        topN,
        scoreDate,
        message: 'No wellness scores for today',
      });
    }

    const activeMap = new Map(appUsers.map((u) => [Number(u.UserId), u]));
    const scoreByUser = new Map();
    for (const row of scores) {
      const uid = Number(row.user_id);
      if (!scoreByUser.has(uid)) scoreByUser.set(uid, row);
    }

    const candidates = [];
    for (const [uid, row] of scoreByUser) {
      const user = activeMap.get(uid);
      if (!user) continue;
      candidates.push({
        userId: user.UserId,
        userName: user.UserName || 'Unknown',
        email: user.Email,
        coachName: 'No Sponsor',
        sponsorName: 'No Sponsor',
        idealCoachId: null,
        idealCoachName: null,
        profileImage: null,
        wellnessPercentage: Number(row.percentage) || 0,
        totalEarned: row.total_earned,
        totalPossible: row.total_possible,
      });
    }

    const ranked = rankWellnessLeaderboardEntries(candidates, topN);

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

    const payload = {
      success: true,
      data: withSponsors,
      topN,
      scoreDate,
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
 * @param {object} supabase
 * @param {number[]} userIds
 * @param {string} scoreDate
 * @returns {Promise<Array<{ user_id: number, percentage: number, total_earned: number, total_possible: number }>>}
 */
async function fetchScoresForUsers(supabase, userIds, scoreDate) {
  const rows = [];
  for (let i = 0; i < userIds.length; i += SCORE_LOOKUP_CHUNK) {
    const chunk = userIds.slice(i, i + SCORE_LOOKUP_CHUNK);
    const { data, error } = await supabase
      .from('wellness_score_daily_table')
      .select('user_id, percentage, total_earned, total_possible, computed_at')
      .eq('score_date', scoreDate)
      .in('user_id', chunk);
    if (error) throw error;
    if (data?.length) rows.push(...data);
  }
  return rows;
}
