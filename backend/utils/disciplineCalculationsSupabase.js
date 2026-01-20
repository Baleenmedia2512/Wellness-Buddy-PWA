/**
 * Discipline Calculations using Supabase REST API
 * Replacement for disciplineCalculations.js that works through firewalls
 */

import { getSupabaseClient } from './supabaseClient.js';
import { normalizeTimestamp } from './timestampUtils.js';
import { formatDateForMySQL, getDaysBetween } from './disciplineHelpers.js';

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
    .select('"UserId", "UserName", "Email", "Role", "EntryDateTime", "UplineCoachId"')
    .eq('"UserId"', coachId)
    .eq('"Status"', 'active')
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
    IsLoggedInCoach: true,
    UplineCoachName: null
  }];
  
  // Recursive function to get team members at each level
  async function getTeamAtLevel(parentIds, level, maxLevel = 10) {
    if (level > maxLevel || parentIds.length === 0) {
      return [];
    }
    
    const { data: members, error } = await supabase
      .from('team_table')
      .select('"UserId", "UserName", "Email", "Role", "EntryDateTime", "UplineCoachId"')
      .in('"UplineCoachId"', parentIds)
      .eq('"Status"', 'active');
    
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
      .filter(m => m.Role === 'coach')
      .map(m => m.UserId);
    
    const nextLevelMembers = await getTeamAtLevel(coachIds, level + 1, maxLevel);
    
    return [...membersWithLevel, ...nextLevelMembers];
  }
  
  // Get all team members recursively
  const teamMembers = await getTeamAtLevel([coachId], 1);
  allMembers.push(...teamMembers);
  
  // Fetch upline coach names for all members
  const uplineCoachIds = [...new Set(allMembers.map(m => m.UplineCoachId).filter(Boolean))];
  
  if (uplineCoachIds.length > 0) {
    const { data: coaches } = await supabase
      .from('team_table')
      .select('"UserId", "UserName"')
      .in('"UserId"', uplineCoachIds);
    
    const coachNameMap = {};
    if (coaches) {
      coaches.forEach(c => {
        coachNameMap[c.UserId] = c.UserName;
      });
    }
    
    // Add upline coach names
    allMembers.forEach(m => {
      if (m.UplineCoachId) {
        m.UplineCoachName = coachNameMap[m.UplineCoachId] || null;
      }
    });
  }
  
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
 * @returns {Object} Discipline data
 */
export async function calculateMemberDisciplineSupabase(userId, startDate, endDate, timeWindows) {
  const supabase = getSupabaseClient();
  const startDateStr = formatDateForMySQL(startDate);
  const endDateStr = formatDateForMySQL(endDate);
  const daysInPeriod = getDaysBetween(startDate, endDate);
  
  // Get weight records
  const { data: weightRecords } = await supabase
    .from('weight_records_table')
    .select('"CreatedAt"')
    .eq('"UserId"', userId)
    .eq('"IsDeleted"', false)
    .gte('"CreatedAt"', `${startDateStr}T00:00:00`)
    .lte('"CreatedAt"', `${endDateStr}T23:59:59`);
  
  // Get education logs
  const { data: educationLogs } = await supabase
    .from('education_logs_table')
    .select('"CreatedAt"')
    .eq('"UserId"', userId)
    .eq('"IsDeleted"', false)
    .gte('"CreatedAt"', `${startDateStr}T00:00:00`)
    .lte('"CreatedAt"', `${endDateStr}T23:59:59`);
  
  // Get nutrition data
  const { data: nutritionRecords } = await supabase
    .from('food_nutrition_data_table')
    .select('"CreatedAt"')
    .eq('"UserID"', String(userId))
    .eq('"IsDeleted"', false)
    .gte('"CreatedAt"', `${startDateStr}T00:00:00`)
    .lte('"CreatedAt"', `${endDateStr}T23:59:59`);
  
  // Helper to check if time is within window
  const isWithinWindow = (createdAt, window) => {
    if (!window || !createdAt) return false;
    const time = new Date(createdAt).toTimeString().substring(0, 8);
    return time >= window.start && time <= window.end;
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
    
    return {
      totalDays: uniqueDates.size,
      onTimeDays: onTimeDates.size
    };
  };
  
  // Helper to categorize meal by time
  const getMealType = (createdAt) => {
    if (!createdAt) return null;
    const time = new Date(createdAt).toTimeString().substring(0, 8);
    
    const breakfast = timeWindows.breakfast || { start: '05:30:00', end: '08:30:00' };
    const lunch = timeWindows.lunch || { start: '12:00:00', end: '16:00:00' };
    const dinner = timeWindows.dinner || { start: '17:30:00', end: '20:30:00' };
    
    if (time >= breakfast.start && time <= breakfast.end) return 'breakfast';
    if (time >= lunch.start && time <= lunch.end) return 'lunch';
    if (time >= dinner.start && time <= dinner.end) return 'dinner';
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
