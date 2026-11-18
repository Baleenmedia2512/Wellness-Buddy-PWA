import { getMysqlClient } from "../../../utils/mysqlClient.js";
import logger from '../../../shared/lib/logger.js';
import {
  nowUtc,
  todayInTimezone,
  shiftDateYmd,
  timestampToCalendarYmd,
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
import { cashfreeCheckoutMode } from '../../../features/payments/domain/premium.rules.js';
import { attachPremiumFlags } from '../../../features/payments/data/premium.repository.js';
import {
  WEIGHT_LEADERBOARD_WINDOW_DAYS,
  MAX_TODAY_VS_YESTERDAY_LOSS_KG,
  MAX_TEN_DAY_LOSS_KG,
  buildWindowWeightLossCandidates,
} from '../../../utils/weightLossLeaderboard.js';

/** Server-side TTL — hierarchy-scoped; cache key includes viewerUserId. */
const LEADERBOARD_CACHE_TTL_MS = 60 * 1000;


/**
 * Hierarchy-scoped Weight Loss Leaderboard API
 * Default: weight loss today vs yesterday for the viewer's allowed hierarchy.
 * Optional `days=10`: net loss over the last 10 IST days (earliest → latest weigh-in).
 * Missing / any value other than 10 keeps Today vs Yesterday so released apps are unchanged.
 *
 * Order of work (must NOT global-top then filter):
 *   logged-in user → allowed hierarchy (upline people + sibling peers only +
 *   own full downline) → Active + public-aggregate → weights → sort → Top N.
 *
 * Logic:
 * - Only includes active users (Status = 'Active')
 * - Today vs Yesterday: loss > 0 and ≤ 3.0 kg
 * - Last 10 days: net loss > 0 and ≤ 10.0 kg across different IST days
 * - Gains are never shown
 * - Returns: rank, profile (email for avatar), userName, coachName, weightLoss
 */

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
    // Missing or any value other than 10 stays on Today vs Yesterday (released apps).
    const windowDays = parseInt(req.query.days, 10) === WEIGHT_LEADERBOARD_WINDOW_DAYS
      ? WEIGHT_LEADERBOARD_WINDOW_DAYS
      : 1;
    const viewerUserId = await resolveLeaderboardViewerId({
      userId: req.query.userId,
      email: req.query.email,
    });

    if (!viewerUserId) {
      return res.status(200).json({
        success: true,
        data: [],
        topN,
        windowDays,
        message: "userId is required",
      });
    }

    const cacheKey = `lb:hierarchy:weight:v4:${viewerUserId}:${topN}:d${windowDays}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      res.setHeader("X-Cache", "HIT");
      return res.status(200).json(cached);
    }

    const db = getMysqlClient();
    const startedAt = Date.now();

    logger.debug(
      `🏆 [LEADERBOARD] Hierarchy weight loss Top ${topN} days=${windowDays} viewer=${viewerUserId}`,
    );

    // Indexed subtree: viewer + ancestors (people only) + own downline + sibling peers.
    // Does not scan team_table and does not load peer-descendants / other upline branches.
    const context = await loadReportingContextForCoach(db, viewerUserId);
    const contextMs = Date.now() - startedAt;
    const visibleUsers = collectVisibleHierarchyUsers(viewerUserId, context);

    // Only trust the hierarchy-scoped visible list.
    const visibleById = new Map(
      visibleUsers.map((u) => [Number(u.UserId), u]),
    );

    // Active + public-aggregate. Prod hides other developers from Top 10;
    // local NODE_ENV=development keeps them visible for QA. Self still allowed.
    const activeUsers = filterPublicAggregateUsers(
      [...visibleById.values()].filter((u) => isActiveTeamStatus(u.Status)),
      { viewerUserId, publicLeaderboard: true },
    );

    if (!activeUsers || activeUsers.length === 0) {
      logger.debug("⚠️ [LEADERBOARD] No allowed users in hierarchy");
      return res.status(200).json({
        success: true,
        data: [],
        topN,
        windowDays,
        message: "No allowed users in hierarchy",
      });
    }

    logger.debug(`✅ [LEADERBOARD] Found ${activeUsers.length} allowed users`);

    // Calendar window in platform timezone
    const todayYmd = todayInTimezone(IANA_IST);
    const rangeStartYmd = windowDays === 1
      ? shiftDateYmd(todayYmd, -1, IANA_IST)
      : shiftDateYmd(todayYmd, -(windowDays - 1), IANA_IST);
    const yesterdayYmd = shiftDateYmd(todayYmd, -1, IANA_IST);

    logger.debug(
      `📅 [LEADERBOARD] Window ${rangeStartYmd}..${todayYmd} (days=${windowDays})`,
    );

    // One range fetch; repository already parallel-chunks .in() lists.
    const activeUserIds = activeUsers.map((u) => u.UserId);
    const activeMap = new Map(activeUsers.map((u) => [Number(u.UserId), u]));
    const weightsStartedAt = Date.now();
    const rangeWeights = await activityReportRepo.fetchWeightRecords(
      activeUserIds,
      rangeStartYmd,
      todayYmd,
      IANA_IST,
    );
    const weightsMs = Date.now() - weightsStartedAt;

    const leaderboardData = [];
    const comparisonLabel = windowDays === 1 ? "Today vs Yesterday" : "Last 10 days";

    if (windowDays === 1) {
      // Create maps for quick lookup (get latest weight per user per IST day)
      const todayWeightMap = new Map();
      const yesterdayWeightMap = new Map();

      for (const record of rangeWeights || []) {
        const dayYmd = timestampToCalendarYmd(record.CreatedAt, IANA_IST);
        if (!dayYmd) continue;
        if (dayYmd === todayYmd) {
          if (!todayWeightMap.has(record.UserId)) {
            todayWeightMap.set(record.UserId, record);
          }
        } else if (dayYmd === yesterdayYmd) {
          if (!yesterdayWeightMap.has(record.UserId)) {
            yesterdayWeightMap.set(record.UserId, record);
          }
        }
      }

      logger.debug(
        `📊 [LEADERBOARD] Found ${todayWeightMap.size} users with today's weight, ${yesterdayWeightMap.size} with yesterday's weight (context=${contextMs}ms weights=${weightsMs}ms users=${activeUsers.length})`,
      );

      for (const user of activeUsers) {
        const todayRecord = todayWeightMap.get(user.UserId);
        const yesterdayRecord = yesterdayWeightMap.get(user.UserId);

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
              startWeight: parseFloat(yesterdayWeight.toFixed(2)),
              endWeight: parseFloat(todayWeight.toFixed(2)),
              todayDate: todayRecord.CreatedAt,
              yesterdayDate: yesterdayRecord.CreatedAt,
            });
          }
        }
      }
    } else {
      const toYmd = (ts) => timestampToCalendarYmd(ts, IANA_IST);
      const windowCandidates = buildWindowWeightLossCandidates(
        rangeWeights,
        toYmd,
        MAX_TEN_DAY_LOSS_KG,
      );
      const candidateById = new Map(
        windowCandidates.map((c) => [Number(c.userId), c]),
      );

      logger.debug(
        `📊 [LEADERBOARD] Found ${windowCandidates.length} users with 10-day net loss (context=${contextMs}ms weights=${weightsMs}ms users=${activeUsers.length})`,
      );

      for (const user of activeUsers) {
        const candidate = candidateById.get(Number(user.UserId));
        if (!candidate) continue;
        leaderboardData.push({
          userId: user.UserId,
          userName: user.UserName || "Unknown",
          email: user.Email || "",
          weightLoss: candidate.weightLoss,
          todayWeight: candidate.endWeight,
          yesterdayWeight: candidate.startWeight,
          startWeight: candidate.startWeight,
          endWeight: candidate.endWeight,
          todayDate: candidate.endDate,
          yesterdayDate: candidate.startDate,
        });
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
        startWeight: user.startWeight,
        endWeight: user.endWeight,
        comparison: comparisonLabel,
        windowDays,
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

    // Intentionally omit ProfileImage (base64) — 10 avatars were ~2–4 MB and
    // dominated TTFB. UI falls back to initial-letter avatars.

    logger.debug(
      `🏆 [LEADERBOARD] Top ${withSponsors.length} weight losers calculated total=${Date.now() - startedAt}ms`,
    );

    const withPremium = await attachPremiumFlags(withSponsors, {
      mode: cashfreeCheckoutMode(process.env.CASHFREE_ENV || 'sandbox'),
    });

    const payload = {
      success: true,
      data: withPremium,
      topN,
      windowDays,
      dateStart: rangeStartYmd,
      dateEnd: todayYmd,
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
