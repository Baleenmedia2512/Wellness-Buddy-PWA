import { getSupabaseClient } from '../../../utils/supabaseClient.js';
import { 
  parseDateRange, 
  calculateExpectedPosts,
  calculateDisciplinePercentage,
  getDaysBetween,
  formatDateForMySQL
} from '../../../utils/disciplineHelpers.js';

/**
 * API: Get Coach Discipline Report
 * Returns discipline percentages for all team members
 * Uses Supabase REST API (consistent with other working APIs)
 */
export default async function handler(req, res) {
  // Prevent browser/service worker caching of dynamic data
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  
  // Handle CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, cache-control, pragma');
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ success: false, message: 'Method not allowed' });
    return;
  }
  
  try {
    const { coachId, dateRange, startDate, endDate } = req.query;
    
    // Validation
    if (!coachId) {
      res.status(400).json({ success: false, message: 'Coach ID required' });
      return;
    }
    
    if (!dateRange) {
      res.status(400).json({ success: false, message: 'Date range required' });
      return;
    }
    
    // Parse date range
    const dates = parseDateRange(
      dateRange, 
      dateRange === 'custom' ? startDate : null,
      dateRange === 'custom' ? endDate : null
    );
    
    // Validate custom date range
    if (dateRange === 'custom') {
      if (!startDate || !endDate) {
        res.status(400).json({ 
          success: false, 
          message: 'Custom date range requires both startDate and endDate' 
        });
        return;
      }
      if (dates.start > dates.end) {
        res.status(400).json({ 
          success: false, 
          message: 'Start date must be before or equal to end date' 
        });
        return;
      }
    }
    
    const supabase = getSupabaseClient();
    const coachIdInt = parseInt(coachId);
    
    // Step 1: Get the coach first
    const { data: coach, error: coachError } = await supabase
      .from('team_table')
      .select('*')
      .eq('UserId', coachIdInt)
      .eq('Status', 'Active')
      .maybeSingle();
    
    if (coachError || !coach) {
      console.error('Coach not found:', coachError);
      res.status(404).json({ success: false, message: 'Coach not found' });
      return;
    }
    
    // Step 2: Get all active team members recursively using iterative approach
    // (Supabase REST API doesn't support recursive CTEs, so we do it in JS)
    const allMembers = [];
    const seenUserIds = new Set();
    
    // Add coach as level 0
    allMembers.push({
      ...coach,
      HierarchyLevel: 0,
      IsLoggedInCoach: true,
      UplineCoachName: null
    });
    seenUserIds.add(coach.UserId);
    
    // Iteratively fetch team members level by level
    let currentLevelCoachIds = [coachIdInt];
    let currentLevel = 1;
    const maxLevel = 10;
    
    while (currentLevelCoachIds.length > 0 && currentLevel <= maxLevel) {
      const { data: levelMembers, error: levelError } = await supabase
        .from('team_table')
        .select('*')
        .in('UplineCoachId', currentLevelCoachIds)
        .eq('Status', 'Active');
      
      if (levelError) {
        console.error('Error fetching level members:', levelError);
        break;
      }
      
      if (!levelMembers || levelMembers.length === 0) break;
      
      const nextLevelCoachIds = [];
      
      for (const member of levelMembers) {
        if (!seenUserIds.has(member.UserId)) {
          seenUserIds.add(member.UserId);
          
          // Find upline coach name
          const uplineCoach = allMembers.find(m => m.UserId === member.UplineCoachId);
          
          allMembers.push({
            ...member,
            HierarchyLevel: currentLevel,
            IsLoggedInCoach: false,
            UplineCoachName: uplineCoach?.UserName || null
          });
          
          // If this member is a coach, add to next level search
          if (member.Role === 'coach') {
            nextLevelCoachIds.push(member.UserId);
          }
        }
      }
      
      currentLevelCoachIds = nextLevelCoachIds;
      currentLevel++;
    }
    
    // Step 3: Get time windows
    const { data: timeWindows, error: twError } = await supabase
      .from('activity_time_windows_table')
      .select('*')
      .is('EffectiveToDate', null);
    
    if (twError) {
      console.error('Error fetching time windows:', twError);
    }
    
    // Create time window map
    const timeWindowMap = {};
    (timeWindows || []).forEach(tw => {
      timeWindowMap[tw.ActivityType] = {
        start: tw.WindowStartTime,
        end: tw.WindowEndTime
      };
    });
    
    // Meal windows for discipline calculation
    const mealWindows = {
      breakfast: timeWindowMap.breakfast || { start: '05:30:00', end: '08:30:00' },
      lunch: timeWindowMap.lunch || { start: '12:00:00', end: '16:00:00' },
      dinner: timeWindowMap.dinner || { start: '17:30:00', end: '20:30:00' }
    };
    
    // Step 4: Calculate discipline for all members
    const startDateStr = formatDateForMySQL(dates.start);
    const endDateStr = formatDateForMySQL(dates.end);
    const allUserIds = allMembers.map(m => m.UserId);
    
    // Fetch all required data in bulk for efficiency
    const [weightData, educationData, foodData] = await Promise.all([
      // Weight records
      supabase
        .from('weight_records_table')
        .select('UserId, CreatedAt')
        .in('UserId', allUserIds)
        .gte('CreatedAt', startDateStr)
        .lte('CreatedAt', endDateStr + 'T23:59:59')
        .eq('IsDeleted', 0),
      
      // Education records
      supabase
        .from('education_logs_table')
        .select('UserId, CreatedAt')
        .in('UserId', allUserIds)
        .gte('CreatedAt', startDateStr)
        .lte('CreatedAt', endDateStr + 'T23:59:59')
        .eq('IsDeleted', 0),
      
      // Food/nutrition records
      supabase
        .from('food_nutrition_data_table')
        .select('UserID, CreatedAt')
        .in('UserID', allUserIds.map(String))
        .gte('CreatedAt', startDateStr)
        .lte('CreatedAt', endDateStr + 'T23:59:59')
        .eq('IsDeleted', 0)
    ]);
    
    // Process discipline data for each member
    const daysInPeriod = getDaysBetween(dates.start, dates.end);
    const expectedPostsPerActivity = daysInPeriod;
    
    // Helper to check if time is within window
    const isTimeInWindow = (dateStr, windowStart, windowEnd) => {
      const date = new Date(dateStr);
      const time = date.toTimeString().slice(0, 8); // HH:MM:SS
      return time >= windowStart && time <= windowEnd;
    };
    
    // Helper to get unique dates
    const getUniqueDates = (records, userId, userIdField = 'UserId') => {
      const dates = new Set();
      records.forEach(r => {
        if (r[userIdField] == userId) {
          dates.add(new Date(r.CreatedAt).toISOString().split('T')[0]);
        }
      });
      return dates;
    };
    
    // Helper to get unique on-time dates
    const getUniqueOnTimeDates = (records, userId, windowStart, windowEnd, userIdField = 'UserId') => {
      const dates = new Set();
      records.forEach(r => {
        if (r[userIdField] == userId && isTimeInWindow(r.CreatedAt, windowStart, windowEnd)) {
          dates.add(new Date(r.CreatedAt).toISOString().split('T')[0]);
        }
      });
      return dates;
    };
    
    // Calculate discipline for each member
    const disciplineData = allMembers.map(member => {
      const userId = member.UserId;
      
      // Weight
      const weightDates = getUniqueDates(weightData.data || [], userId);
      const weightWindow = timeWindowMap.weight || { start: '05:00:00', end: '09:00:00' };
      const weightOnTimeDates = getUniqueOnTimeDates(
        weightData.data || [], userId, weightWindow.start, weightWindow.end
      );
      
      // Education
      const educationDates = getUniqueDates(educationData.data || [], userId);
      const educationWindow = timeWindowMap.education || { start: '05:00:00', end: '23:00:00' };
      const educationOnTimeDates = getUniqueOnTimeDates(
        educationData.data || [], userId, educationWindow.start, educationWindow.end
      );
      
      // Meals - need to filter by time to determine meal type
      const getMealData = (mealWindow) => {
        const dates = new Set();
        const onTimeDates = new Set();
        
        (foodData.data || []).forEach(r => {
          if (r.UserID == userId) {
            const date = new Date(r.CreatedAt);
            const time = date.toTimeString().slice(0, 8);
            
            // Check if this record falls within the meal window
            if (time >= mealWindow.start && time <= mealWindow.end) {
              dates.add(date.toISOString().split('T')[0]);
              onTimeDates.add(date.toISOString().split('T')[0]); // If in window, it's on-time
            }
          }
        });
        
        return { dates, onTimeDates };
      };
      
      const breakfastData = getMealData(mealWindows.breakfast);
      const lunchData = getMealData(mealWindows.lunch);
      const dinnerData = getMealData(mealWindows.dinner);
      
      return {
        userId,
        weight: {
          totalPosts: weightDates.size,
          onTimePosts: weightOnTimeDates.size,
          expectedPosts: expectedPostsPerActivity
        },
        education: {
          totalPosts: educationDates.size,
          onTimePosts: educationOnTimeDates.size,
          expectedPosts: expectedPostsPerActivity
        },
        breakfast: {
          totalPosts: breakfastData.dates.size,
          onTimePosts: breakfastData.onTimeDates.size,
          expectedPosts: expectedPostsPerActivity
        },
        lunch: {
          totalPosts: lunchData.dates.size,
          onTimePosts: lunchData.onTimeDates.size,
          expectedPosts: expectedPostsPerActivity
        },
        dinner: {
          totalPosts: dinnerData.dates.size,
          onTimePosts: dinnerData.onTimeDates.size,
          expectedPosts: expectedPostsPerActivity
        }
      };
    });
    
    // Step 5: Separate coach from team members
    const loggedInCoach = allMembers.find(m => m.IsLoggedInCoach);
    const teamMembers = allMembers.filter(m => !m.IsLoggedInCoach);
    
    if (allMembers.length === 0) {
      res.status(200).json({
        success: true,
        source: 'realtime',
        lastUpdated: new Date().toISOString(),
        coachId: coachIdInt,
        dateRange,
        startDate: dates.start.toISOString().split('T')[0],
        endDate: dates.end.toISOString().split('T')[0],
        coachPerformance: null,
        teamMembers: [],
        coachFilters: [],
        teamSummary: {
          totalMembers: 0,
          totalTeamMembers: 0,
          totalCoaches: 0,
          averagePeriodDiscipline: 0,
          topPerformer: null,
          needsAttention: []
        }
      });
      return;
    }
    
    // Helper function to build coach filter options
    const buildCoachFilters = (allMembers, loggedInCoachId) => {
      const filters = [];
      
      // Add "My Team" filter (logged-in coach's direct members)
      const myTeamCount = allMembers.filter(m => 
        m.UplineCoachId === loggedInCoachId && !m.IsLoggedInCoach
      ).length;
      
      if (myTeamCount > 0) {
        filters.push({
          coachId: loggedInCoachId,
          coachName: 'My Team',
          memberCount: myTeamCount,
          isMyTeam: true
        });
      }
      
      // Add other sub-coaches' teams
      allMembers.forEach(member => {
        if (member.Role === 'coach' && !member.IsLoggedInCoach) {
          const teamCount = allMembers.filter(m => m.UplineCoachId === member.UserId).length;
          if (teamCount > 0) {
            filters.push({
              coachId: member.UserId,
              coachName: `${member.UserName}'s Team`,
              memberCount: teamCount,
              isMyTeam: false
            });
          }
        }
      });
      
      return filters;
    };
    
    // Helper function to format time for display (HH:MM:SS -> h:MM AM/PM)
    const formatTimeForDisplay = (timeStr) => {
      if (!timeStr) return '';
      const [hours, minutes] = timeStr.split(':');
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      return `${displayHour}:${minutes} ${ampm}`;
    };
    
    // Step 6: Build coach filters
    const coachFilters = buildCoachFilters(allMembers, coachIdInt);
    
    // Step 7: Format logged-in coach's performance data
    let coachPerformanceData = null;
    if (loggedInCoach) {
      const coachDiscipline = disciplineData.find(d => d.userId === loggedInCoach.UserId);
      
      if (coachDiscipline) {
        const coachTotalOnTimePosts = 
          (coachDiscipline.weight?.onTimePosts || 0) +
          (coachDiscipline.education?.onTimePosts || 0) +
          (coachDiscipline.breakfast?.onTimePosts || 0) +
          (coachDiscipline.lunch?.onTimePosts || 0) +
          (coachDiscipline.dinner?.onTimePosts || 0);
        
        const coachTotalExpectedPosts = calculateExpectedPosts(dates.start, dates.end);
        
        coachPerformanceData = {
          userId: loggedInCoach.UserId,
          userName: loggedInCoach.UserName,
          email: loggedInCoach.Email,
          role: loggedInCoach.Role,
          joinedDate: loggedInCoach.EntryDateTime,
          isLoggedInCoach: true,
          uplineCoachId: loggedInCoach.UplineCoachId,
          uplineCoachName: loggedInCoach.UplineCoachName || 'None',
          hierarchyLevel: loggedInCoach.HierarchyLevel,
          periodDiscipline: {
            percentage: calculateDisciplinePercentage(
              coachTotalOnTimePosts,
              coachTotalExpectedPosts
            ),
            onTimePosts: coachTotalOnTimePosts,
            expectedPosts: coachTotalExpectedPosts,
            daysInPeriod: daysInPeriod
          },
          period: {
            percentage: calculateDisciplinePercentage(
              coachTotalOnTimePosts,
              coachTotalExpectedPosts
            ),
            onTimePosts: coachTotalOnTimePosts,
            expectedPosts: coachTotalExpectedPosts
          },
          activities: {
            weight: {
              percentage: calculateDisciplinePercentage(
                coachDiscipline.weight?.onTimePosts || 0,
                coachDiscipline.weight?.expectedPosts || 0
              ),
              onTimePosts: coachDiscipline.weight?.onTimePosts || 0,
              expectedPosts: coachDiscipline.weight?.expectedPosts || 0,
              targetWindow: timeWindowMap.weight 
                ? `${formatTimeForDisplay(timeWindowMap.weight.start)} - ${formatTimeForDisplay(timeWindowMap.weight.end)}`
                : 'Not Set'
            },
            education: {
              percentage: calculateDisciplinePercentage(
                coachDiscipline.education?.onTimePosts || 0,
                coachDiscipline.education?.expectedPosts || 0
              ),
              onTimePosts: coachDiscipline.education?.onTimePosts || 0,
              expectedPosts: coachDiscipline.education?.expectedPosts || 0,
              targetWindow: timeWindowMap.education 
                ? `${formatTimeForDisplay(timeWindowMap.education.start)} - ${formatTimeForDisplay(timeWindowMap.education.end)}`
                : 'Not Set'
            },
            breakfast: {
              percentage: calculateDisciplinePercentage(
                coachDiscipline.breakfast?.onTimePosts || 0,
                coachDiscipline.breakfast?.expectedPosts || 0
              ),
              onTimePosts: coachDiscipline.breakfast?.onTimePosts || 0,
              expectedPosts: coachDiscipline.breakfast?.expectedPosts || 0,
              targetWindow: timeWindowMap.breakfast 
                ? `${formatTimeForDisplay(timeWindowMap.breakfast.start)} - ${formatTimeForDisplay(timeWindowMap.breakfast.end)}`
                : 'Not Set'
            },
            lunch: {
              percentage: calculateDisciplinePercentage(
                coachDiscipline.lunch?.onTimePosts || 0,
                coachDiscipline.lunch?.expectedPosts || 0
              ),
              onTimePosts: coachDiscipline.lunch?.onTimePosts || 0,
              expectedPosts: coachDiscipline.lunch?.expectedPosts || 0,
              targetWindow: timeWindowMap.lunch 
                ? `${formatTimeForDisplay(timeWindowMap.lunch.start)} - ${formatTimeForDisplay(timeWindowMap.lunch.end)}`
                : 'Not Set'
            },
            dinner: {
              percentage: calculateDisciplinePercentage(
                coachDiscipline.dinner?.onTimePosts || 0,
                coachDiscipline.dinner?.expectedPosts || 0
              ),
              onTimePosts: coachDiscipline.dinner?.onTimePosts || 0,
              expectedPosts: coachDiscipline.dinner?.expectedPosts || 0,
              targetWindow: timeWindowMap.dinner 
                ? `${formatTimeForDisplay(timeWindowMap.dinner.start)} - ${formatTimeForDisplay(timeWindowMap.dinner.end)}`
                : 'Not Set'
            }
          }
        };
      }
    }
    
    // Step 8: Format response data (team members only, exclude coach)
    const formattedTeamMembers = teamMembers.map(member => {
      const discipline = disciplineData.find(d => d.userId === member.UserId);
      
      if (!discipline) {
        return null;
      }
      
      const isCoach = member.Role === 'coach';
      const subTeamCount = isCoach 
        ? allMembers.filter(m => m.UplineCoachId === member.UserId).length 
        : 0;
      
      const activities = {
        weight: {
          percentage: calculateDisciplinePercentage(
            discipline.weight?.onTimePosts || 0,
            discipline.weight?.expectedPosts || 0
          ),
          onTimePosts: discipline.weight?.onTimePosts || 0,
          expectedPosts: discipline.weight?.expectedPosts || 0,
          targetWindow: timeWindowMap.weight 
            ? `${formatTimeForDisplay(timeWindowMap.weight.start)} - ${formatTimeForDisplay(timeWindowMap.weight.end)}`
            : 'Not Set'
        },
        education: {
          percentage: calculateDisciplinePercentage(
            discipline.education?.onTimePosts || 0,
            discipline.education?.expectedPosts || 0
          ),
          onTimePosts: discipline.education?.onTimePosts || 0,
          expectedPosts: discipline.education?.expectedPosts || 0,
          targetWindow: timeWindowMap.education 
            ? `${formatTimeForDisplay(timeWindowMap.education.start)} - ${formatTimeForDisplay(timeWindowMap.education.end)}`
            : 'Not Set'
        },
        breakfast: {
          percentage: calculateDisciplinePercentage(
            discipline.breakfast?.onTimePosts || 0,
            discipline.breakfast?.expectedPosts || 0
          ),
          onTimePosts: discipline.breakfast?.onTimePosts || 0,
          expectedPosts: discipline.breakfast?.expectedPosts || 0,
          targetWindow: timeWindowMap.breakfast 
            ? `${formatTimeForDisplay(timeWindowMap.breakfast.start)} - ${formatTimeForDisplay(timeWindowMap.breakfast.end)}`
            : 'Not Set'
        },
        lunch: {
          percentage: calculateDisciplinePercentage(
            discipline.lunch?.onTimePosts || 0,
            discipline.lunch?.expectedPosts || 0
          ),
          onTimePosts: discipline.lunch?.onTimePosts || 0,
          expectedPosts: discipline.lunch?.expectedPosts || 0,
          targetWindow: timeWindowMap.lunch 
            ? `${formatTimeForDisplay(timeWindowMap.lunch.start)} - ${formatTimeForDisplay(timeWindowMap.lunch.end)}`
            : 'Not Set'
        },
        dinner: {
          percentage: calculateDisciplinePercentage(
            discipline.dinner?.onTimePosts || 0,
            discipline.dinner?.expectedPosts || 0
          ),
          onTimePosts: discipline.dinner?.onTimePosts || 0,
          expectedPosts: discipline.dinner?.expectedPosts || 0,
          targetWindow: timeWindowMap.dinner 
            ? `${formatTimeForDisplay(timeWindowMap.dinner.start)} - ${formatTimeForDisplay(timeWindowMap.dinner.end)}`
            : 'Not Set'
        }
      };
      
      const totalOnTimePosts = 
        (discipline.weight?.onTimePosts || 0) +
        (discipline.education?.onTimePosts || 0) +
        (discipline.breakfast?.onTimePosts || 0) +
        (discipline.lunch?.onTimePosts || 0) +
        (discipline.dinner?.onTimePosts || 0);
      
      const totalExpectedPosts = calculateExpectedPosts(dates.start, dates.end);
      const periodDisciplinePercentage = calculateDisciplinePercentage(
        totalOnTimePosts,
        totalExpectedPosts
      );
      
      return {
        userId: member.UserId,
        userName: member.UserName,
        email: member.Email,
        role: member.Role,
        isCoach: isCoach,
        isLoggedInCoach: false,
        subTeamCount: subTeamCount,
        uplineCoachId: member.UplineCoachId,
        uplineCoachName: member.UplineCoachName,
        hierarchyLevel: member.HierarchyLevel,
        profileImage: null,
        joinedDate: member.EntryDateTime,
        periodDiscipline: {
          percentage: periodDisciplinePercentage,
          expectedPosts: totalExpectedPosts,
          onTimePosts: totalOnTimePosts,
          daysInPeriod: daysInPeriod
        },
        activities
      };
    }).filter(m => m !== null);
    
    // Step 9: Calculate team summary
    const allMembersForStats = [];
    if (coachPerformanceData) {
      allMembersForStats.push(coachPerformanceData);
    }
    allMembersForStats.push(...formattedTeamMembers);
    
    const avgPeriodDiscipline = allMembersForStats.length > 0
      ? allMembersForStats.reduce((sum, m) => sum + m.periodDiscipline.percentage, 0) / allMembersForStats.length
      : 0;
    
    const topPerformer = allMembersForStats.length > 0
      ? allMembersForStats.reduce((max, m) => 
          m.periodDiscipline.percentage > max.periodDiscipline.percentage ? m : max
        )
      : null;
    
    const needsAttention = allMembersForStats.filter(m => m.periodDiscipline.percentage < 60);
    
    // Step 10: Return response
    res.status(200).json({
      success: true,
      source: 'realtime',
      lastUpdated: new Date().toISOString(),
      coachId: coachIdInt,
      dateRange,
      startDate: dates.start.toISOString().split('T')[0],
      endDate: dates.end.toISOString().split('T')[0],
      coachPerformance: coachPerformanceData,
      teamMembers: formattedTeamMembers,
      coachFilters: coachFilters,
      teamSummary: {
        totalMembers: allMembers.length,
        totalTeamMembers: formattedTeamMembers.length,
        totalCoaches: coachFilters.length,
        averagePeriodDiscipline: Math.round(avgPeriodDiscipline * 10) / 10,
        topPerformer: topPerformer ? {
          userId: topPerformer.userId,
          userName: topPerformer.userName,
          discipline: topPerformer.periodDiscipline.percentage
        } : null,
        needsAttention: needsAttention.map(m => ({
          userId: m.userId,
          userName: m.userName,
          discipline: m.periodDiscipline.percentage,
          reason: 'Below 60% threshold'
        }))
      }
    });
    return;
    
  } catch (error) {
    console.error('❌ Discipline report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve discipline report',
      error: error.message
    });
    return;
  }
}
