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

/**
 * Global Weight Loss Leaderboard API
 * Calculates weight loss (today vs yesterday) for all active users
 * Returns top performers sorted by weight loss (descending)
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
/** PostgREST `.in()` limit — batch weight lookups for large active-user sets. */
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
    const supabase = getSupabaseClient();

    // Get topN parameter (default to 10, max 10)
    const topN = Math.min(parseInt(req.query.topN) || 10, 10);

    logger.debug(
      `🏆 [LEADERBOARD] Calculating global weight loss leaderboard (Top ${topN})...`,
    );

    // Step 1: Active users — omit ProfileImage (base64 blobs) to avoid OOM / 500 on large teams.
    const { data: activeUsersRaw, error: usersError } = await supabase
      .from("team_table")
      .select("UserId, UserName, Email, CoachId, Status, Role")
      .ilike("Status", "Active"); // Case-insensitive match for 'active' or 'Active'

    if (usersError) throw usersError;

    const activeUsers = filterPublicAggregateUsers(activeUsersRaw || []);

    if (!activeUsers || activeUsers.length === 0) {
      logger.debug("⚠️ [LEADERBOARD] No active users found");
      return res.status(200).json({
        success: true,
        data: [],
        topN,
        message: "No active users found",
      });
    }

    logger.debug(`✅ [LEADERBOARD] Found ${activeUsers.length} active users`);

    // Step 2: Sponsor + Ideal-Weight Coach (ADR-0007)
    const sponsorByUser = await resolveSponsorAndIdealCoachForMembers(
      activeUsers.map((u) => ({ userId: u.UserId, coachId: u.CoachId })),
    );
    activeUsers.forEach((u) => {
      const resolved = sponsorByUser.get(String(u.UserId));
      u.CoachName = resolved?.sponsorName || null;
      u.SponsorName = resolved?.sponsorName || null;
      u.IdealCoachId = resolved?.idealCoachId || null;
      u.IdealCoachName = resolved?.idealCoachName || null;
    });

    // Step 3: Calendar today/yesterday in platform timezone
    const todayYmd = todayInTimezone(IANA_IST);
    const yesterdayYmd = shiftDateYmd(todayYmd, -1, IANA_IST);

    logger.debug(`📅 [LEADERBOARD] Today: ${todayYmd}, Yesterday: ${yesterdayYmd}`);

    // Step 4: Fetch weight records via UTC-aware repository helpers
    const activeUserIds = activeUsers.map((u) => u.UserId);

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

    // Step 5: Calculate weight loss for eligible users
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
            coachName: user.CoachName || "No Sponsor",
            sponsorName: user.SponsorName || "No Sponsor",
            idealCoachId: user.IdealCoachId || null,
            idealCoachName: user.IdealCoachName || null,
            weightLoss: parseFloat(weightLoss.toFixed(2)),
            todayWeight: parseFloat(todayWeight.toFixed(2)),
            yesterdayWeight: parseFloat(yesterdayWeight.toFixed(2)),
            todayDate: todayRecord.CreatedAt,
            yesterdayDate: yesterdayRecord.CreatedAt,
          });
        }
      }
    }

    // Step 6: Sort by weight loss (descending - highest first)
    leaderboardData.sort((a, b) => b.weightLoss - a.weightLoss);

    // Step 7: Limit to topN and add rank with tie handling (dense ranking)
    // Users with same weight loss get same rank, next rank continues sequentially
    const topResults = [];
    let currentRank = 1;
    let previousWeightLoss = null;

    leaderboardData.slice(0, topN).forEach((user) => {
      // If weight loss is different from previous, increment rank by 1 only
      if (
        previousWeightLoss !== null &&
        user.weightLoss !== previousWeightLoss
      ) {
        currentRank++;
      }

      topResults.push({
        rank: currentRank, // Same rank for tied users, next distinct value gets next consecutive rank
        userId: user.userId,
        userName: user.userName,
        email: user.email,
        coachName: user.coachName,
        sponsorName: user.sponsorName,
        idealCoachId: user.idealCoachId,
        idealCoachName: user.idealCoachName,
        profileImage: null,
        weightLoss: user.weightLoss,
        todayWeight: user.todayWeight,
        yesterdayWeight: user.yesterdayWeight,
        comparison: "Today vs Yesterday",
      });

      previousWeightLoss = user.weightLoss;
    });

    // Step 8: Reverse order for display (show worst to best: Rank 10 → Rank 1)
    topResults.reverse();

    // Omit ProfileImage base64 — strip avatars keep initials fallback and cut ~5MB payloads.
    // profileImage remains in the response shape as null for backward compatibility.

    logger.debug(
      `🏆 [LEADERBOARD] Top ${topResults.length} weight losers calculated`,
    );
    console.table(
      topResults.map((u) => ({
        Rank: u.rank,
        Name: u.userName,
        Coach: u.coachName,
        "Weight Loss": `${u.weightLoss} kg`,
        Today: `${u.todayWeight} kg`,
        Yesterday: `${u.yesterdayWeight} kg`,
      })),
    );

    res.status(200).json({
      success: true,
      data: topResults,
      topN,
      totalEligible: leaderboardData.length,
      calculatedAt: nowUtc(),
    });
  } catch (error) {
    console.error("❌ [LEADERBOARD] Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to calculate leaderboard",
      error: error.message,
    });
  }
}
