import { getSupabaseClient } from "../../../utils/supabaseClient.js";
import { convertISTToUserLocalTime } from "../../../utils/timezoneConverter.js";
import { isExemptedBeverageOnly, isExemptedFood } from "../../../utils/foodTypeDetection.js";
import {
  parseDateRange,
  calculateDisciplinePercentage,
  formatDateForMySQL,
  getDaysBetween,
} from "../../../utils/disciplineHelpers.js";
import logger from '../../../shared/lib/logger.js';

// ✅ HARDCODED BUFFER: Extra seconds added to every meal/activity window end time
// Ensures uploads made within the last minute of the window (e.g. 08:30:51) are counted on-time
// const WINDOW_BUFFER_SECONDS = 300;
const WINDOW_BUFFER_SECONDS = 59;

// Helper: Add buffer seconds to a time string "HH:MM:SS"
const addBufferToTime = (t) => {
  const [h, m, s] = t.split(':').map(Number);
  const totalSecs = h * 3600 + m * 60 + s + WINDOW_BUFFER_SECONDS;
  const nh = Math.floor(totalSecs / 3600) % 24;
  const nm = Math.floor((totalSecs % 3600) / 60);
  const ns = totalSecs % 60;
  return `${String(nh).padStart(2,'0')}:${String(nm).padStart(2,'0')}:${String(ns).padStart(2,'0')}`;
};

/**
 * Global Discipline Leaderboard API
 * Returns top performers based on discipline percentage
 *
 * Logic:
 * - Only includes active users (Status = 'Active')
 * - Calculates discipline based on last 10 days activity
 * - Considers: Weight logs, Education logs, Meal logs (Breakfast, Lunch, Dinner)
 * - Returns: rank, userName, coachName, profileImage, disciplinePercentage
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
      `🏆 [DISCIPLINE-LEADERBOARD] Calculating discipline leaderboard (Top ${topN})...`,
    );

    // Step 1: Get all active users
    const { data: activeUsers, error: usersError } = await supabase
      .from("team_table")
      .select("UserId, UserName, Email, CoachId, Status, ProfileImage")
      .ilike("Status", "Active");

    if (usersError) throw usersError;

    if (!activeUsers || activeUsers.length === 0) {
      logger.debug("⚠️ [DISCIPLINE-LEADERBOARD] No active users found");
      return res.status(200).json({
        success: true,
        data: [],
        topN,
        message: "No active users found",
      });
    }

    logger.debug(
      `✅ [DISCIPLINE-LEADERBOARD] Found ${activeUsers.length} active users`,
    );

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

    // Step 3: Calculate date range (last 10 days)
    const dates = parseDateRange("last10days");
    const startDateStr = formatDateForMySQL(dates.start);
    const endDateStr = formatDateForMySQL(dates.end);
    const daysInPeriod = getDaysBetween(dates.start, dates.end);

    logger.debug(
      `📅 [DISCIPLINE-LEADERBOARD] Period: ${startDateStr} to ${endDateStr} (${daysInPeriod} days)`,
    );

    // Step 4: Get time windows for meals
    const { data: timeWindows, error: twError } = await supabase
      .from("activity_time_windows_table")
      .select("*")
      .is("EffectiveToDate", null);

    if (twError) {
      console.warn(
        "⚠️ [DISCIPLINE-LEADERBOARD] Could not fetch time windows, using defaults",
      );
    }

    // Create time window map
    const timeWindowMap = {};
    (timeWindows || []).forEach((tw) => {
      timeWindowMap[tw.ActivityType] = {
        start: tw.WindowStartTime,
        end: tw.WindowEndTime,
      };
    });

    const mealWindows = {
      breakfast: timeWindowMap.breakfast || {
        start: "05:30:00",
        end: "08:30:00",
      },
      lunch: timeWindowMap.lunch || { start: "12:00:00", end: "16:00:00" },
      dinner: timeWindowMap.dinner || { start: "17:30:00", end: "20:30:00" },
    };

    // Step 5: Fetch all activity data in bulk
    const allUserIds = activeUsers.map((u) => u.UserId);

    const [weightData, educationData, foodData, stepData] = await Promise.all([
      // Weight records
      supabase
        .from("weight_records_table")
        .select("UserId, CreatedAt")
        .in("UserId", allUserIds)
        .gte("CreatedAt", startDateStr)
        .lte("CreatedAt", endDateStr + "T23:59:59")
        .or("IsDeleted.is.null,IsDeleted.eq.0"),

      // Education records
      supabase
        .from("education_logs_table")
        .select("UserId, CreatedAt")
        .in("UserId", allUserIds)
        .gte("CreatedAt", startDateStr)
        .lte("CreatedAt", endDateStr + "T23:59:59")
        .or("IsDeleted.is.null,IsDeleted.eq.0"),

      // Food/nutrition records (include AnalysisData to split meal vs water entries)
      supabase
        .from("food_nutrition_data_table")
        .select("UserID, CreatedAt, AnalysisData")
        .in("UserID", allUserIds.map(String))
        .gte("CreatedAt", startDateStr)
        .lte("CreatedAt", endDateStr + "T23:59:59")
        .or("IsDeleted.is.null,IsDeleted.eq.0"),

      // Step activity records (for Calories Burned discipline)
      supabase
        .from("daily_step_activity")
        .select("UserId, CreatedAt, Steps, CaloriesBurned")
        .in("UserId", allUserIds)
        .gte("CreatedAt", startDateStr)
        .lte("CreatedAt", endDateStr + "T23:59:59"),
    ]);

    // Separate water (beverage-only) from meal food records
    const waterFoodRecords = (foodData.data || []).filter(r => isExemptedBeverageOnly(r.AnalysisData));
    const mealFoodRecords = (foodData.data || []).filter(r => !isExemptedBeverageOnly(r.AnalysisData));

    // Fetch latest body weight per user from ANY date (no date restriction)
    // Uses most recent weight ever recorded — no need to upload weight today
    // Falls back to 2500ml ONLY if user has never logged a weight at all
    const DEFAULT_WATER_REQUIRED_ML = 2500;
    const { data: latestWeightRows } = await supabase
      .from('weight_records_table')
      .select('UserId, Weight, CreatedAt')
      .in('UserId', allUserIds)
      .or('IsDeleted.is.null,IsDeleted.eq.0,IsDeleted.eq.false')
      .order('CreatedAt', { ascending: false });
    const userBodyWeightMap = {};
    (latestWeightRows || []).forEach(row => {
      const uid = row.UserId;
      if (!(uid in userBodyWeightMap)) {
        const w = parseFloat(row.Weight);
        userBodyWeightMap[uid] = (!isNaN(w) && w > 0) ? w : null;
      }
    });

    // Helper to check if time is within window
    // ✅ TIMEZONE FIX: Database stores in IST, but check against user's local time
    // Note: Leaderboard doesn't know user's timezone, so fallback to direct time extraction
    const isTimeInWindow = (dateStr, windowStart, windowEnd) => {
      if (!dateStr) return false;
      // Extract time portion directly from timestamp string (HH:MM:SS)
      const timeMatch = String(dateStr).match(/(\d{2}:\d{2}:\d{2})/);
      if (!timeMatch) return false;
      const time = timeMatch[1];
      // ✅ BUFFER FIX: Add 59-second buffer to windowEnd so uploads at e.g. 08:30:51 are counted on-time
      return time >= windowStart && time <= addBufferToTime(windowEnd);
    };

    // Helper to get unique dates
    const getUniqueDates = (records, userId, userIdField = "UserId") => {
      const dates = new Set();
      (records || [])
        .filter(
          (r) => r[userIdField] === userId || r[userIdField] === String(userId),
        )
        .forEach((r) => {
          const date = new Date(r.CreatedAt);
          const dateStr = formatDateForMySQL(date);
          dates.add(dateStr);
        });
      return dates.size;
    };

    // Step 6: Calculate discipline for each user
    const leaderboardData = [];

    for (const user of activeUsers) {
      const userId = user.UserId;

      // Count unique days for each activity
      const weightDays = getUniqueDates(weightData.data, userId);
      const educationDays = getUniqueDates(educationData.data, userId);

      // Count on-time meals
      const userFoodRecords = mealFoodRecords.filter(
        (r) => r.UserID === userId || r.UserID === String(userId),
      );

      const breakfastDays = new Set();
      const lunchDays = new Set();
      const dinnerDays = new Set();

      userFoodRecords.forEach((record) => {
        const dateStr = formatDateForMySQL(new Date(record.CreatedAt));

        if (
          isTimeInWindow(
            record.CreatedAt,
            mealWindows.breakfast.start,
            mealWindows.breakfast.end,
          )
        ) {
          breakfastDays.add(dateStr);
        }
        if (
          isTimeInWindow(
            record.CreatedAt,
            mealWindows.lunch.start,
            mealWindows.lunch.end,
          )
        ) {
          lunchDays.add(dateStr);
        }
        if (
          isTimeInWindow(
            record.CreatedAt,
            mealWindows.dinner.start,
            mealWindows.dinner.end,
          )
        ) {
          dinnerDays.add(dateStr);
        }
      });

      // Water intake: quantity-based — sum volume_ml per date, achieved only if >= requiredWaterMl
      // requiredWaterMl = (latestBodyWeightKg / 20) * 1000, uses most recent weight from ANY date
      // Falls back to 2500ml ONLY if user has never logged a weight at all
      const userBodyWeight = userBodyWeightMap[userId] || null;
      const requiredWaterMl = userBodyWeight
        ? Math.round((userBodyWeight / 20) * 1000)
        : DEFAULT_WATER_REQUIRED_ML;
      const waterVolumeByDate = {};
      waterFoodRecords
        .filter((r) => r.UserID === userId || r.UserID === String(userId))
        .forEach((r) => {
          const dateStr = formatDateForMySQL(new Date(r.CreatedAt));
          if (!waterVolumeByDate[dateStr]) waterVolumeByDate[dateStr] = 0;
          try {
            const analysisData = typeof r.AnalysisData === 'string'
              ? JSON.parse(r.AnalysisData)
              : r.AnalysisData;
            (analysisData?.foods || []).forEach(food => {
              if (isExemptedFood(food.name)) {
                // Prefer volume_ml, fall back to weight_g (water 1g ≈ 1ml), then estimatedWeight
                const ml = parseFloat(food.volume_ml) || parseFloat(food.weight_g) || parseFloat(food.estimatedWeight) || 0;
                waterVolumeByDate[dateStr] += ml;
              }
            });
          } catch (e) { /* skip malformed */ }
        });
      const waterDays = new Set();
      Object.entries(waterVolumeByDate).forEach(([date, totalMl]) => {
        if (totalMl >= requiredWaterMl) waterDays.add(date);
      });

      // Calories burned: count unique dates where user logged steps/activity
      const caloriesBurnedDays = new Set();
      (stepData.data || [])
        .filter((r) => {
          const burned = Math.abs(parseFloat(r.CaloriesBurned) || 0);
          // Use Math.abs so that negative CaloriesBurned values (sensor deltas/corrections) are treated
          // as positive burns — a negative value means real activity was recorded, just stored inverted.
          return r.UserId === userId && ((r.Steps || 0) > 0 || burned > 0);
        })
        .forEach((r) => {
          caloriesBurnedDays.add(formatDateForMySQL(new Date(r.CreatedAt)));
        });

      // Calculate total on-time posts
      const onTimePosts =
        weightDays +
        educationDays +
        breakfastDays.size +
        lunchDays.size +
        dinnerDays.size +
        waterDays.size +
        caloriesBurnedDays.size;
      const expectedPosts = daysInPeriod * 7; // 7 activities per day
      const disciplinePercentage = calculateDisciplinePercentage(
        onTimePosts,
        expectedPosts,
      );

      leaderboardData.push({
        userId: user.UserId,
        userName: user.UserName || "Unknown",
        email: user.Email,
        coachName: user.CoachName || "No Coach",
        profileImage: user.ProfileImage || null,
        disciplinePercentage,
        onTimePosts,
        expectedPosts,
        details: {
          weight: weightDays,
          education: educationDays,
          breakfast: breakfastDays.size,
          lunch: lunchDays.size,
          dinner: dinnerDays.size,
          water: waterDays.size,
          caloriesBurned: caloriesBurnedDays.size,
        },
      });
    }

    // Step 7: Sort by discipline percentage (descending) and take top N
    leaderboardData.sort(
      (a, b) => b.disciplinePercentage - a.disciplinePercentage,
    );

    // Step 8: Assign ranks (handle ties)
    const topResults = [];
    let currentRank = 1;
    let previousPercentage = null;

    leaderboardData.slice(0, topN).forEach((user) => {
      // If percentage is different from previous, increment rank
      if (
        previousPercentage !== null &&
        user.disciplinePercentage !== previousPercentage
      ) {
        currentRank++;
      }

      topResults.push({
        rank: currentRank,
        userId: user.userId,
        userName: user.userName,
        email: user.email,
        coachName: user.coachName,
        profileImage: user.profileImage,
        disciplinePercentage: user.disciplinePercentage,
        onTimePosts: user.onTimePosts,
        expectedPosts: user.expectedPosts,
        details: user.details,
      });

      previousPercentage = user.disciplinePercentage;
    });

    logger.debug(
      `🏆 [DISCIPLINE-LEADERBOARD] Top ${topResults.length} discipline champions calculated`,
    );
    console.table(
      topResults.map((u) => ({
        Rank: u.rank,
        Name: u.userName,
        Discipline: `${u.disciplinePercentage}%`,
        OnTime: u.onTimePosts,
        Expected: u.expectedPosts,
      })),
    );

    return res.status(200).json({
      success: true,
      data: topResults,
      topN,
      totalEligible: leaderboardData.length,
      period: {
        start: startDateStr,
        end: endDateStr,
        days: daysInPeriod,
      },
    });
  } catch (error) {
    console.error("❌ [DISCIPLINE-LEADERBOARD] Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to calculate discipline leaderboard",
      error: error.message,
    });
  }
}
