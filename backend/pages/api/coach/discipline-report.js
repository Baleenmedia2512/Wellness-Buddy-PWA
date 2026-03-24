import { getSupabaseClient } from "../../../utils/supabaseClient.js";
import { convertISTToUserLocalTime } from "../../../utils/timezoneConverter.js";
import {
  parseDateRange,
  calculateExpectedPosts,
  calculateDisciplinePercentage,
  getDaysBetween,
  formatDateForMySQL,
} from "../../../utils/disciplineHelpers.js";

// ✅ HARDCODED BUFFER: Extra seconds added to every meal/activity window end time
// Ensures uploads made within the last minute of the window (e.g. 08:30:35) are counted on-time
const WINDOW_BUFFER_SECONDS = 35;

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
 * API: Get Coach Discipline Report
 * Returns discipline percentages for all team members
 * Uses Supabase REST API (consistent with other working APIs)
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
    const { coachId, dateRange, startDate, endDate, userTimezoneOffset } = req.query;

    // Validation
    if (!coachId) {
      res.status(400).json({ success: false, message: "Coach ID required" });
      return;
    }

    if (!dateRange) {
      res.status(400).json({ success: false, message: "Date range required" });
      return;
    }

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

    const supabase = getSupabaseClient();
    const coachIdInt = parseInt(coachId);

    // Step 1: Get the coach first
    const { data: coach, error: coachError } = await supabase
      .from("team_table")
      .select("*")
      .eq("UserId", coachIdInt)
      .eq("Status", "Active")
      .maybeSingle();

    if (coachError || !coach) {
      console.error("Coach not found:", coachError);
      res.status(404).json({ success: false, message: "Coach not found" });
      return;
    }

    // Step 2: Get all active team members recursively using dual coaching model
    // Support both CoachId and CoCoachId - members can report to 2 coaches
    const allMembers = [];
    const memberEntries = []; // Track each coach-member relationship (duplicates allowed)
    const processedUserIds = new Map(); // Track userId -> member data

    // Add coach as level 0
    const coachEntry = {
      ...coach,
      HierarchyLevel: 0,
      IsLoggedInCoach: true,
      CoachId: coach.CoachId || null,
      ParentCoachId: null, // Which coach this entry reports through
    };
    allMembers.push(coachEntry);
    memberEntries.push(coachEntry);
    processedUserIds.set(coach.UserId, coach);

    // Iteratively fetch team members level by level
    let currentLevelCoachIds = [coachIdInt];
    let currentLevel = 1;
    const maxLevel = 10;

    while (currentLevelCoachIds.length > 0 && currentLevel <= maxLevel) {
      // Fetch members where coach_id matches current level coaches
      // NOTE: Query ONLY by CoachId (not CoCoachId) as coachPartnerIds already includes both coaches
      const { data: levelMembers, error: levelError } = await supabase
        .from("team_table")
        .select("*")
        .in("CoachId", currentLevelCoachIds)
        .eq("Status", "Active");

      if (levelError) {
        console.error("Error fetching level members:", levelError);
        break;
      }

      if (!levelMembers || levelMembers.length === 0) break;

      const nextLevelCoachIds = [];

      for (const member of levelMembers) {
        // Store base member data
        if (!processedUserIds.has(member.UserId)) {
          processedUserIds.set(member.UserId, member);
        }

        const baseMember = processedUserIds.get(member.UserId);

        // Add member entry (no need for duplicate relationships since coachPartnerIds handles dual reporting)
        if (currentLevelCoachIds.includes(member.CoachId)) {
          const entry = {
            ...baseMember,
            HierarchyLevel: currentLevel,
            IsLoggedInCoach: false,
            CoachId: member.CoachId,
            ParentCoachId: member.CoachId,
          };
          
          memberEntries.push(entry);

          // Add to nextLevel if they are a coach (avoid duplicates)
          if (
            baseMember.Role === "coach" &&
            !nextLevelCoachIds.includes(baseMember.UserId)
          ) {
            nextLevelCoachIds.push(baseMember.UserId);
          }
        }
      }

      currentLevelCoachIds = nextLevelCoachIds;
      currentLevel++;
    }

    // Step 3: Get time windows
    const { data: timeWindows, error: twError } = await supabase
      .from("activity_time_windows_table")
      .select("*")
      .is("EffectiveToDate", null);

    if (twError) {
      console.error("Error fetching time windows:", twError);
    }

    // Create time window map
    const timeWindowMap = {};
    (timeWindows || []).forEach((tw) => {
      timeWindowMap[tw.ActivityType] = {
        start: tw.WindowStartTime,
        end: tw.WindowEndTime,
      };
    });

    // Meal windows for discipline calculation
    const mealWindows = {
      breakfast: timeWindowMap.breakfast || {
        start: "05:30:00",
        end: "08:30:00",
      },
      lunch: timeWindowMap.lunch || { start: "12:00:00", end: "16:00:00" },
      dinner: timeWindowMap.dinner || { start: "17:30:00", end: "20:30:00" },
    };

    // Step 4: Calculate discipline for all members
    const startDateStr = formatDateForMySQL(dates.start);
    const endDateStr = formatDateForMySQL(dates.end);
    // Get unique user IDs for data fetching (no duplicates in queries)
    const allUserIds = Array.from(processedUserIds.keys());
    
    // 🔍 DEBUG: Log query parameters
    console.log('🔎 Discipline Query Parameters:', {
      startDate: startDateStr,
      endDate: endDateStr,
      endDateTime: endDateStr + "T23:59:59",
      userIds: allUserIds,
      userCount: allUserIds.length,
      dateRange: dateRange,
      tzOffset: userTimezoneOffset
    });

    // Fetch all required data in bulk for efficiency
    const [weightData, educationData, foodData] = await Promise.all([
      // Weight records
      supabase
        .from("weight_records_table")
        .select("UserId, CreatedAt")
        .in("UserId", allUserIds)
        .gte("CreatedAt", startDateStr)
        .lte("CreatedAt", endDateStr + "T23:59:59")
        .or('IsDeleted.is.null,IsDeleted.eq.0'),

      // Education records
      supabase
        .from("education_logs_table")
        .select("UserId, CreatedAt")
        .in("UserId", allUserIds)
        .gte("CreatedAt", startDateStr)
        .lte("CreatedAt", endDateStr + "T23:59:59")
        .or('IsDeleted.is.null,IsDeleted.eq.0'),

      // Food/nutrition records
      supabase
        .from("food_nutrition_data_table")
        .select("UserID, CreatedAt")
        .in("UserID", allUserIds.map(String))
        .gte("CreatedAt", startDateStr)
        .lte("CreatedAt", endDateStr + "T23:59:59")
        .or('IsDeleted.is.null,IsDeleted.eq.0'),
    ]);
    
    // 🔍 DEBUG: Log fetched data counts and sample records
    console.log('📊 Fetched Data Summary:', {
      weightRecords: weightData.data?.length || 0,
      educationRecords: educationData.data?.length || 0,
      foodRecords: foodData.data?.length || 0,
      dateRange: `${startDateStr} to ${endDateStr}`,
      userIds: allUserIds,
      sampleWeightRecord: weightData.data?.[0],
      sampleEducationRecord: educationData.data?.[0],
      sampleFoodRecord: foodData.data?.[0]
    });
    
    // 🔍 DEBUG: Check for query errors
    if (weightData.error) console.error('❌ Weight query error:', weightData.error);
    if (educationData.error) console.error('❌ Education query error:', educationData.error);
    if (foodData.error) console.error('❌ Food query error:', foodData.error);

    // Process discipline data for each member
    const daysInPeriod = getDaysBetween(dates.start, dates.end);
    const expectedPostsPerActivity = daysInPeriod;

    // ⚠️ TIMEZONE NOTE: Database stores timestamps in IST.
    // ✅ FIX: Convert IST to user's local time before checking time windows
    // This ensures discipline tracking works correctly for users in any timezone

    // Parse timezone offset (sent from frontend as minutes)
    const tzOffset = userTimezoneOffset ? parseInt(userTimezoneOffset) : null;

    // Helper to check if time is within window
    // ✅ TIMEZONE FIX: Convert IST timestamp to user's local time before checking
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

    // Helper to get unique dates (timezone-safe)
    const getUniqueDates = (records, userId, userIdField = "UserId") => {
      const dates = new Set();
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
      return dates;
    };

    // Helper to get unique on-time dates (timezone-safe)
    const getUniqueOnTimeDates = (
      records,
      userId,
      windowStart,
      windowEnd,
      userIdField = "UserId",
    ) => {
      const dates = new Set();
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
      return dates;
    };

    // Calculate discipline for each member
    const disciplineData = allMembers.map((member) => {
      const userId = member.UserId;

      // Weight
      const weightDates = getUniqueDates(weightData.data || [], userId);
      const weightWindow = timeWindowMap.weight || {
        start: "03:00:00",
        end: "06:30:00",
      };
      
      // 🔍 DEBUG: Log weight conversion for USA users
      if (tzOffset === 300 || tzOffset >= 240) {
        (weightData.data || []).forEach((r) => {
          if (r.UserId == userId) {
            const convertedTime = tzOffset !== null ? convertISTToUserLocalTime(r.CreatedAt, tzOffset) : null;
            const inWindow = isTimeInWindow(r.CreatedAt, weightWindow.start, weightWindow.end);
            console.log(`⚖️ Weight Check:`, {
              userId,
              createdAtIST: r.CreatedAt,
              convertedTime,
              weightWindow: `${weightWindow.start} - ${weightWindow.end}`,
              inWindow
            });
          }
        });
      }
      
      const weightOnTimeDates = getUniqueOnTimeDates(
        weightData.data || [],
        userId,
        weightWindow.start,
        weightWindow.end,
      );
      
      // 🔍 DEBUG: Log weight data summary
      if ((weightData.data || []).filter(r => r.UserId == userId).length > 0) {
        console.log(`👤 User ${userId} Weight Summary:`, {
          totalRecords: (weightData.data || []).filter(r => r.UserId == userId).length,
          weightDates: Array.from(weightDates),
          weightOnTimeDates: Array.from(weightOnTimeDates),
          weightWindow
        });
      }

      // Education
      const educationDates = getUniqueDates(educationData.data || [], userId);
      const educationWindow = timeWindowMap.education || {
        start: "05:00:00",
        end: "23:00:00",
      };
      
      // 🔍 DEBUG: Log education conversion for USA users
      if (tzOffset === 300 || tzOffset >= 240) {
        (educationData.data || []).forEach((r) => {
          if (r.UserId == userId) {
            const convertedTime = tzOffset !== null ? convertISTToUserLocalTime(r.CreatedAt, tzOffset) : null;
            const inWindow = isTimeInWindow(r.CreatedAt, educationWindow.start, educationWindow.end);
            console.log(`📚 Education Check:`, {
              userId,
              createdAtIST: r.CreatedAt,
              convertedTime,
              educationWindow: `${educationWindow.start} - ${educationWindow.end}`,
              inWindow
            });
          }
        });
      }
      
      const educationOnTimeDates = getUniqueOnTimeDates(
        educationData.data || [],
        userId,
        educationWindow.start,
        educationWindow.end,
      );
      
      // 🔍 DEBUG: Log education data summary
      if ((educationData.data || []).filter(r => r.UserId == userId).length > 0) {
        console.log(`📚 User ${userId} Education Summary:`, {
          totalRecords: (educationData.data || []).filter(r => r.UserId == userId).length,
          educationDates: Array.from(educationDates),
          educationOnTimeDates: Array.from(educationOnTimeDates),
          educationWindow
        });
      }

      // Helper function to get meal data with time windows
      const getMealData = (mealWindow, mealType) => {
        const dates = new Set();
        const onTimeDates = new Set();

        (foodData.data || []).forEach((r) => {
          if (r.UserID == userId) {
            // ✅ Use local date formatting to prevent timezone shifting
            const date = new Date(r.CreatedAt);
            const dateStr =
              date.getFullYear() +
              "-" +
              String(date.getMonth() + 1).padStart(2, "0") +
              "-" +
              String(date.getDate()).padStart(2, "0");
            dates.add(dateStr);

            // ✅ TIMEZONE FIX: Use isTimeInWindow for timezone conversion
            const inWindow = isTimeInWindow(r.CreatedAt, mealWindow.start, mealWindow.end);
            
            // 🔍 DEBUG: Log meal categorization for USA timezone (offset 300)
            if (tzOffset === 300 || tzOffset >= 240) {
              const convertedTime = tzOffset !== null ? convertISTToUserLocalTime(r.CreatedAt, tzOffset) : null;
              console.log(`🍽️ Meal Check [${mealType}]:`, {
                userId,
                createdAtIST: r.CreatedAt,
                convertedTime,
                mealWindow: `${mealWindow.start} - ${mealWindow.end}`,
                inWindow,
                dateStr
              });
            }
            
            if (inWindow) {
              onTimeDates.add(dateStr);
            }
          }
        });

        return { dates, onTimeDates };
      };

      const breakfastData = getMealData(mealWindows.breakfast, 'BREAKFAST');
      const lunchData = getMealData(mealWindows.lunch, 'LUNCH');
      const dinnerData = getMealData(mealWindows.dinner, 'DINNER');

      // 🔍 DEBUG: Log meal data summary for USA users
      if (tzOffset === 300 || tzOffset >= 240) {
        console.log(`🍽️ User ${userId} Meal Summary:`, {
          userId,
          tzOffset,
          breakfastWindow: mealWindows.breakfast,
          lunchWindow: mealWindows.lunch,
          dinnerWindow: mealWindows.dinner,
          breakfast: {
            totalDates: breakfastData.dates.size,
            onTimeDates: breakfastData.onTimeDates.size,
            dates: Array.from(breakfastData.dates),
            onTime: Array.from(breakfastData.onTimeDates)
          },
          lunch: {
            totalDates: lunchData.dates.size,
            onTimeDates: lunchData.onTimeDates.size,
            dates: Array.from(lunchData.dates),
            onTime: Array.from(lunchData.onTimeDates)
          },
          dinner: {
            totalDates: dinnerData.dates.size,
            onTimeDates: dinnerData.onTimeDates.size,
            dates: Array.from(dinnerData.dates),
            onTime: Array.from(dinnerData.onTimeDates)
          }
        });
      }

      return {
        userId,
        weight: {
          totalPosts: weightDates.size,
          onTimePosts: weightOnTimeDates.size,
          expectedPosts: expectedPostsPerActivity,
        },
        education: {
          totalPosts: educationDates.size,
          onTimePosts: educationOnTimeDates.size,
          expectedPosts: expectedPostsPerActivity,
        },
        breakfast: {
          totalPosts: breakfastData.dates.size,
          onTimePosts: breakfastData.onTimeDates.size,
          expectedPosts: expectedPostsPerActivity,
        },
        lunch: {
          totalPosts: lunchData.dates.size,
          onTimePosts: lunchData.onTimeDates.size,
          expectedPosts: expectedPostsPerActivity,
        },
        dinner: {
          totalPosts: dinnerData.dates.size,
          onTimePosts: dinnerData.onTimeDates.size,
          expectedPosts: expectedPostsPerActivity,
        },
      };
    });
    
    // 🔍 DEBUG: Log discipline calculation for first member
    if (disciplineData.length > 0) {
      console.log('📊 Sample Discipline Data (First Member):', {
        userId: disciplineData[0].userId,
        weight: disciplineData[0].weight,
        education: disciplineData[0].education,
        breakfast: disciplineData[0].breakfast,
        lunch: disciplineData[0].lunch,
        dinner: disciplineData[0].dinner
      });
    }

    // Step 5: Separate coach from team members (use unique members from processedUserIds)
    const loggedInCoach = allMembers.find((m) => m.IsLoggedInCoach);
    const teamMembers = allMembers.filter((m) => !m.IsLoggedInCoach);

    if (allMembers.length === 0) {
      res.status(200).json({
        success: true,
        source: "realtime",
        lastUpdated: new Date().toISOString(),
        coachId: coachIdInt,
        dateRange,
        // ✅ Use local date formatting to prevent timezone shifting
        startDate: formatDateForMySQL(dates.start),
        endDate: formatDateForMySQL(dates.end),
        coachPerformance: null,
        teamMembers: [],
        teamSummary: {
          totalMembers: 0,
          totalTeamMembers: 0,
          totalCoaches: 0,
          averagePeriodDiscipline: 0,
          topPerformer: null,
          needsAttention: [],
        },
      });
      return;
    }

    // Helper function to format time for display (HH:MM:SS -> h:MM AM/PM)
    const formatTimeForDisplay = (timeStr) => {
      if (!timeStr) return "";
      const [hours, minutes] = timeStr.split(":");
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? "PM" : "AM";
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      return `${displayHour}:${minutes} ${ampm}`;
    };

    // Step 6: Format logged-in coach's performance data
    let coachPerformanceData = null;
    if (loggedInCoach) {
      const coachDiscipline = disciplineData.find(
        (d) => d.userId === loggedInCoach.UserId,
      );

      if (coachDiscipline) {
        const coachTotalOnTimePosts =
          (coachDiscipline.weight?.onTimePosts || 0) +
          (coachDiscipline.education?.onTimePosts || 0) +
          (coachDiscipline.breakfast?.onTimePosts || 0) +
          (coachDiscipline.lunch?.onTimePosts || 0) +
          (coachDiscipline.dinner?.onTimePosts || 0);

        const coachTotalExpectedPosts = calculateExpectedPosts(
          dates.start,
          dates.end,
        );

        coachPerformanceData = {
          userId: loggedInCoach.UserId,
          userName: loggedInCoach.UserName,
          email: loggedInCoach.Email,
          role: loggedInCoach.Role,
          joinedDate: loggedInCoach.EntryDateTime,
          isLoggedInCoach: true,
          coachId: loggedInCoach.CoachId,
          hierarchyLevel: loggedInCoach.HierarchyLevel,
          periodDiscipline: {
            percentage: calculateDisciplinePercentage(
              coachTotalOnTimePosts,
              coachTotalExpectedPosts,
            ),
            onTimePosts: coachTotalOnTimePosts,
            expectedPosts: coachTotalExpectedPosts,
            daysInPeriod: daysInPeriod,
          },
          period: {
            percentage: calculateDisciplinePercentage(
              coachTotalOnTimePosts,
              coachTotalExpectedPosts,
            ),
            onTimePosts: coachTotalOnTimePosts,
            expectedPosts: coachTotalExpectedPosts,
          },
          activities: {
            weight: {
              percentage: calculateDisciplinePercentage(
                coachDiscipline.weight?.onTimePosts || 0,
                coachDiscipline.weight?.expectedPosts || 0,
              ),
              onTimePosts: coachDiscipline.weight?.onTimePosts || 0,
              expectedPosts: coachDiscipline.weight?.expectedPosts || 0,
              targetWindow: timeWindowMap.weight
                ? `${formatTimeForDisplay(timeWindowMap.weight.start)} - ${formatTimeForDisplay(timeWindowMap.weight.end)}`
                : "Not Set",
            },
            education: {
              percentage: calculateDisciplinePercentage(
                coachDiscipline.education?.onTimePosts || 0,
                coachDiscipline.education?.expectedPosts || 0,
              ),
              onTimePosts: coachDiscipline.education?.onTimePosts || 0,
              expectedPosts: coachDiscipline.education?.expectedPosts || 0,
              targetWindow: timeWindowMap.education
                ? `${formatTimeForDisplay(timeWindowMap.education.start)} - ${formatTimeForDisplay(timeWindowMap.education.end)}`
                : "Not Set",
            },
            breakfast: {
              percentage: calculateDisciplinePercentage(
                coachDiscipline.breakfast?.onTimePosts || 0,
                coachDiscipline.breakfast?.expectedPosts || 0,
              ),
              onTimePosts: coachDiscipline.breakfast?.onTimePosts || 0,
              expectedPosts: coachDiscipline.breakfast?.expectedPosts || 0,
              targetWindow: timeWindowMap.breakfast
                ? `${formatTimeForDisplay(timeWindowMap.breakfast.start)} - ${formatTimeForDisplay(timeWindowMap.breakfast.end)}`
                : "Not Set",
            },
            lunch: {
              percentage: calculateDisciplinePercentage(
                coachDiscipline.lunch?.onTimePosts || 0,
                coachDiscipline.lunch?.expectedPosts || 0,
              ),
              onTimePosts: coachDiscipline.lunch?.onTimePosts || 0,
              expectedPosts: coachDiscipline.lunch?.expectedPosts || 0,
              targetWindow: timeWindowMap.lunch
                ? `${formatTimeForDisplay(timeWindowMap.lunch.start)} - ${formatTimeForDisplay(timeWindowMap.lunch.end)}`
                : "Not Set",
            },
            dinner: {
              percentage: calculateDisciplinePercentage(
                coachDiscipline.dinner?.onTimePosts || 0,
                coachDiscipline.dinner?.expectedPosts || 0,
              ),
              onTimePosts: coachDiscipline.dinner?.onTimePosts || 0,
              expectedPosts: coachDiscipline.dinner?.expectedPosts || 0,
              targetWindow: timeWindowMap.dinner
                ? `${formatTimeForDisplay(timeWindowMap.dinner.start)} - ${formatTimeForDisplay(timeWindowMap.dinner.end)}`
                : "Not Set",
            },
          },
        };
      }
    }

    // Step 7: Format response data (team members - includes duplicates for dual reporting)
    const formattedTeamMembers = teamMembers
      .map((member) => {
        const discipline = disciplineData.find(
          (d) => d.userId === member.UserId,
        );

        if (!discipline) {
          // 🔍 DEBUG: Log missing discipline data
          console.log('⚠️ No discipline data found for member:', {
            userId: member.UserId,
            userName: member.UserName,
            email: member.Email,
            availableDisciplineUserIds: disciplineData.map(d => d.userId)
          });
          return null;
        }

        const isCoach = member.Role === "coach";
        // Count sub-team based on CoachId only
        const subTeamCount = isCoach
          ? Array.from(processedUserIds.values()).filter(
              (m) => m.CoachId === member.UserId,
            ).length
          : 0;

        const activities = {
          weight: {
            percentage: calculateDisciplinePercentage(
              discipline.weight?.onTimePosts || 0,
              discipline.weight?.expectedPosts || 0,
            ),
            onTimePosts: discipline.weight?.onTimePosts || 0,
            expectedPosts: discipline.weight?.expectedPosts || 0,
            targetWindow: timeWindowMap.weight
              ? `${formatTimeForDisplay(timeWindowMap.weight.start)} - ${formatTimeForDisplay(timeWindowMap.weight.end)}`
              : "Not Set",
          },
          education: {
            percentage: calculateDisciplinePercentage(
              discipline.education?.onTimePosts || 0,
              discipline.education?.expectedPosts || 0,
            ),
            onTimePosts: discipline.education?.onTimePosts || 0,
            expectedPosts: discipline.education?.expectedPosts || 0,
            targetWindow: timeWindowMap.education
              ? `${formatTimeForDisplay(timeWindowMap.education.start)} - ${formatTimeForDisplay(timeWindowMap.education.end)}`
              : "Not Set",
          },
          breakfast: {
            percentage: calculateDisciplinePercentage(
              discipline.breakfast?.onTimePosts || 0,
              discipline.breakfast?.expectedPosts || 0,
            ),
            onTimePosts: discipline.breakfast?.onTimePosts || 0,
            expectedPosts: discipline.breakfast?.expectedPosts || 0,
            targetWindow: timeWindowMap.breakfast
              ? `${formatTimeForDisplay(timeWindowMap.breakfast.start)} - ${formatTimeForDisplay(timeWindowMap.breakfast.end)}`
              : "Not Set",
          },
          lunch: {
            percentage: calculateDisciplinePercentage(
              discipline.lunch?.onTimePosts || 0,
              discipline.lunch?.expectedPosts || 0,
            ),
            onTimePosts: discipline.lunch?.onTimePosts || 0,
            expectedPosts: discipline.lunch?.expectedPosts || 0,
            targetWindow: timeWindowMap.lunch
              ? `${formatTimeForDisplay(timeWindowMap.lunch.start)} - ${formatTimeForDisplay(timeWindowMap.lunch.end)}`
              : "Not Set",
          },
          dinner: {
            percentage: calculateDisciplinePercentage(
              discipline.dinner?.onTimePosts || 0,
              discipline.dinner?.expectedPosts || 0,
            ),
            onTimePosts: discipline.dinner?.onTimePosts || 0,
            expectedPosts: discipline.dinner?.expectedPosts || 0,
            targetWindow: timeWindowMap.dinner
              ? `${formatTimeForDisplay(timeWindowMap.dinner.start)} - ${formatTimeForDisplay(timeWindowMap.dinner.end)}`
              : "Not Set",
          },
        };

        const totalOnTimePosts =
          (discipline.weight?.onTimePosts || 0) +
          (discipline.education?.onTimePosts || 0) +
          (discipline.breakfast?.onTimePosts || 0) +
          (discipline.lunch?.onTimePosts || 0) +
          (discipline.dinner?.onTimePosts || 0);

        const totalExpectedPosts = calculateExpectedPosts(
          dates.start,
          dates.end,
        );
        const periodDisciplinePercentage = calculateDisciplinePercentage(
          totalOnTimePosts,
          totalExpectedPosts,
        );
        
        // 🔍 DEBUG: Log member score calculation
        console.log(`📊 Member ${member.UserName} (${member.UserId}):`, {
          totalOnTimePosts,
          totalExpectedPosts,
          periodDisciplinePercentage,
          weight: discipline.weight,
          education: discipline.education,
          breakfast: discipline.breakfast,
          lunch: discipline.lunch,
          dinner: discipline.dinner
        });

        return {
          userId: member.UserId,
          userName: member.UserName,
          email: member.Email,
          role: member.Role,
          isCoach: isCoach,
          isLoggedInCoach: false,
          subTeamCount: subTeamCount,
          coachId: member.CoachId,
          parentCoachId: member.ParentCoachId, // Which coach this entry reports through
          hierarchyLevel: member.HierarchyLevel,
          profileImage: null,
          joinedDate: member.EntryDateTime,
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
    
    // 🔍 DEBUG: Log formatted team members summary
    console.log('👥 Formatted Team Members Summary:', {
      totalFormatted: formattedTeamMembers.length,
      members: formattedTeamMembers.map(m => ({
        userId: m.userId,
        userName: m.userName,
        periodDiscipline: m.periodDiscipline,
        hierarchyLevel: m.hierarchyLevel
      }))
    });

    // Step 8: Calculate team summary (use unique members for stats)
    const uniqueMembers = Array.from(processedUserIds.values());
    const allMembersForStats = [];
    if (coachPerformanceData) {
      allMembersForStats.push(coachPerformanceData);
    }
    // Add unique members only (avoid counting duplicates in stats)
    uniqueMembers.forEach((um) => {
      if (um.UserId !== coachIdInt) {
        const formattedMember = formattedTeamMembers.find(
          (fm) => fm.userId === um.UserId,
        );
        if (formattedMember) {
          allMembersForStats.push(formattedMember);
        }
      }
    });

    const avgPeriodDiscipline =
      allMembersForStats.length > 0
        ? allMembersForStats.reduce(
            (sum, m) => sum + m.periodDiscipline.percentage,
            0,
          ) / allMembersForStats.length
        : 0;

    const topPerformer =
      allMembersForStats.length > 0
        ? allMembersForStats.reduce((max, m) =>
            m.periodDiscipline.percentage > max.periodDiscipline.percentage
              ? m
              : max,
          )
        : null;

    const needsAttention = allMembersForStats.filter(
      (m) => m.periodDiscipline.percentage < 60,
    );

    // Step 9: Return response
    res.status(200).json({
      success: true,
      source: "realtime",
      lastUpdated: new Date().toISOString(),
      coachId: coachIdInt,
      dateRange,
      // ✅ Use local date formatting to prevent timezone shifting
      startDate: formatDateForMySQL(dates.start),
      endDate: formatDateForMySQL(dates.end),
      coachPerformance: coachPerformanceData,
      teamMembers: formattedTeamMembers, // Includes duplicates for dual reporting
      teamSummary: {
        totalMembers: uniqueMembers.length, // Unique count
        totalTeamMembers: formattedTeamMembers.length, // Total entries (with duplicates)
        totalCoaches: uniqueMembers.filter(
          (m) => m.Role === "coach" || m.Role === "admin",
        ).length,
        averagePeriodDiscipline: Math.round(avgPeriodDiscipline * 10) / 10,
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
          reason: "Below 60% threshold",
        })),
      },
    });
    return;
  } catch (error) {
    console.error("❌ Discipline report error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve discipline report",
      error: error.message,
    });
    return;
  }
}
