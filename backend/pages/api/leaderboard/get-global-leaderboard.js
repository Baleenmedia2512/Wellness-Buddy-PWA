import { getSupabaseClient } from "../../../utils/supabaseClient.js";
import logger from '../../../shared/lib/logger.js';
import {
  nowUtc,
  todayInTimezone,
  shiftDateYmd,
  IANA_IST,
} from '../../../shared/lib/datetime/index.js';
import * as activityReportRepo from '../../../features/activity/activity-report.repository.js';
import { resolveSponsorAndIdealCoachForMembers } from '../../../utils/sponsorCoachResolution.js';
import { filterPublicAggregateUsers } from '../../../features/user/domain/aggregate-eligibility.rules.js';
import { cache } from '../../../utils/cache.js';
import {
  loadReportingContextForCoach,
  collectVisibleHierarchyUsers,
} from '../../../utils/reportingHierarchyService.js';
import { isActiveTeamStatus } from '../../../utils/teamHierarchyBuilder.js';
import { resolveLeaderboardViewerId } from '../../../utils/leaderboardViewer.js';

/** Server-side TTL — hierarchy-scoped; cache key includes viewerUserId. */
const LEADERBOARD_CACHE_TTL_MS = 2 * 60 * 1000;

/**
 * Hierarchy-scoped Weight Loss Leaderboard API
 * Calculates weight loss (today vs yesterday) for the viewer's allowed hierarchy
 * Returns top performers sorted by weight loss (descending)
 *
 * Order of work (must NOT global-top then filter):
 *   logged-in user → allowed hierarchy (upline people + sibling peers only +
 *   own full downline) → Active + public-aggregate → today/yesterday weights →
 *   sort → Top N.
 *
 * Logic:
 * - Only includes active users (Status = 'Active')
 * - Only includes users with weight loss > 0 and ≤ 3.0 kg (today vs yesterday)
 * - Losses above 3 kg are excluded (likely bad/OCR data) — this strip only
 * - Gains are never shown on this strip
 * - Compares most recent weight entry from today vs yesterday (IST)
 * - Returns: rank, profile (email for avatar), userName, coachName, weightLoss
 */
const MAX_TODAY_VS_YESTERDAY_LOSS_KG = 3;
/** PostgREST `.in()` limit — batch weight lookups for large allowed sets. */
const WEIGHT_LOOKUP_CHUNK = 150;

async function fetchWeightRecordsBatched(userIds, startDate, endDate, timezoneIana) {
  if (!userIds?.length) return [];
  const rows = [];
  for (let i = 0; i < userIds.length; i += WEIGHT_LOOKUP_CHUNK) {
    const chunk = userIds.slice(i, i + WEIGHT_LOOKUP_CHUNK);
    const chunkRows = await activityReportRepo.fetchWeightRecords(
      chunk,
      startDate,
      endDate,
      timezoneIana,
    );
    rows.push(...chunkRows);
  }
  return rows;
}

export default async function handler(req, res) {
  // Set CORS headers for all requests
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Cache-Control, Pragma",
  );

  // Prevent caching
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate",
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({ success: false, message: "Method not allowed" });
    return;
  }

  try {
    const topN = Math.min(parseInt(req.query.topN, 10) || 10, 10);
    const viewerUserId = await resolveLeaderboardViewerId({
      userId: req.query.userId,
      email: req.query.email,
    });

    if (!viewerUserId) {
      return res.status(200).json({
        success: true,
        data: [],
        topN,
        message: "userId is required",
      });
    }

    const cacheKey = `lb:hierarchy:weight:v1:${viewerUserId}:${topN}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      res.setHeader("X-Cache", "HIT");
      return res.status(200).json(cached);
    }

    const supabase = getSupabaseClient();

    logger.debug(
      `🏆 [LEADERBOARD] Hierarchy weight loss Top ${topN} viewer=${viewerUserId}`,
    );

    // Indexed subtree: viewer + ancestors (people only) + own downline + sibling peers.
    // Does not scan team_table and does not load peer-descendants / other upline branches.
    const context = await loadReportingContextForCoach(supabase, viewerUserId);
    const visibleUsers = collectVisibleHierarchyUsers(viewerUserId, context);

    // Only trust the hierarchy-scoped visible list.
    const visibleById = new Map(
      visibleUsers.map((u) => [Number(u.UserId), u]),
    );

    // Existing app-user rule: Active + public-aggregate (excludes prod developers).
    const activeUsers = filterPublicAggregateUsers(
      [...visibleById.values()].filter((u) => isActiveTeamStatus(u.Status)),
      { viewerUserId },
    );

    if (!activeUsers || activeUsers.length === 0) {
      logger.debug("⚠️ [LEADERBOARD] No allowed users in hierarchy");
      return res.status(200).json({
        success: true,
        data: [],
        topN,
        message: "No allowed users in hierarchy",
      });
    }

    logger.debug(`✅ [LEADERBOARD] Found ${activeUsers.length} allowed users`);

    // Calendar today/yesterday in platform timezone
    const todayYmd = todayInTimezone(IANA_IST);
    const yesterdayYmd = shiftDateYmd(todayYmd, -1, IANA_IST);

    logger.debug(`📅 [LEADERBOARD] Today: ${todayYmd}, Yesterday: ${yesterdayYmd}`);

    // Fetch weight records via UTC-aware repository helpers
    const activeUserIds = activeUsers.map((u) => u.UserId);
    const activeMap = new Map(activeUsers.map((u) => [Number(u.UserId), u]));

    const [todayWeights, yesterdayWeights] = await Promise.all([
      fetchWeightRecordsBatched(activeUserIds, todayYmd, todayYmd, IANA_IST),
      fetchWeightRecordsBatched(activeUserIds, yesterdayYmd, yesterdayYmd, IANA_IST),
    ]);

    // Create maps for quick lookup (get latest weight per user)
    const todayWeightMap = new Map();
    const yesterdayWeightMap = new Map();

    todayWeights?.forEach((record) => {
      if (!todayWeightMap.has(record.UserId)) {
        todayWeightMap.set(record.UserId, record);
      }
    });

    yesterdayWeights?.forEach((record) => {
      if (!yesterdayWeightMap.has(record.UserId)) {
        yesterdayWeightMap.set(record.UserId, record);
      }
    });

    logger.debug(
      `📊 [LEADERBOARD] Found ${todayWeightMap.size} users with today's weight, ${yesterdayWeightMap.size} with yesterday's weight`,
    );

    // Calculate weight loss for eligible users
    const leaderboardData = [];

    for (const user of activeUsers) {
      const todayRecord = todayWeightMap.get(user.UserId);
      const yesterdayRecord = yesterdayWeightMap.get(user.UserId);

      // Calculate weight loss if both records exist
      if (todayRecord && yesterdayRecord) {
        const todayWeight = parseFloat(todayRecord.Weight);
        const yesterdayWeight = parseFloat(yesterdayRecord.Weight);
        const weightLoss = yesterdayWeight - todayWeight; // Positive = weight lost

        // Loss-only, and within the Today vs Yesterday plausibility cap (≤ 3 kg).
        if (weightLoss > 0 && weightLoss <= MAX_TODAY_VS_YESTERDAY_LOSS_KG) {
          leaderboardData.push({
            userId: user.UserId,
            userName: user.UserName || "Unknown",
            email: user.Email || "",
            weightLoss: parseFloat(weightLoss.toFixed(2)),
            todayWeight: parseFloat(todayWeight.toFixed(2)),
            yesterdayWeight: parseFloat(yesterdayWeight.toFixed(2)),
            todayDate: todayRecord.CreatedAt,
            yesterdayDate: yesterdayRecord.CreatedAt,
          });
        }
      }
    }

    // Sort by weight loss (descending - highest first)
    leaderboardData.sort((a, b) => b.weightLoss - a.weightLoss);

    // Limit to topN and add rank with tie handling (dense ranking)
    // Users with same weight loss get same rank, next rank continues sequentially
    const rankedSlice = leaderboardData.slice(0, topN);
    const topResults = [];
    let currentRank = 1;
    let previousWeightLoss = null;

    rankedSlice.forEach((user) => {
      if (
        previousWeightLoss !== null &&
        user.weightLoss !== previousWeightLoss
      ) {
        currentRank++;
      }

      topResults.push({
        rank: currentRank,
        userId: user.userId,
        userName: user.userName,
        email: user.email,
        coachName: "No Sponsor",
        sponsorName: "No Sponsor",
        idealCoachId: null,
        idealCoachName: null,
        profileImage: null,
        weightLoss: user.weightLoss,
        todayWeight: user.todayWeight,
        yesterdayWeight: user.yesterdayWeight,
        comparison: "Today vs Yesterday",
      });

      previousWeightLoss = user.weightLoss;
    });

    // Sponsor + Ideal-Weight Coach only for ranked Top N (ADR-0007)
    const sponsorByUser = await resolveSponsorAndIdealCoachForMembers(
      topResults.map((entry) => {
        const user = activeMap.get(Number(entry.userId));
        return { userId: entry.userId, coachId: user?.CoachId };
      }),
    );

    const withSponsors = topResults.map((entry) => {
      const resolved = sponsorByUser.get(String(entry.userId));
      const sponsorName = resolved?.sponsorName || null;
      return {
        ...entry,
        coachName: sponsorName || "No Sponsor",
        sponsorName: sponsorName || "No Sponsor",
        idealCoachId: resolved?.idealCoachId || null,
        idealCoachName: resolved?.idealCoachName || null,
      };
    });

    // Reverse order for display (show worst to best: Rank 10 → Rank 1)
    withSponsors.reverse();

    // Intentionally omit ProfileImage (base64) — 10 avatars were ~2–4 MB and
    // dominated TTFB. UI falls back to initial-letter avatars.

    logger.debug(
      `🏆 [LEADERBOARD] Top ${withSponsors.length} weight losers calculated`,
    );

    const payload = {
      success: true,
      data: withSponsors,
      topN,
      totalEligible: leaderboardData.length,
      calculatedAt: nowUtc(),
    };
    cache.set(cacheKey, payload, LEADERBOARD_CACHE_TTL_MS);
    res.setHeader("X-Cache", "MISS");
    res.status(200).json(payload);
  } catch (error) {
    logger.error("[LEADERBOARD] Error", { err: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to calculate leaderboard",
      error: error.message,
    });
  }
}
