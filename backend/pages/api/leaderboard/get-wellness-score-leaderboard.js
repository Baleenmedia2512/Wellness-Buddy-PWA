import { getSupabaseClient } from '../../../utils/supabaseClient.js';
import { isEnabled } from '../../../shared/lib/feature-flags.js';
import {
  resolveRequestedDateYmd,
  todayInTimezone,
  IANA_IST,
} from '../../../shared/lib/datetime/index.js';
import logger from '../../../shared/lib/logger.js';

/**
 * Global Wellness Score Leaderboard — top performers for today's IST score.
 * Reads persisted rows from wellness_score_daily_table (not discipline %).
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

    const { data: scores, error: scoresError } = await supabase
      .from('wellness_score_daily_table')
      .select('user_id, percentage, total_earned, total_possible, computed_at')
      .eq('score_date', scoreDate)
      .order('percentage', { ascending: false })
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

    const coachIds = [...new Set((users || []).map((u) => u.CoachId).filter(Boolean))];
    const coachNameMap = {};
    if (coachIds.length > 0) {
      const { data: coaches } = await supabase
        .from('team_table')
        .select('UserId, UserName')
        .in('UserId', coachIds);
      (coaches || []).forEach((c) => {
        coachNameMap[c.UserId] = c.UserName;
      });
    }

    const ranked = [];
    let currentRank = 1;
    let previousPct = null;

    for (const row of scores) {
      const user = activeMap.get(row.user_id);
      if (!user) continue;

      const pct = Number(row.percentage) || 0;
      if (previousPct !== null && pct !== previousPct) {
        currentRank = ranked.length + 1;
      }
      if (ranked.length >= topN) break;

      ranked.push({
        rank: currentRank,
        userId: user.UserId,
        userName: user.UserName || 'Unknown',
        email: user.Email,
        coachName: user.CoachId ? (coachNameMap[user.CoachId] || 'No Coach') : 'No Coach',
        profileImage: user.ProfileImage || null,
        wellnessPercentage: pct,
        totalEarned: row.total_earned,
        totalPossible: row.total_possible,
      });

      previousPct = pct;
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
