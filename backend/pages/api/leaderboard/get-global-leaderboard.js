import { getSupabaseClient } from "../../../utils/supabaseClient.js";
import logger from '../../../shared/lib/logger.js';

/**
 * Global Weight Loss Leaderboard API
 * Calculates weight loss (today vs yesterday) for all active users
 * Returns top performers sorted by weight loss (descending)
 *
 * Logic:
 * - Only includes active users (Status = 'Active')
 * - Only includes users with weight loss > 0 (reduced weight)
 * - Compares most recent weight entry from today vs yesterday
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
    const supabase = getSupabaseClient();

    // Get topN parameter (default to 10, max 10)
    const topN = Math.min(parseInt(req.query.topN) || 10, 10);

    logger.debug(
      `🏆 [LEADERBOARD] Calculating global weight loss leaderboard (Top ${topN})...`,
    );

    // Step 1: Get all active users
    const { data: activeUsers, error: usersError } = await supabase
      .from("team_table")
      .select("UserId, UserName, Email, CoachId, Status, ProfileImage")
      .ilike("Status", "Active"); // Case-insensitive match for 'active' or 'Active'

    if (usersError) throw usersError;

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

    // Step 2: Get coach names for CoachId
    const allCoachIds = new Set();
    activeUsers.forEach((u) => {
      if (u.CoachId) allCoachIds.add(u.CoachId);
    });

    const coachNameMap = {};
    if (allCoachIds.size > 0) {
      const { data: coaches } = await supabase
        .from("team_table")
        .select("UserId, UserName")
        .in("UserId", Array.from(allCoachIds));

      if (coaches) {
        coaches.forEach((c) => {
          coachNameMap[c.UserId] = c.UserName;
        });
      }
    }

    // Add coach names to users
    activeUsers.forEach((u) => {
      u.CoachName = u.CoachId ? coachNameMap[u.CoachId] : null;
    });

    // Step 3: Calculate date ranges for today and yesterday in IST (UTC+5:30)
    // ✅ FIX: Server runs on UTC (Vercel). DB stores timestamps as IST plain strings.
    // Without this offset, before 5:30 AM IST the API would use the wrong UTC date,
    // causing the leaderboard to show "yesterday vs day-before-yesterday" instead of
    // "today vs yesterday". Shifting now to IST first ensures correct date at any hour.
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // IST = UTC+5:30
    const now = new Date(new Date().getTime() + IST_OFFSET_MS); // current IST moment

    const todayStart = new Date(now);
    todayStart.setUTCHours(0, 0, 0, 0);

    const todayEnd = new Date(now);
    todayEnd.setUTCHours(23, 59, 59, 999);

    const yesterdayStart = new Date(now);
    yesterdayStart.setUTCDate(yesterdayStart.getUTCDate() - 1);
    yesterdayStart.setUTCHours(0, 0, 0, 0);

    const yesterdayEnd = new Date(now);
    yesterdayEnd.setUTCDate(yesterdayEnd.getUTCDate() - 1);
    yesterdayEnd.setUTCHours(23, 59, 59, 999);

    // Format as IST plain strings for DB query (DB stores "YYYY-MM-DD HH:MM:SS" in IST, no timezone)
    const toISTString = (d) => d.toISOString().replace("T", " ").replace("Z", "").substring(0, 23);
    const todayStartStr = toISTString(todayStart);
    const todayEndStr = toISTString(todayEnd);
    const yesterdayStartStr = toISTString(yesterdayStart);
    const yesterdayEndStr = toISTString(yesterdayEnd);

    logger.debug(`📅 [LEADERBOARD] Today: ${todayStartStr} to ${todayEndStr}`);
    logger.debug(
      `📅 [LEADERBOARD] Yesterday: ${yesterdayStartStr} to ${yesterdayEndStr}`,
    );

    // Step 4: OPTIMIZED - Fetch all weight records in 2 batch queries instead of per-user
    const activeUserIds = activeUsers.map((u) => u.UserId);

    // Fetch all today's weights for active users
    const { data: todayWeights, error: todayError } = await supabase
      .from("weight_records_table")
      .select("UserId, Weight, CreatedAt")
      .in("UserId", activeUserIds)
      .gte("CreatedAt", todayStartStr)
      .lte("CreatedAt", todayEndStr)
      .or("IsDeleted.is.null,IsDeleted.eq.0")
      .order("CreatedAt", { ascending: false });

    if (todayError) throw todayError;

    // Fetch all yesterday's weights for active users
    const { data: yesterdayWeights, error: yesterdayError } = await supabase
      .from("weight_records_table")
      .select("UserId, Weight, CreatedAt")
      .in("UserId", activeUserIds)
      .gte("CreatedAt", yesterdayStartStr)
      .lte("CreatedAt", yesterdayEndStr)
      .or("IsDeleted.is.null,IsDeleted.eq.0")
      .order("CreatedAt", { ascending: false });

    if (yesterdayError) throw yesterdayError;

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

        // Only include users who have lost weight (weightLoss > 0)
        if (weightLoss > 0) {
          leaderboardData.push({
            userId: user.UserId,
            userName: user.UserName || "Unknown",
            email: user.Email || "",
            coachName: user.CoachName || "No Coach",
            profileImage: user.ProfileImage || null,
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
        profileImage: user.profileImage,
        weightLoss: user.weightLoss,
        todayWeight: user.todayWeight,
        yesterdayWeight: user.yesterdayWeight,
        comparison: "Today vs Yesterday",
      });

      previousWeightLoss = user.weightLoss;
    });

    // Step 7: Reverse order for display (show worst to best: Rank 10 → Rank 1)
    topResults.reverse();

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
      calculatedAt: new Date().toISOString(),
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
