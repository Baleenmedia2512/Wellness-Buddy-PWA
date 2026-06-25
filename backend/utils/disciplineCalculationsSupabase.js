/**
 * Discipline Calculations using Supabase REST API
 * Replacement for disciplineCalculations.js that works through firewalls
 */

import { getSupabaseClient } from './supabaseClient.js';
import { normalizeTimestamp } from './timestampUtils.js';
import { formatDateForMySQL, getDaysBetween } from './disciplineHelpers.js';
import { convertISTToUserLocalTime } from './timezoneConverter.js';
import { isExemptedBeverageOnly, isExemptedFood } from './foodTypeDetection.js';

// Default required water when no weight is recorded (2.5 L)
const DEFAULT_WATER_REQUIRED_ML = 2500;

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
 * Get team hierarchy using Supabase REST API
 * Replaces the recursive CTE query
 * @param {number} coachId - Coach user ID
 * @returns {Array} Array of team members with hierarchy info
 */
export async function getTeamHierarchy(coachId) {
  const supabase = getSupabaseClient();
  
  // Get the logged-in coach first
  const { data: coach, error: coachError } = await supabase
    .from('team_table')
    .select('"UserId", "UserName", "Email", "Role", "EntryDateTime", "CoachId"')
    .eq('"UserId"', coachId)
    .eq('"Status"', 'Active')
    .maybeSingle();
  
  if (coachError) {
    console.error('❌ Error fetching coach:', coachError);
    throw coachError;
  }
  
  if (!coach) {
    return [];
  }
  
  // Add coach with level 0
  const allMembers = [{
    ...coach,
    HierarchyLevel: 0,
    IsLoggedInCoach: true
  }];
  
  // Recursive function to get team members at each level
  async function getTeamAtLevel(parentIds, level, maxLevel = 10) {
    if (level > maxLevel || parentIds.length === 0) {
      return [];
    }
    
    const { data: members, error } = await supabase
      .from('team_table')
      .select('"UserId", "UserName", "Email", "Role", "EntryDateTime", "CoachId"')
      .in('"CoachId"', parentIds)
      .eq('"Status"', 'Active');
    
    if (error) {
      console.error(`❌ Error fetching level ${level} members:`, error);
      return [];
    }
    
    if (!members || members.length === 0) {
      return [];
    }
    
    // Add hierarchy level to each member
    const membersWithLevel = members.map(m => ({
      ...m,
      HierarchyLevel: level,
      IsLoggedInCoach: false
    }));
    
    // Get next level (coaches' teams)
    const coachIds = members
      .filter(m => m.Role === 'coach' || m.Role === 'admin' || m.Role === 'developer')
      .map(m => m.UserId);
    
    const nextLevelMembers = await getTeamAtLevel(coachIds, level + 1, maxLevel);
    
    return [...membersWithLevel, ...nextLevelMembers];
  }
  
  // Get all team members recursively
  const teamMembers = await getTeamAtLevel([coachId], 1);
  allMembers.push(...teamMembers);
  
  // Deduplicate by UserId (keep lowest hierarchy level)
  const uniqueMembers = [];
  const seenUserIds = new Set();
  
  const sortedMembers = [...allMembers].sort((a, b) => a.HierarchyLevel - b.HierarchyLevel);
  
  for (const member of sortedMembers) {
    if (!seenUserIds.has(member.UserId)) {
      seenUserIds.add(member.UserId);
      uniqueMembers.push(member);
    }
  }
  
  return uniqueMembers;
}

/**
 * Get time windows from database
 * @returns {Object} Time windows map
 */
export async function getTimeWindows() {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('activity_time_windows_table')
    .select('"ActivityType", "WindowStartTime", "WindowEndTime"')
    .is('"EffectiveToDate"', null);
  
  if (error) {
    console.error('❌ Error fetching time windows:', error);
    // Return defaults
    return {
      weight: { start: '05:00:00', end: '09:00:00' },
      education: { start: '05:00:00', end: '23:59:00' },
      breakfast: { start: '05:30:00', end: '08:30:00' },
      lunch: { start: '12:00:00', end: '16:00:00' },
      dinner: { start: '17:30:00', end: '20:30:00' }
    };
  }
  
  const windowMap = {};
  if (data) {
    data.forEach(tw => {
      windowMap[tw.ActivityType] = {
        start: tw.WindowStartTime,
        end: tw.WindowEndTime
      };
    });
  }
  
  return windowMap;
}

/**
 * Calculate discipline for a member using Supabase
 * @param {number} userId - User ID
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @param {Object} timeWindows - Pre-fetched time windows
 * @param {number} userTimezoneOffset - User's timezone offset in minutes (optional)
 * @returns {Object} Discipline data
 */
export async function calculateMemberDisciplineSupabase(userId, startDate, endDate, timeWindows, userTimezoneOffset = null) {
  const supabase = getSupabaseClient();
  const startDateStr = formatDateForMySQL(startDate);
  const endDateStr = formatDateForMySQL(endDate);
  const daysInPeriod = getDaysBetween(startDate, endDate);
  
  // Get weight records (discipline check: logged weight today)
  const { data: weightRecords } = await supabase
    .from('weight_records_table')
    .select('"CreatedAt"')
    .eq('"UserId"', userId)
    .eq('"IsDeleted"', false)
    .gte('"CreatedAt"', `${startDateStr}T00:00:00`)
    .lte('"CreatedAt"', `${endDateStr}T23:59:59`);

  // Get user's latest body weight from weight_records_table (for water intake calculation)
  // BMR is now stored in team_table directly
  const { data: latestWeightRows } = await supabase
    .from('weight_records_table')
    .select('UserId, Weight')
    .eq('UserId', userId)
    .or('IsDeleted.is.null,IsDeleted.eq.false')
    .order('CreatedAt', { ascending: false })
    .limit(1);
  const latestBodyWeight = latestWeightRows && latestWeightRows.length > 0
    ? parseFloat(latestWeightRows[0].Weight)
    : null;
  const requiredWaterMl = (latestBodyWeight && latestBodyWeight > 0)
    ? Math.round((latestBodyWeight / 20) * 1000)
    : DEFAULT_WATER_REQUIRED_ML;

  // BMR (calorie target) — read from team_table.
  // NOTE: a user may legitimately have multiple team_table rows (e.g. a coach
  // who is also a member of another team). `.maybeSingle()` returns null in
  // that case and the calorie discipline silently becomes 0%. Fetch all rows
  // for the user and pick the highest non-null BMR in JS — avoids depending on
  // a sort column that may not exist on team_table.
  const { data: teamRows } = await supabase
    .from('team_table')
    .select('Bmr')
    .eq('UserId', userId)
    .not('Bmr', 'is', null);
  let userBmrTarget = null;
  (teamRows || []).forEach(r => {
    const b = parseFloat(r.Bmr);
    if (!isNaN(b) && b > 0 && (userBmrTarget === null || b > userBmrTarget)) {
      userBmrTarget = b;
    }
  });
  
  // Get education logs
  const { data: educationLogs } = await supabase
    .from('education_logs_table')
    .select('"CreatedAt"')
    .eq('"UserId"', userId)
    .eq('"IsDeleted"', false)
    .gte('"CreatedAt"', `${startDateStr}T00:00:00`)
    .lte('"CreatedAt"', `${endDateStr}T23:59:59`);
  
  // Get nutrition data (include AnalysisData to filter out beverage-only entries, TotalCalories for calorie discipline)
  const { data: nutritionRecordsRaw } = await supabase
    .from('food_nutrition_data_table')
    .select('"CreatedAt", "AnalysisData", "TotalCalories"')
    .eq('"UserID"', String(userId))
    .eq('"IsDeleted"', false)
    .gte('"CreatedAt"', `${startDateStr}T00:00:00`)
    .lte('"CreatedAt"', `${endDateStr}T23:59:59`);
  
  // Filter out records that contain ONLY exempted beverages (water, coffee, tea, afresh etc.)
  const nutritionRecords = (nutritionRecordsRaw || []).filter(r => !isExemptedBeverageOnly(r.AnalysisData));

  // Get water intake records (food entries that are ONLY water/exempted beverages — opposite filter)
  const waterRecords = (nutritionRecordsRaw || []).filter(r => isExemptedBeverageOnly(r.AnalysisData));

  // Get calories burned records (daily step activity - any day with a step entry counts)
  const { data: stepRecords } = await supabase
    .from('daily_step_activity')
    .select('"CreatedAt", "Steps", "CaloriesBurned"')
    .eq('"UserId"', userId)
    .gte('"CreatedAt"', `${startDateStr}T00:00:00`)
    .lte('"CreatedAt"', `${endDateStr}T23:59:59`);

  // Get watch-burned calories from education_logs_table (Topic: "Calories Burned: NNN kcal")
  const { data: watchBurnRecords } = await supabase
    .from('education_logs_table')
    .select('"Topic", "CreatedAt"')
    .eq('"UserId"', userId)
    .ilike('"Topic"', 'Calories Burned:%')
    .or('"IsDeleted".is.null,"IsDeleted".eq.0')
    .gte('"CreatedAt"', `${startDateStr}T00:00:00`)
    .lte('"CreatedAt"', `${endDateStr}T23:59:59`);
  
  // Helper to check Database stores in IST, but check against user's local time
  // Converts IST timestamp to user's local timezone before checking
  const isWithinWindow = (createdAt, window) => {
    if (!window || !createdAt) return false;
    
    let time;
    if (userTimezoneOffset !== null) {
      // Convert IST to user's local time
      time = convertISTToUserLocalTime(createdAt, userTimezoneOffset);
    } else {
      // Fallback: Extract time directly from timestamp string
      const timeMatch = String(createdAt).match(/(\d{2}:\d{2}:\d{2})/);
      if (!timeMatch) return false;
      time = timeMatch[1];
    }
    
    if (!time) return false;
    // ✅ BUFFER FIX: Add 59-second buffer to window.end so uploads at e.g. 08:30:51 are counted on-time
    return time >= window.start && time <= addBufferToTime(window.end);
  };
  
  // Helper to get unique dates with on-time posts
  const countOnTimeDays = (records, window) => {
    if (!records || records.length === 0) return { totalDays: 0, onTimeDays: 0 };
    
    const uniqueDates = new Set();
    const onTimeDates = new Set();
    
    records.forEach(r => {
      const normalizedDate = normalizeTimestamp(r.CreatedAt);
      const date = normalizedDate.split('T')[0];
      uniqueDates.add(date);
      if (isWithinWindow(r.CreatedAt, window)) {
        onTimeDates.add(date);
      }
    });
    
    return { totalDays: uniqueDates.size, onTimeDays: onTimeDates.size };
  };

  // ✅ TIMEZONE FIX: Extract time directly from timestamp string
  const getMealType = (createdAt) => {
    if (!createdAt) return null;
    // Extract time portion directly from timestamp string (HH:MM:SS)
    const timeMatch = String(createdAt).match(/(\d{2}:\d{2}:\d{2})/);
    if (!timeMatch) return null;
    const time = timeMatch[1];
    
    const breakfast = timeWindows.breakfast || { start: '05:30:00', end: '08:30:00' };
    const lunch = timeWindows.lunch || { start: '12:00:00', end: '16:00:00' };
    const dinner = timeWindows.dinner || { start: '17:30:00', end: '20:30:00' };

    // ✅ BUFFER FIX: Add 59-second buffer to meal end times
    if (time >= breakfast.start && time <= addBufferToTime(breakfast.end)) return 'breakfast';
    if (time >= lunch.start && time <= addBufferToTime(lunch.end)) return 'lunch';
    if (time >= dinner.start && time <= addBufferToTime(dinner.end)) return 'dinner';
    return null;
  };
  
  // Calculate weight discipline
  const weightStats = countOnTimeDays(weightRecords, timeWindows.weight);
  
  // Calculate education discipline
  const educationStats = countOnTimeDays(educationLogs, timeWindows.education);
  
  // Calculate meal discipline
  const mealStats = {
    breakfast: { totalDays: 0, onTimeDays: 0 },
    lunch: { totalDays: 0, onTimeDays: 0 },
    dinner: { totalDays: 0, onTimeDays: 0 }
  };
  
  if (nutritionRecords && nutritionRecords.length > 0) {
    const mealDates = {
      breakfast: new Set(),
      lunch: new Set(),
      dinner: new Set()
    };
    
    nutritionRecords.forEach(r => {
      const mealType = getMealType(r.CreatedAt);
      if (mealType) {
        const normalizedDate = normalizeTimestamp(r.CreatedAt);
        const date = normalizedDate.split('T')[0];
        mealDates[mealType].add(date);
      }
    });
    
    mealStats.breakfast = { totalDays: mealDates.breakfast.size, onTimeDays: mealDates.breakfast.size };
    mealStats.lunch = { totalDays: mealDates.lunch.size, onTimeDays: mealDates.lunch.size };
    mealStats.dinner = { totalDays: mealDates.dinner.size, onTimeDays: mealDates.dinner.size };
  }

  // Calculate water intake discipline (quantity-based: total volume_ml must meet requiredWaterMl)
  // requiredWaterMl = (latestBodyWeightKg / 20) * 1000 — uses most recent weight from ANY date
  // Falls back to 2500ml ONLY if user has never logged a weight at all
  const waterDates = new Set();
  // Group water volume by date
  const waterVolumeByDate = {};
  (waterRecords || []).forEach(r => {
    const normalizedDate = normalizeTimestamp(r.CreatedAt);
    const date = normalizedDate.split('T')[0];
    if (!waterVolumeByDate[date]) waterVolumeByDate[date] = 0;
    try {
      const analysisData = typeof r.AnalysisData === 'string'
        ? JSON.parse(r.AnalysisData)
        : r.AnalysisData;
      (analysisData?.foods || []).forEach(food => {
        if (isExemptedFood(food.name)) {
          // Prefer volume_ml, fall back to weight_g (water 1g ≈ 1ml), then estimatedWeight
          const ml = parseFloat(food.volume_ml) || parseFloat(food.weight_g) || parseFloat(food.estimatedWeight) || 0;
          waterVolumeByDate[date] += ml;
        }
      });
    } catch (e) { /* skip malformed records */ }
  });
  // A day counts only if total water ml >= required
  Object.entries(waterVolumeByDate).forEach(([date, totalMl]) => {
    if (totalMl >= requiredWaterMl) waterDates.add(date);
  });
  const waterStats = { totalDays: waterDates.size, onTimeDays: waterDates.size };

  // Calculate calories discipline:
  // User MUST have a BMR target set to earn calorie discipline points.
  // Net calories = calories consumed (meals) - calories burned (steps/activity)
  // A day is disciplined ONLY IF net calories <= BMR target.
  // If no BMR is set, calorie discipline = 0 (user must set BMR in their profile).
  const caloriesBurnedDates = new Set();

  if (userBmrTarget && userBmrTarget > 0) {
    // Sum calories consumed per date from non-beverage nutrition records
    const caloriesConsumedByDate = {};
    (nutritionRecords || []).forEach(r => {
      const normalizedDate = normalizeTimestamp(r.CreatedAt);
      const date = normalizedDate.split('T')[0];
      const cal = parseFloat(r.TotalCalories) || 0;
      caloriesConsumedByDate[date] = (caloriesConsumedByDate[date] || 0) + cal;
    });

    // Sum calories burned per date from step activity records
    const caloriesBurnedByDate = {};
    (stepRecords || []).forEach(r => {
      const rawBurned = parseFloat(r.CaloriesBurned) || 0;
      // Use Math.abs so that negative CaloriesBurned values (sensor deltas/corrections) are treated
      // as positive burns — a negative value means real activity was recorded, just stored inverted.
      const burned = Math.abs(rawBurned);
      if ((r.Steps || 0) > 0 || burned > 0) {
        const normalizedDate = normalizeTimestamp(r.CreatedAt);
        const date = normalizedDate.split('T')[0];
        // Keep the highest burn value recorded for the day (daily_step_activity stores cumulative totals)
        if ((caloriesBurnedByDate[date] || 0) < burned) {
          caloriesBurnedByDate[date] = burned;
        }
      }
    });

    // Also add watch-burned calories from education_logs_table
    // Topic format: "Calories Burned: 2000 kcal" — use latest entry per day
    (watchBurnRecords || []).forEach(r => {
      const match = (r.Topic || '').match(/(\d+(?:\.\d+)?)\s*kcal/i);
      if (!match) return;
      const kcal = parseFloat(match[1]) || 0;
      if (kcal <= 0) return;
      const normalizedDate = normalizeTimestamp(r.CreatedAt);
      const date = normalizedDate.split('T')[0];
      // ADD watch calories on top of step calories for the day
      caloriesBurnedByDate[date] = (caloriesBurnedByDate[date] || 0) + kcal;
    });

    // A day is disciplined if net calories (consumed - burned) <= BMR target
    // Include ALL dates in the reporting period so rest/fasting days (0 consumed)
    // are also evaluated — 0 consumed <= BMR target → disciplined day ✅
    const allPeriodDates = new Set();
    const periodCursor = new Date(startDate);
    const periodEnd = new Date(endDate);
    while (periodCursor <= periodEnd) {
      allPeriodDates.add(periodCursor.toISOString().slice(0, 10));
      periodCursor.setDate(periodCursor.getDate() + 1);
    }
    const allActivityDates = new Set([
      ...allPeriodDates,
      ...Object.keys(caloriesConsumedByDate),
      ...Object.keys(caloriesBurnedByDate),
    ]);
    allActivityDates.forEach(date => {
      const consumed = caloriesConsumedByDate[date] || 0;
      const burned   = caloriesBurnedByDate[date]   || 0;
      const netCalories = consumed - burned;
      // Disciplined: net calories at or below the target (also counts days where consumed <= target with no burns)
      if (netCalories <= userBmrTarget) {
        caloriesBurnedDates.add(date);
      }
    });
  }
  // No BMR set → caloriesBurnedDates stays empty → 0 discipline days for this category

  const caloriesBurnedStats = { totalDays: caloriesBurnedDates.size, onTimeDays: caloriesBurnedDates.size };

  return {
    weight: {
      totalPosts: weightStats.totalDays,
      onTimePosts: weightStats.onTimeDays,
      expectedPosts: daysInPeriod
    },
    education: {
      totalPosts: educationStats.totalDays,
      onTimePosts: educationStats.onTimeDays,
      expectedPosts: daysInPeriod
    },
    breakfast: {
      totalPosts: mealStats.breakfast.totalDays,
      onTimePosts: mealStats.breakfast.onTimeDays,
      expectedPosts: daysInPeriod
    },
    lunch: {
      totalPosts: mealStats.lunch.totalDays,
      onTimePosts: mealStats.lunch.onTimeDays,
      expectedPosts: daysInPeriod
    },
    dinner: {
      totalPosts: mealStats.dinner.totalDays,
      onTimePosts: mealStats.dinner.onTimeDays,
      expectedPosts: daysInPeriod
    },
    water: {
      totalPosts: waterStats.totalDays,
      onTimePosts: waterStats.onTimeDays,
      expectedPosts: daysInPeriod
    },
    caloriesBurned: {
      totalPosts: caloriesBurnedStats.totalDays,
      onTimePosts: caloriesBurnedStats.onTimeDays,
      expectedPosts: daysInPeriod
    }
  };
}

/**
 * Calculate discipline for entire team using Supabase
 * @param {Array} memberIds - Array of user IDs
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Array} Discipline data for all members
 */
export async function calculateTeamDisciplineSupabase(memberIds, startDate, endDate) {
  const results = [];
  
  // Fetch time windows once
  const timeWindows = await getTimeWindows();
  
  // Process all members
  for (const memberId of memberIds) {
    try {
      const disciplineData = await calculateMemberDisciplineSupabase(
        memberId,
        startDate,
        endDate,
        timeWindows
      );
      
      results.push({
        userId: memberId,
        ...disciplineData
      });
    } catch (error) {
      console.error(`❌ Error calculating discipline for user ${memberId}:`, error);
    }
  }
  
  return results;
}

/**
 * Calculate attendance metrics for a member
 * @param {number} userId - User ID
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Object} Attendance metrics
 */
export async function calculateAttendanceMetrics(userId, startDate, endDate) {
  const supabase = getSupabaseClient();
  const startDateStr = formatDateForMySQL(startDate);
  const endDateStr = formatDateForMySQL(endDate);
  const daysInPeriod = getDaysBetween(startDate, endDate);
  
  // Get club attendance count
  const { data: clubLogs, error: clubError } = await supabase
    .from('education_logs_table')
    .select('id', { count: 'exact', head: true })
    .eq('"UserId"', userId)
    .eq('attendance_type', 'club')
    .eq('"IsDeleted"', false)
    .gte('"CreatedAt"', `${startDateStr}T00:00:00`)
    .lte('"CreatedAt"', `${endDateStr}T23:59:59`);
  
  const clubCount = clubError ? 0 : (clubLogs || 0);
  
  // Get remote attendance count
  const { data: remoteLogs, error: remoteError } = await supabase
    .from('education_logs_table')
    .select('id', { count: 'exact', head: true })
    .eq('"UserId"', userId)
    .eq('attendance_type', 'remote')
    .eq('"IsDeleted"', false)
    .gte('"CreatedAt"', `${startDateStr}T00:00:00`)
    .lte('"CreatedAt"', `${endDateStr}T23:59:59`);
  
  const remoteCount = remoteError ? 0 : (remoteLogs || 0);
  
  // Calculate attendance percentage (club sessions / days in period)
  const attendancePercentage = daysInPeriod > 0 
    ? Math.round((clubCount / daysInPeriod) * 100) 
    : 0;
  
  return {
    clubAttendance: clubCount,
    remoteAttendance: remoteCount,
    totalEducation: clubCount + remoteCount,
    attendancePercentage,
    daysInPeriod,
  };
}

/**
 * Get team hierarchy using DUAL COACHING MODEL (CoachId + CoCoachId)
 * This function properly tracks the hierarchy path to ensure correct parent-child relationships
 * when members can report to two coaches simultaneously.
 * 
 * @param {number} userId - User ID (coach, admin, or any member)
 * @param {boolean} enableLogging - Enable detailed console logging for debugging (default: false)
 * @returns {Promise<Array>} Array of team members with hierarchy info including:
 *   - All fields from team_table
 *   - HierarchyLevel: number (0 = logged in user, 1 = direct, 2+ = nested)
 *   - IsLoggedInCoach: boolean (true only for the querying user)
 *   - HierarchyParent: UserId of parent in THIS specific hierarchy path
 */
export async function getDualCoachingTeamHierarchy(userId, enableLogging = false) {
  const supabase = getSupabaseClient();
  const userIdNum = parseInt(userId);

  // Step 1: Get the logged-in user
  const { data: user, error: userError } = await supabase
    .from('team_table')
    .select('*')
    .eq('UserId', userIdNum)
    .eq('Status', 'Active')
    .maybeSingle();

  if (userError) {
    console.error('❌ [getDualCoachingTeamHierarchy] Error fetching user:', userError);
    throw userError;
  }

  if (!user) {
    if (enableLogging) {
      console.log('⚠️ [getDualCoachingTeamHierarchy] User not found:', userIdNum);
    }
    return [];
  }

  // Step 2: Check if user has a co-coach (team partner with same TeamId)
  // If yes, both coaches should be treated as level 0 for their shared downline
  let coachPartnerIds = [userIdNum]; // Start with just this user
  
  if (user.TeamId) {
    const { data: coachTeam, error: coachTeamError } = await supabase
      .from('coach_teams_table')
      .select('CoachId, CoCoachId')
      .eq('TeamId', user.TeamId)
      .eq('Status', 'active')
      .maybeSingle();
    
    if (!coachTeamError && coachTeam) {
      // Add both coaches to the starting level
      if (coachTeam.CoachId && coachTeam.CoCoachId) {
        coachPartnerIds = [coachTeam.CoachId, coachTeam.CoCoachId];
        
        if (enableLogging) {
          console.log(`👥 [getDualCoachingTeamHierarchy] Co-coaching team detected:`, {
            TeamId: user.TeamId,
            CoachIds: coachPartnerIds
          });
        }
      }
    }
  }

  // Step 3: Fetch all team members recursively using DUAL COACHING MODEL
  // Support both CoachId and CoCoachId - members can report to 2 coaches
  const allMembers = [];
  const processedUserIds = new Map(); // Track unique users

  // Add user as level 0
  const userEntry = {
    ...user,
    HierarchyLevel: 0,
    IsLoggedInCoach: true,
    HierarchyParent: null,
  };
  allMembers.push(userEntry);
  processedUserIds.set(user.UserId, user);

  // Add co-coach partner as a special node (highlighted in UI)
  if (coachPartnerIds.length > 1) {
    const partnerId = coachPartnerIds.find(id => id !== userIdNum);
    if (partnerId) {
      const { data: partner } = await supabase
        .from('team_table')
        .select('*')
        .eq('UserId', partnerId)
        .eq('Status', 'Active')
        .maybeSingle();

      if (partner) {
        const partnerEntry = {
          ...partner,
          HierarchyLevel: 1,
          IsLoggedInCoach: false,
          IsCoCoach: true,
          HierarchyParent: userIdNum,
        };
        allMembers.push(partnerEntry);
        processedUserIds.set(partnerId, partner);
      }
    }
  }

  // Iteratively fetch team members level by level
  // Start with all co-coach partners (for shared downline)
  let currentLevelCoachIds = coachPartnerIds;
  let currentLevel = 1;
  const maxLevel = 10;

  while (currentLevelCoachIds.length > 0 && currentLevel <= maxLevel) {
    // Fetch members where CoachId matches current level coaches
    // NOTE: We query ONLY by CoachId (not CoCoachId) because coachPartnerIds already includes both coaches
    const { data: levelMembers, error: levelError } = await supabase
      .from('team_table')
      .select('*')
      .in('CoachId', currentLevelCoachIds)
      .eq('Status', 'Active');

    if (enableLogging) {
      console.log(`📊 [getDualCoachingTeamHierarchy] Level ${currentLevel} query:`, {
        searchingUnder: currentLevelCoachIds,
        foundMembers: levelMembers?.length || 0,
        memberNames: levelMembers?.map(m => m.UserName) || []
      });
    }

    if (levelError) {
      console.error('❌ [getDualCoachingTeamHierarchy] Error fetching level members:', levelError);
      break;
    }

    if (!levelMembers || levelMembers.length === 0) break;

    const nextLevelCoachIds = [];

    for (const member of levelMembers) {
      // Store unique member
      if (!processedUserIds.has(member.UserId)) {
        // Determine which coach this member reports to in THIS hierarchy path
        let hierarchyParent = member.CoachId; // Always use CoachId as the parent

        // If member's CoachId is co-coach partner, reparent under root
        // so all direct members appear flat under the logged-in coach
        if (coachPartnerIds.length > 1 && currentLevel === 1) {
          const partnerId = coachPartnerIds.find(id => id !== userIdNum);
          if (hierarchyParent === partnerId) {
            hierarchyParent = userIdNum;
          }
        }
        
        if (enableLogging) {
          console.log(`  ↳ ${member.UserName} (ID:${member.UserId}) → Parent: ${hierarchyParent} [CoachId:${member.CoachId}]`);
        }
        
        processedUserIds.set(member.UserId, member);
        allMembers.push({
          ...member,
          HierarchyLevel: currentLevel,
          IsLoggedInCoach: false,
          HierarchyParent: hierarchyParent, // Track actual parent in THIS hierarchy
        });

        // Add ALL members to next level check (not just coaches)
        // This ensures we fetch team members even if the parent's Role isn't 'coach'
        nextLevelCoachIds.push(member.UserId);
      }
    }

    currentLevelCoachIds = nextLevelCoachIds;
    currentLevel++;
  }

  // Step 4: Derive CoCoachId for all members from coach_teams_table (not team_table)
  // Bulk-fetch all coach_teams entries, then map each member's CoCoachId
  const allCoachTeamIds = [...new Set(allMembers.map(m => m.CoachTeamId).filter(Boolean))];
  const coachTeamsMap = {};
  
  if (allCoachTeamIds.length > 0) {
    const { data: coachTeams } = await supabase
      .from('coach_teams_table')
      .select('TeamId, CoachId, CoCoachId')
      .in('TeamId', allCoachTeamIds)
      .eq('Status', 'active');

    if (coachTeams) {
      coachTeams.forEach(ct => {
        coachTeamsMap[ct.TeamId] = ct;
      });
    }
  }

  // Set DerivedCoCoachId on each member (replaces legacy team_table.CoCoachId)
  for (const member of allMembers) {
    const ct = member.CoachTeamId ? coachTeamsMap[member.CoachTeamId] : null;
    if (ct) {
      // CoCoachId = the OTHER coach in the team (not the member's own CoachId)
      member.DerivedCoCoachId = ct.CoachId === member.CoachId ? ct.CoCoachId : ct.CoachId;
    } else {
      member.DerivedCoCoachId = null;
    }
    // Override legacy CoCoachId with derived value
    member.CoCoachId = member.DerivedCoCoachId;
  }

  // Step 5: Derive CoachName for all members by looking up coach's UserName
  const allCoachIds = [...new Set(allMembers.map(m => m.CoachId).filter(Boolean))];
  const coachNameMap = {};
  if (allCoachIds.length > 0) {
    const { data: coachUsers } = await supabase
      .from('team_table')
      .select('UserId, UserName')
      .in('UserId', allCoachIds);
    if (coachUsers) {
      coachUsers.forEach(c => { coachNameMap[c.UserId] = c.UserName; });
    }
  }

  // Also lookup CoCoachName from derived CoCoachId
  const allCoCoachIds = [...new Set(allMembers.map(m => m.CoCoachId).filter(Boolean))];
  const coCoachNameMap = {};
  if (allCoCoachIds.length > 0) {
    const { data: coCoachUsers } = await supabase
      .from('team_table')
      .select('UserId, UserName')
      .in('UserId', allCoCoachIds);
    if (coCoachUsers) {
      coCoachUsers.forEach(c => { coCoachNameMap[c.UserId] = c.UserName; });
    }
  }

  for (const member of allMembers) {
    member.CoachName = member.CoachId ? (coachNameMap[member.CoachId] || null) : null;
    member.CoCoachName = member.CoCoachId ? (coCoachNameMap[member.CoCoachId] || null) : null;
  }

  if (enableLogging) {
    console.log('🔍 [getDualCoachingTeamHierarchy] Team members found (dual-coaching model):', {
      count: allMembers?.length || 0,
      members: allMembers?.map(m => ({
        id: m.UserId,
        name: m.UserName,
        level: m.HierarchyLevel,
        parent: m.HierarchyParent,
        role: m.Role,
        coachId: m.CoachId,
        coCoachId: m.DerivedCoCoachId,
      })) || []
    });
  }

  return allMembers;
}

