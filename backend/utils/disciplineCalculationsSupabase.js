/**
 * Discipline Calculations using Supabase REST API
 * Replacement for disciplineCalculations.js that works through firewalls
 */

import { getSupabaseClient } from './supabaseClient.js';
import { normalizeTimestamp } from './timestampUtils.js';
import { formatDateForMySQL, getDaysBetween } from './disciplineHelpers.js';
import { convertISTToUserLocalTime } from './timezoneConverter.js';

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

