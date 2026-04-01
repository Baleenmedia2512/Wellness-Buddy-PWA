import { getSupabaseClient } from "../../../utils/supabaseClient.js";
import { convertISTToUserLocalTime } from "../../../utils/timezoneConverter.js";
import { isExemptedBeverageOnly, isExemptedFood } from "../../../utils/foodTypeDetection.js";
import {
  parseDateRange,
  calculateExpectedPosts,
  calculateDisciplinePercentage,
  getDaysBetween,
  formatDateForMySQL,
} from "../../../utils/disciplineHelpers.js";

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
 * API: Get ALL Members Discipline Report (Admin Only)
 * Returns discipline percentages for ALL users in the system
 * Uses Supabase REST API
 */
export default async function handler(req, res) {
  // Prevent browser/service worker caching of dynamic data
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate",
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");

  // Handle CORS
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, cache-control, pragma",
    );
    res.status(200).end();
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({ success: false, message: "Method not allowed" });
    return;
  }

  try {
    const { userId, dateRange, startDate, endDate, userTimezoneOffset } = req.query;

    // Validation
    if (!userId) {
      res.status(400).json({ success: false, message: "User ID required" });
      return;
    }

    if (!dateRange) {
      res.status(400).json({ success: false, message: "Date range required" });
      return;
    }

    const supabase = getSupabaseClient();
    const userIdInt = parseInt(userId);

    // Step 1: Verify user exists (removed role restriction - all coaches can access)
    const { data: currentUser, error: userError } = await supabase
      .from("team_table")
      .select("Role")
      .eq("UserId", userIdInt)
      .maybeSingle();

    if (userError || !currentUser) {
      console.error("User not found:", userError);
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    // All coaches can access - no role restriction

    // Parse date range
    const dates = parseDateRange(
      dateRange,
      dateRange === "custom" ? startDate : null,
      dateRange === "custom" ? endDate : null,
    );

    // Validate custom date range
    if (dateRange === "custom") {
      if (!startDate || !endDate) {
        res.status(400).json({
          success: false,
          message: "Custom date range requires both startDate and endDate",
        });
        return;
      }
      if (dates.start > dates.end) {
        res.status(400).json({
          success: false,
          message: "Start date must be before or equal to end date",
        });
        return;
      }
    }

    // Step 2: Get ALL active members in the system
    const { data: allMembers, error: membersError } = await supabase
      .from("team_table")
      .select(
        "UserId, UserName, Email, Role, EntryDateTime, CoachId, TeamId",
      )
      .eq("Status", "Active")
      .order("UserName", { ascending: true });

    if (membersError) {
      console.error("Error fetching members:", membersError);
      res
        .status(500)
        .json({ success: false, message: "Failed to fetch members" });
      return;
    }

    if (!allMembers || allMembers.length === 0) {
      res.status(200).json({
        success: true,
        source: "realtime",
        lastUpdated: new Date().toISOString(),
        dateRange,
        // ✅ Use local date formatting to prevent timezone shifting
        startDate: formatDateForMySQL(dates.start),
        endDate: formatDateForMySQL(dates.end),
        allMembers: [],
        totalMembers: 0,
        totalCoaches: 0,
        averageDiscipline: 0,
      });
      return;
    }

    // Derive CoCoachId from coach_teams_table (source of truth)
    const memberCoachIds = [...new Set(allMembers.map(m => m.CoachId).filter(Boolean))];
    const coCoachDeriveMap = {};
    if (memberCoachIds.length > 0) {
      const { data: coCoachTeamData } = await supabase
        .from('coach_teams_table')
        .select('CoachId, CoCoachId')
        .in('CoachId', memberCoachIds)
        .eq('Status', 'active');
      if (coCoachTeamData) {
        coCoachTeamData.forEach(t => {
          if (t.CoCoachId) coCoachDeriveMap[t.CoachId] = t.CoCoachId;
        });
      }
    }
    allMembers.forEach(m => {
      m.CoCoachId = m.CoachId ? (coCoachDeriveMap[m.CoachId] || null) : null;
    });

    // Step 3: Get coach names for CoachId and CoCoachId
    const allCoachIds = new Set();
    allMembers.forEach((m) => {
      if (m.CoachId) allCoachIds.add(m.CoachId);
      if (m.CoCoachId) allCoachIds.add(m.CoCoachId);
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

    // Add coach names to members
    allMembers.forEach((m) => {
      m.CoachName = m.CoachId ? coachNameMap[m.CoachId] : null;
      m.CoCoachName = m.CoCoachId ? coachNameMap[m.CoCoachId] : null;
    });

    // Step 4: Get time windows
    const { data: timeWindows, error: twError } = await supabase
      .from("activity_time_windows_table")
      .select("*")
      .is("EffectiveToDate", null);

    if (twError) {
      console.error("Error fetching time windows:", twError);
    }

    // Create time window map
    const timeWindowMap = {};
    if (timeWindows) {
      timeWindows.forEach((tw) => {
        timeWindowMap[tw.ActivityType] = {
          start: tw.WindowStartTime,
          end: tw.WindowEndTime,
        };
      });
    }

    // Meal windows for discipline calculation
    const mealWindows = {
      breakfast: timeWindowMap.breakfast || {
        start: "05:30:00",
        end: "08:30:00",
      },
      lunch: timeWindowMap.lunch || { start: "12:00:00", end: "16:00:00" },
      dinner: timeWindowMap.dinner || { start: "17:30:00", end: "20:30:00" },
    };

    // Step 5: Get activity data for all members
    const memberIds = allMembers.map((m) => m.UserId);
    const startDateStr = formatDateForMySQL(dates.start);
    const endDateStr = formatDateForMySQL(dates.end);

    // Fetch all required data in bulk for efficiency
    const [weightData, educationData, foodData, stepData, watchBurnData] = await Promise.all([
      // Weight records
      supabase
        .from("weight_records_table")
        .select("UserId, CreatedAt")
        .in("UserId", memberIds)
        .gte("CreatedAt", startDateStr)
        .lte("CreatedAt", endDateStr + "T23:59:59")
        .or('IsDeleted.is.null,IsDeleted.eq.0'),

      // Education records
      supabase
        .from("education_logs_table")
        .select("UserId, CreatedAt")
        .in("UserId", memberIds)
        .gte("CreatedAt", startDateStr)
        .lte("CreatedAt", endDateStr + "T23:59:59")
        .or('IsDeleted.is.null,IsDeleted.eq.0'),

      // Food/nutrition records (include AnalysisData to filter out beverage-only entries, TotalCalories for calorie discipline)
      supabase
        .from("food_nutrition_data_table")
        .select("UserID, CreatedAt, AnalysisData, TotalCalories")
        .in("UserID", memberIds.map(String))
        .gte("CreatedAt", startDateStr)
        .lte("CreatedAt", endDateStr + "T23:59:59")
        .or('IsDeleted.is.null,IsDeleted.eq.0'),

      // Step activity records (for Calories Burned discipline)
      supabase
        .from("daily_step_activity")
        .select("UserId, CreatedAt, Steps, CaloriesBurned")
        .in("UserId", memberIds)
        .gte("CreatedAt", startDateStr)
        .lte("CreatedAt", endDateStr + "T23:59:59"),

      // Watch-burned calories from education_logs_table (Topic: "Calories Burned: NNN kcal")
      supabase
        .from("education_logs_table")
        .select("UserId, CreatedAt, Topic")
        .in("UserId", memberIds)
        .ilike("Topic", "Calories Burned:%")
        .or('"IsDeleted".is.null,"IsDeleted".eq.0')
        .gte("CreatedAt", startDateStr)
        .lte("CreatedAt", endDateStr + " 23:59:59"),
    ]);

    // Separate water records (beverage-only) BEFORE filtering food data
    const waterFoodData = { data: (foodData.data || []).filter(r => isExemptedBeverageOnly(r.AnalysisData)) };

    // Filter out records that contain ONLY exempted beverages (water, coffee, tea, afresh)
    if (foodData.data) {
      foodData.data = foodData.data.filter(r => !isExemptedBeverageOnly(r.AnalysisData));
    }

    // Fetch latest body weight AND BMR for each member from ANY date (no date restriction)
    // Uses most recent weight ever recorded — no need to upload weight today
    // Falls back to 2500ml ONLY if user has never logged a weight at all
    const DEFAULT_WATER_REQUIRED_ML = 2500;
    const { data: latestWeightRows } = await supabase
      .from('weight_records_table')
      .select('UserId, Weight, Bmr, CreatedAt')
      .in('UserId', memberIds)
      .or('IsDeleted.is.null,IsDeleted.eq.0,IsDeleted.eq.false')
      .order('CreatedAt', { ascending: false });
    const userBodyWeightMap = {};
    const userBmrMap = {}; // BMR (calorie target) per userId
    (latestWeightRows || []).forEach(row => {
      const uid = row.UserId;
      if (!(uid in userBodyWeightMap)) {
        const w = parseFloat(row.Weight);
        userBodyWeightMap[uid] = (!isNaN(w) && w > 0) ? w : null;
      }
      if (!(uid in userBmrMap)) {
        const b = parseFloat(row.Bmr);
        userBmrMap[uid] = (!isNaN(b) && b > 0) ? b : null;
      }
    });

    if (weightData.error) {
      console.error("Error fetching weight data:", weightData.error);
    }
    if (educationData.error) {
      console.error("Error fetching education data:", educationData.error);
    }
    if (foodData.error) {
      console.error("Error fetching food data:", foodData.error);
    }
    if (stepData.error) {
      console.error("Error fetching step activity data:", stepData.error);
    }

    // Step 6: Calculate discipline for each member
    const disciplineData = {};
    const daysInPeriod = getDaysBetween(dates.start, dates.end);
    const expectedPostsPerActivity = daysInPeriod;

    // Parse timezone offset (sent from frontend as minutes)
    const tzOffset = userTimezoneOffset ? parseInt(userTimezoneOffset) : null;

    // Helper functions
    // ✅ TIMEZONE FIX: Convert IST to user's local time before checking
    const isTimeInWindow = (dateStr, windowStart, windowEnd) => {
      if (!dateStr) return false;
      
      let time;
      if (tzOffset !== null) {
        // Convert IST to user's local time
        time = convertISTToUserLocalTime(dateStr, tzOffset);
      } else {
        // Fallback: Extract time directly from timestamp string
        const timeMatch = String(dateStr).match(/(\d{2}:\d{2}:\d{2})/);
        if (!timeMatch) return false;
        time = timeMatch[1];
      }
      
      if (!time) return false;
      // ✅ BUFFER FIX: Add 59-second buffer to windowEnd so uploads at e.g. 08:30:51 are counted on-time
      return time >= windowStart && time <= addBufferToTime(windowEnd);
    };

    const getUniqueDates = (records, userId, userIdField = "UserId") => {
      const dates = new Set();
      if (records && Array.isArray(records)) {
        records.forEach((r) => {
          if (r[userIdField] == userId) {
            // ✅ Use local date formatting to prevent timezone shifting
            const date = new Date(r.CreatedAt);
            const dateStr =
              date.getFullYear() +
              "-" +
              String(date.getMonth() + 1).padStart(2, "0") +
              "-" +
              String(date.getDate()).padStart(2, "0");
            dates.add(dateStr);
          }
        });
      }
      return dates;
    };

    const getUniqueOnTimeDates = (
      records,
      userId,
      windowStart,
      windowEnd,
      userIdField = "UserId",
    ) => {
      const dates = new Set();
      if (records && Array.isArray(records)) {
        records.forEach((r) => {
          if (
            r[userIdField] == userId &&
            isTimeInWindow(r.CreatedAt, windowStart, windowEnd)
          ) {
            // ✅ Use local date formatting to prevent timezone shifting
            const date = new Date(r.CreatedAt);
            const dateStr =
              date.getFullYear() +
              "-" +
              String(date.getMonth() + 1).padStart(2, "0") +
              "-" +
              String(date.getDate()).padStart(2, "0");
            dates.add(dateStr);
          }
        });
      }
      return dates;
    };

    memberIds.forEach((userId) => {
      disciplineData[userId] = {
        userId,
        weight: {
          dates: new Set(),
          onTimeDates: new Set(),
          totalPosts: 0,
          onTimePosts: 0,
        },
        education: {
          dates: new Set(),
          onTimeDates: new Set(),
          totalPosts: 0,
          onTimePosts: 0,
        },
        breakfast: {
          dates: new Set(),
          onTimeDates: new Set(),
          totalPosts: 0,
          onTimePosts: 0,
        },
        lunch: {
          dates: new Set(),
          onTimeDates: new Set(),
          totalPosts: 0,
          onTimePosts: 0,
        },
        dinner: {
          dates: new Set(),
          onTimeDates: new Set(),
          totalPosts: 0,
          onTimePosts: 0,
        },
        water: {
          totalPosts: 0,
          onTimePosts: 0,
        },
        caloriesBurned: {
          totalPosts: 0,
          onTimePosts: 0,
        },
      };

      // Weight
      const weightWindow = timeWindowMap.weight || {
        start: "03:00:00",
        end: "06:30:00",
      };
      disciplineData[userId].weight.dates = getUniqueDates(
        weightData.data || [],
        userId,
      );
      disciplineData[userId].weight.onTimeDates = getUniqueOnTimeDates(
        weightData.data || [],
        userId,
        weightWindow.start,
        weightWindow.end,
      );
      disciplineData[userId].weight.totalPosts =
        disciplineData[userId].weight.dates.size;
      disciplineData[userId].weight.onTimePosts =
        disciplineData[userId].weight.onTimeDates.size;

      // Education
      const educationWindow = timeWindowMap.education || {
        start: "05:00:00",
        end: "23:00:00",
      };
      disciplineData[userId].education.dates = getUniqueDates(
        educationData.data || [],
        userId,
      );
      disciplineData[userId].education.onTimeDates = getUniqueOnTimeDates(
        educationData.data || [],
        userId,
        educationWindow.start,
        educationWindow.end,
      );
      disciplineData[userId].education.totalPosts =
        disciplineData[userId].education.dates.size;
      disciplineData[userId].education.onTimePosts =
        disciplineData[userId].education.onTimeDates.size;

      // Meals - filter food data by time windows
      const getMealData = (mealWindow) => {
        const dates = new Set();
        const onTimeDates = new Set();

        if (foodData.data && Array.isArray(foodData.data)) {
          foodData.data.forEach((r) => {
            if (r.UserID == userId) {
              // ✅ TIMEZONE FIX: Convert IST to user's local time
              let time;
              if (tzOffset !== null) {
                time = convertISTToUserLocalTime(r.CreatedAt, tzOffset);
              } else {
                const timeMatch = String(r.CreatedAt).match(/(\d{2}:\d{2}:\d{2})/);
                if (!timeMatch) return;
                time = timeMatch[1];
              }
              
              if (!time) return;

              // ✅ BUFFER FIX: Add 59-second buffer to mealWindow.end
              if (time >= mealWindow.start && time <= addBufferToTime(mealWindow.end)) {
                // ✅ Use local date formatting to prevent timezone shifting
                const date = new Date(r.CreatedAt);
                const dateStr =
                  date.getFullYear() +
                  "-" +
                  String(date.getMonth() + 1).padStart(2, "0") +
                  "-" +
                  String(date.getDate()).padStart(2, "0");
                dates.add(dateStr);
                onTimeDates.add(dateStr);
              }
            }
          });
        }

        return { dates, onTimeDates };
      };

      const breakfastData = getMealData(mealWindows.breakfast);
      const lunchData = getMealData(mealWindows.lunch);
      const dinnerData = getMealData(mealWindows.dinner);

      disciplineData[userId].breakfast.dates = breakfastData.dates;
      disciplineData[userId].breakfast.onTimeDates = breakfastData.onTimeDates;
      disciplineData[userId].breakfast.totalPosts = breakfastData.dates.size;
      disciplineData[userId].breakfast.onTimePosts =
        breakfastData.onTimeDates.size;

      disciplineData[userId].lunch.dates = lunchData.dates;
      disciplineData[userId].lunch.onTimeDates = lunchData.onTimeDates;
      disciplineData[userId].lunch.totalPosts = lunchData.dates.size;
      disciplineData[userId].lunch.onTimePosts = lunchData.onTimeDates.size;

      disciplineData[userId].dinner.dates = dinnerData.dates;
      disciplineData[userId].dinner.onTimeDates = dinnerData.onTimeDates;
      disciplineData[userId].dinner.totalPosts = dinnerData.dates.size;
      disciplineData[userId].dinner.onTimePosts = dinnerData.onTimeDates.size;

      // Water intake: quantity-based — sum volume_ml per date, achieved only if >= requiredWaterMl
      // requiredWaterMl = (latestBodyWeightKg / 20) * 1000, uses most recent weight from ANY date
      // Falls back to 2500ml ONLY if user has never logged a weight at all
      const userBodyWeight = userBodyWeightMap[userId] || null;
      const requiredWaterMl = userBodyWeight
        ? Math.round((userBodyWeight / 20) * 1000)
        : DEFAULT_WATER_REQUIRED_ML;
      const waterVolumeByDate = {};
      (waterFoodData.data || []).forEach((r) => {
        if (r.UserID == userId) {
          const date = new Date(r.CreatedAt);
          const dateStr =
            date.getFullYear() +
            "-" +
            String(date.getMonth() + 1).padStart(2, "0") +
            "-" +
            String(date.getDate()).padStart(2, "0");
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
        }
      });
      const waterDates = new Set();
      Object.entries(waterVolumeByDate).forEach(([date, totalMl]) => {
        if (totalMl >= requiredWaterMl) waterDates.add(date);
      });
      disciplineData[userId].water.totalPosts = waterDates.size;
      disciplineData[userId].water.onTimePosts = waterDates.size;

      // Calories discipline:
      // User MUST have a BMR target set to earn calorie discipline points.
      // Net calories = calories consumed (meals) - calories burned (steps/activity)
      // A day is disciplined ONLY IF net calories <= BMR target.
      // If no BMR is set, calorie discipline = 0 (user must set BMR in their profile).
      const userBmrTarget = userBmrMap[userId] || null;
      const caloriesBurnedDates = new Set();

      if (userBmrTarget && userBmrTarget > 0) {
        // --- BMR-target-aware path ---
        // Sum calories consumed per date from non-beverage nutrition records (foodData already filtered)
        const caloriesConsumedByDate = {};
        (foodData.data || []).forEach((r) => {
          if (r.UserID == userId) {
            const date = new Date(r.CreatedAt);
            const dateStr =
              date.getFullYear() +
              "-" +
              String(date.getMonth() + 1).padStart(2, "0") +
              "-" +
              String(date.getDate()).padStart(2, "0");
            const cal = parseFloat(r.TotalCalories) || 0;
            caloriesConsumedByDate[dateStr] = (caloriesConsumedByDate[dateStr] || 0) + cal;
          }
        });

        // Sum calories burned per date (keep highest cumulative value per day)
        const caloriesBurnedByDate = {};
        (stepData.data || []).forEach((r) => {
          if (r.UserId == userId && ((r.Steps || 0) > 0 || (r.CaloriesBurned || 0) > 0)) {
            const date = new Date(r.CreatedAt);
            const dateStr =
              date.getFullYear() +
              "-" +
              String(date.getMonth() + 1).padStart(2, "0") +
              "-" +
              String(date.getDate()).padStart(2, "0");
            const burned = parseFloat(r.CaloriesBurned) || 0;
            if ((caloriesBurnedByDate[dateStr] || 0) < burned) {
              caloriesBurnedByDate[dateStr] = burned;
            }
          }
        });

        // Also add watch-burned calories from education_logs_table
        // Topic format: "Calories Burned: 2000 kcal"
        (watchBurnData.data || []).forEach((r) => {
          if (r.UserId == userId) {
            const match = (r.Topic || '').match(/(\d+(?:\.\d+)?)\s*kcal/i);
            if (!match) return;
            const kcal = parseFloat(match[1]) || 0;
            if (kcal <= 0) return;
            const date = new Date(r.CreatedAt);
            const dateStr =
              date.getFullYear() +
              "-" +
              String(date.getMonth() + 1).padStart(2, "0") +
              "-" +
              String(date.getDate()).padStart(2, "0");
            caloriesBurnedByDate[dateStr] = (caloriesBurnedByDate[dateStr] || 0) + kcal;
          }
        });

        // A day is disciplined if net calories (consumed - burned) <= BMR target
        const allActivityDates = new Set([
          ...Object.keys(caloriesConsumedByDate),
          ...Object.keys(caloriesBurnedByDate),
        ]);
        allActivityDates.forEach((dateStr) => {
          const consumed = caloriesConsumedByDate[dateStr] || 0;
          const burned   = caloriesBurnedByDate[dateStr]   || 0;
          const netCalories = consumed - burned;
          if (netCalories <= userBmrTarget) {
            caloriesBurnedDates.add(dateStr);
          }
        });
      }
      // No BMR set → caloriesBurnedDates stays empty → 0 discipline days for this category

      disciplineData[userId].caloriesBurned.totalPosts = caloriesBurnedDates.size;
      disciplineData[userId].caloriesBurned.onTimePosts = caloriesBurnedDates.size;
    });

    // Step 7: Format response data
    const formattedMembers = allMembers
      .map((member) => {
        const discipline = disciplineData[member.UserId];

        if (!discipline) {
          return null;
        }

        const activities = {
          weight: {
            percentage: calculateDisciplinePercentage(
              discipline.weight.onTimePosts,
              expectedPostsPerActivity,
            ),
            onTimePosts: discipline.weight.onTimePosts,
            expectedPosts: expectedPostsPerActivity,
            totalPosts: discipline.weight.totalPosts,
          },
          education: {
            percentage: calculateDisciplinePercentage(
              discipline.education.onTimePosts,
              expectedPostsPerActivity,
            ),
            onTimePosts: discipline.education.onTimePosts,
            expectedPosts: expectedPostsPerActivity,
            totalPosts: discipline.education.totalPosts,
          },
          breakfast: {
            percentage: calculateDisciplinePercentage(
              discipline.breakfast.onTimePosts,
              expectedPostsPerActivity,
            ),
            onTimePosts: discipline.breakfast.onTimePosts,
            expectedPosts: expectedPostsPerActivity,
            totalPosts: discipline.breakfast.totalPosts,
          },
          lunch: {
            percentage: calculateDisciplinePercentage(
              discipline.lunch.onTimePosts,
              expectedPostsPerActivity,
            ),
            onTimePosts: discipline.lunch.onTimePosts,
            expectedPosts: expectedPostsPerActivity,
            totalPosts: discipline.lunch.totalPosts,
          },
          dinner: {
            percentage: calculateDisciplinePercentage(
              discipline.dinner.onTimePosts,
              expectedPostsPerActivity,
            ),
            onTimePosts: discipline.dinner.onTimePosts,
            expectedPosts: expectedPostsPerActivity,
            totalPosts: discipline.dinner.totalPosts,
          },
          water: {
            percentage: calculateDisciplinePercentage(
              discipline.water.onTimePosts,
              expectedPostsPerActivity,
            ),
            onTimePosts: discipline.water.onTimePosts,
            expectedPosts: expectedPostsPerActivity,
            totalPosts: discipline.water.totalPosts,
          },
          caloriesBurned: {
            percentage: calculateDisciplinePercentage(
              discipline.caloriesBurned.onTimePosts,
              expectedPostsPerActivity,
            ),
            onTimePosts: discipline.caloriesBurned.onTimePosts,
            expectedPosts: expectedPostsPerActivity,
            totalPosts: discipline.caloriesBurned.totalPosts,
          },
        };

        // Calculate overall period discipline
        const totalOnTimePosts =
          discipline.weight.onTimePosts +
          discipline.education.onTimePosts +
          discipline.breakfast.onTimePosts +
          discipline.lunch.onTimePosts +
          discipline.dinner.onTimePosts +
          discipline.water.onTimePosts +
          discipline.caloriesBurned.onTimePosts;

        const totalExpectedPosts = expectedPostsPerActivity * 7;
        const periodDisciplinePercentage = calculateDisciplinePercentage(
          totalOnTimePosts,
          totalExpectedPosts,
        );

        return {
          userId: member.UserId,
          userName: member.UserName,
          email: member.Email,
          role: member.Role,
          teamId: member.TeamId,
          coachId: member.CoachId,
          coCoachId: member.CoCoachId,
          coachName: member.CoachName,
          coCoachName: member.CoCoachName,
          profileImage: null,
          joinedDate: member.EntryDateTime,
          isLoggedInUser: member.UserId === userIdInt,
          periodDiscipline: {
            percentage: periodDisciplinePercentage,
            expectedPosts: totalExpectedPosts,
            onTimePosts: totalOnTimePosts,
            daysInPeriod: daysInPeriod,
          },
          activities,
        };
      })
      .filter((m) => m !== null);

    // Step 8: Calculate summary statistics
    const avgDiscipline =
      formattedMembers.length > 0
        ? formattedMembers.reduce(
            (sum, m) => sum + m.periodDiscipline.percentage,
            0,
          ) / formattedMembers.length
        : 0;

    const totalCoaches = formattedMembers.filter(
      (m) => m.role === "coach",
    ).length;

    const topPerformer =
      formattedMembers.length > 0
        ? formattedMembers.reduce((top, m) =>
            m.periodDiscipline.percentage > top.periodDiscipline.percentage
              ? m
              : top,
          )
        : null;

    const needsAttention = formattedMembers
      .filter((m) => m.periodDiscipline.percentage < 60)
      .sort(
        (a, b) => a.periodDiscipline.percentage - b.periodDiscipline.percentage,
      )
      .slice(0, 5);

    // Send response
    res.status(200).json({
      success: true,
      source: "realtime",
      lastUpdated: new Date().toISOString(),
      dateRange,
      // ✅ Use local date formatting to prevent timezone shifting
      startDate: formatDateForMySQL(dates.start),
      endDate: formatDateForMySQL(dates.end),
      allMembers: formattedMembers,
      summary: {
        totalMembers: formattedMembers.length,
        totalCoaches: totalCoaches,
        totalUsers: formattedMembers.length - totalCoaches,
        averageDiscipline: Math.round(avgDiscipline * 10) / 10,
        topPerformer: topPerformer
          ? {
              userId: topPerformer.userId,
              userName: topPerformer.userName,
              discipline: topPerformer.periodDiscipline.percentage,
            }
          : null,
        needsAttention: needsAttention.map((m) => ({
          userId: m.userId,
          userName: m.userName,
          discipline: m.periodDiscipline.percentage,
        })),
      },
    });
  } catch (err) {
    console.error("❌ Error in admin all-members-discipline API:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: err.message,
    });
  }
}
