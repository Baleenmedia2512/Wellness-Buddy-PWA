import { getSupabaseClient } from '../../../utils/supabaseClient.js';
import { isEnabled } from '../../../shared/lib/feature-flags.js';
import {
  resolveRequestedDateYmd,
  todayInTimezone,
  IANA_IST,
} from '../../../shared/lib/datetime/index.js';
import logger from '../../../shared/lib/logger.js';
import { resolveSponsorAndIdealCoachForMembers } from '../../../utils/sponsorCoachResolution.js';

/**
 * Global Wellness Score Leaderboard — top performers for today's IST score.
 * Reads persisted rows from wellness_score_daily_table (not discipline %).
 * Ranking: wellness % desc, then total_earned desc; equal scores share the same rank
 * (competition / “1224” ranking on the % + earned score pair).
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
    const scoreDate = req.query.date
      ? resolveRequestedDateYmd(req.query.date, IANA_IST)
      : todayInTimezone(IANA_IST);

    logger.debug(`[WELLNESS-LB] Top ${topN} for ${scoreDate}`);

    // Fetch a buffer so inactive users can be filtered without under-filling topN.
    // Primary order: wellness %; tie-break: total earned (score-wise top N).
    const { data: scores, error: scoresError } = await supabase
      .from('wellness_score_daily_table')
      .select('user_id, percentage, total_earned, total_possible, computed_at')
      .eq('score_date', scoreDate)
      .order('percentage', { ascending: false })
      .order('total_earned', { ascending: false })
      .limit(topN * 3);

    if (scoresError) throw scoresError;

    if (!scores?.length) {
      return res.status(200).json({
        success: true,
        data: [],
        topN,
        scoreDate,
        message: 'No wellness scores for today',
      });
    }

    const userIds = [...new Set(scores.map((s) => s.user_id))];

    const { data: users, error: usersError } = await supabase
      .from('team_table')
      .select('UserId, UserName, Email, CoachId, Status, ProfileImage')
      .in('UserId', userIds)
      .ilike('Status', 'Active');

    if (usersError) throw usersError;

    const activeMap = new Map((users || []).map((u) => [u.UserId, u]));

    const sponsorByUser = await resolveSponsorAndIdealCoachForMembers(
      (users || []).map((u) => ({ userId: u.UserId, coachId: u.CoachId })),
    );

    const candidates = [];
    for (const row of scores) {
      const user = activeMap.get(row.user_id);
      if (!user) continue;
      const resolved = sponsorByUser.get(String(user.UserId));
      const sponsorName = resolved?.sponsorName || null;

      candidates.push({
        userId: user.UserId,
        userName: user.UserName || 'Unknown',
        email: user.Email,
        coachName: sponsorName || 'No Sponsor',
        sponsorName: sponsorName || 'No Sponsor',
        idealCoachId: resolved?.idealCoachId || null,
        idealCoachName: resolved?.idealCoachName || null,
        profileImage: user.ProfileImage || null,
        wellnessPercentage: Number(row.percentage) || 0,
        totalEarned: row.total_earned,
        totalPossible: row.total_possible,
      });
    }

    // Score-wise order: % desc, then earned desc.
    candidates.sort((a, b) => {
      if (b.wellnessPercentage !== a.wellnessPercentage) {
        return b.wellnessPercentage - a.wellnessPercentage;
      }
      return (Number(b.totalEarned) || 0) - (Number(a.totalEarned) || 0);
    });

    // Same score (same % and same total earned) → same rank.
    // Different scores get distinct ranks (e.g. 400 and 398 → #3 and #4).
    const ranked = [];
    let currentRank = 1;
    let previousKey = null;

    for (const entry of candidates) {
      if (ranked.length >= topN) break;

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

    return res.status(200).json({
      success: true,
      data: ranked,
      topN,
      scoreDate,
      totalEligible: ranked.length,
    });
  } catch (error) {
    logger.error('[WELLNESS-LB] Error', { err: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to calculate wellness score leaderboard',
      error: error.message,
    });
  }
}
