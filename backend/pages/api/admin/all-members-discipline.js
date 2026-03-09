import { getSupabaseClient } from "../../../utils/supabaseClient.js";
import { convertISTToUserLocalTime } from "../../../utils/timezoneConverter.js";
import {
  parseDateRange,
  calculateExpectedPosts,
  calculateDisciplinePercentage,
  getDaysBetween,
  formatDateForMySQL,
} from "../../../utils/disciplineHelpers.js";

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
        "UserId, UserName, Email, Role, EntryDateTime, CoachId, CoCoachId, TeamId",
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
    const [weightData, educationData, foodData] = await Promise.all([
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

      // Food/nutrition records
      supabase
        .from("food_nutrition_data_table")
        .select("UserID, CreatedAt")
        .in("UserID", memberIds.map(String))
        .gte("CreatedAt", startDateStr)
        .lte("CreatedAt", endDateStr + "T23:59:59")
        .or('IsDeleted.is.null,IsDeleted.eq.0'),
    ]);

    if (weightData.error) {
      console.error("Error fetching weight data:", weightData.error);
    }
    if (educationData.error) {
      console.error("Error fetching education data:", educationData.error);
    }
    if (foodData.error) {
      console.error("Error fetching food data:", foodData.error);
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
      return time >= windowStart && time <= windowEnd;
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

              if (time >= mealWindow.start && time <= mealWindow.end) {
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
        };

        // Calculate overall period discipline
        const totalOnTimePosts =
          discipline.weight.onTimePosts +
          discipline.education.onTimePosts +
          discipline.breakfast.onTimePosts +
          discipline.lunch.onTimePosts +
          discipline.dinner.onTimePosts;

        const totalExpectedPosts = expectedPostsPerActivity * 5;
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
          coachId: member.Coach_Id,
          coCoachId: member.CoCoach_Id,
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
