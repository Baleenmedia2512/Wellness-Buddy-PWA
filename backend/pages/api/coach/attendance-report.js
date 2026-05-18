import { getSupabaseClient } from '../../../utils/supabaseClient.js';
import { isExemptedBeverageOnly } from '../../../utils/foodTypeDetection.js';
import { 
  getTeamHierarchy,
  getDualCoachingTeamHierarchy 
} from '../../../utils/disciplineCalculationsSupabase.js';
import { 
import logger from '../../../shared/lib/logger.js';
  formatDateForMySQL,
  getDaysBetween,
  calculateDisciplinePercentage 
} from '../../../utils/disciplineHelpers.js';

export default async function handler(req, res) {
  // Prevent browser/service worker caching.

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  
  // Handle CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cache-Control, Pragma');
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ message: 'Method not allowed' });
    return;
  }

  const { userId, startDate, endDate } = req.query;

  logger.debug('📈 [attendance-report] Request:', { userId, startDate, endDate });

  if (!userId) {
    res.status(400).json({
      success: false,
      message: 'Missing required parameter: userId',
    });
    return;
  }

  try {
    const supabase = getSupabaseClient();
    const userIdNum = parseInt(userId);

    // Get all active team members recursively using DUAL COACHING MODEL
    // This reusable utility properly tracks hierarchy paths for CoachId + CoCoachId
    const teamMembers = await getDualCoachingTeamHierarchy(userIdNum, true);
    
    if (!teamMembers || teamMembers.length === 0) {
      logger.debug('⚠️ [attendance-report] No team members found for user:', userIdNum);
      return res.status(200).json({
        success: true,
        data: {
          members: [],
          coaches: [],
          dateRange: { start: startDate || formatDateForMySQL(new Date()), end: endDate || formatDateForMySQL(new Date()) },
          teamSize: 0,
        },
      });
    }
    
    // Calculate date range
    const start = startDate || formatDateForMySQL(new Date());
    const end = endDate || formatDateForMySQL(new Date());

    logger.debug('📅 [attendance-report] Date range:', { start, end });
    logger.debug('👥 [attendance-report] Team size:', teamMembers.length);

    // Fetch discipline data for all members in bulk
    const allUserIds = teamMembers.map(m => m.UserId);
    const daysInPeriod = getDaysBetween(new Date(start), new Date(end));
    const expectedPostsPerActivity = daysInPeriod;

    logger.debug('📊 [attendance-report] Fetching discipline data for', allUserIds.length, 'members');

    const [weightData, educationData, foodData] = await Promise.all([
      // Weight records
      supabase
        .from('weight_records_table')
        .select('UserId, CreatedAt')
        .in('UserId', allUserIds)
        .gte('CreatedAt', start)
        .lte('CreatedAt', end + 'T23:59:59')
        .eq('IsDeleted', false),
      
      // Education records
      supabase
        .from('education_logs_table')
        .select('UserId, CreatedAt')
        .in('UserId', allUserIds)
        .gte('CreatedAt', start)
        .lte('CreatedAt', end + 'T23:59:59')
        .eq('IsDeleted', false),
      
      // Food/nutrition records (include AnalysisData to filter out beverage-only entries)
      supabase
        .from('food_nutrition_data_table')
        .select('UserID, CreatedAt, AnalysisData')
        .in('UserID', allUserIds.map(String))
        .gte('CreatedAt', start)
        .lte('CreatedAt', end + 'T23:59:59')
        .eq('IsDeleted', false)
    ]);

    // Filter out records that contain ONLY exempted beverages (water, coffee, tea, afresh)
    const filteredFoodData = {
      ...foodData,
      data: (foodData.data || []).filter(r => !isExemptedBeverageOnly(r.AnalysisData))
    };

    logger.debug('📊 [attendance-report] Discipline data fetched:', {
      weight: weightData.data?.length || 0,
      education: educationData.data?.length || 0,
      food: foodData.data?.length || 0,
      weightError: weightData.error ? weightData.error.message : null,
      educationError: educationData.error ? educationData.error.message : null,
      foodError: foodData.error ? foodData.error.message : null
    });

    // Helper: Check if time is within window
    const isTimeInWindow = (dateStr, windowStart, windowEnd) => {
      const date = new Date(dateStr);
      const time = date.toTimeString().slice(0, 8); // HH:MM:SS
      return time >= windowStart && time <= windowEnd;
    };

    // Helper: Get unique on-time dates
    const getUniqueOnTimeDates = (records, userId, windowStart, windowEnd, userIdField = 'UserId') => {
      const dates = new Set();
      if (!records || records.length === 0) return dates;
      records.forEach(r => {
        const userIdValue = r[userIdField] || r.UserId || r.UserID;
        const createdAt = r.CreatedAt || r.createdAt;
        if (userIdValue == userId && createdAt && isTimeInWindow(createdAt, windowStart, windowEnd)) {
          dates.add(new Date(createdAt).toISOString().split('T')[0]);
        }
      });
      return dates;
    };

    // Default time windows (using education-focused window since nutrition centres track education)
    const timeWindows = {
      weight: { start: '05:00:00', end: '09:00:00' },
      education: { start: '05:00:00', end: '23:00:00' },
      breakfast: { start: '06:00:00', end: '10:00:00' },
      lunch: { start: '11:00:00', end: '15:00:00' },
      dinner: { start: '17:00:00', end: '22:00:00' }
    };

    // Helper: Calculate discipline for a member
    const calculateMemberDiscipline = (userId) => {
      try {
        // Weight on-time
        const weightOnTime = getUniqueOnTimeDates(
          weightData.data || [], userId, timeWindows.weight.start, timeWindows.weight.end
        ).size;

        // Education on-time
        const educationOnTime = getUniqueOnTimeDates(
          educationData.data || [], userId, timeWindows.education.start, timeWindows.education.end
        ).size;

        // Meals on-time (breakfast, lunch, dinner) — uses filtered food data (no beverage-only entries)
        const breakfastOnTime = getUniqueOnTimeDates(
          filteredFoodData.data || [], userId, timeWindows.breakfast.start, timeWindows.breakfast.end, 'UserID'
        ).size;
        const lunchOnTime = getUniqueOnTimeDates(
          filteredFoodData.data || [], userId, timeWindows.lunch.start, timeWindows.lunch.end, 'UserID'
        ).size;
        const dinnerOnTime = getUniqueOnTimeDates(
          filteredFoodData.data || [], userId, timeWindows.dinner.start, timeWindows.dinner.end, 'UserID'
        ).size;

        // Total on-time posts
        const totalOnTime = weightOnTime + educationOnTime + breakfastOnTime + lunchOnTime + dinnerOnTime;
        
        // Expected posts (5 activities per day)
        const expectedPosts = expectedPostsPerActivity * 5;

        // Calculate percentage
        const disciplinePercentage = calculateDisciplinePercentage(totalOnTime, expectedPosts);

        return {
          disciplinePercentage,
          weightOnTime,
          educationOnTime,
          breakfastOnTime,
          lunchOnTime,
          dinnerOnTime,
          totalOnTime,
          expectedPosts
        };
      } catch (error) {
        console.error('⚠️ [attendance-report] Error calculating discipline for user', userId, error);
        return {
          disciplinePercentage: 0,
          weightOnTime: 0,
          educationOnTime: 0,
          breakfastOnTime: 0,
          lunchOnTime: 0,
          dinnerOnTime: 0,
          totalOnTime: 0,
          expectedPosts: expectedPostsPerActivity * 5
        };
      }
    };

    // Helper: Calculate full team count recursively (dual-coaching model)
    // Includes circular reference protection
    const calculateFullTeamCount = (userId, members, visited = new Set()) => {
      // Prevent circular references
      if (visited.has(userId)) {
        console.warn(`⚠️ [attendance-report] Circular reference detected in calculateFullTeamCount for userId: ${userId}`);
        return 0;
      }
      
      // Add current user to visited set for this path
      const newVisited = new Set(visited);
      newVisited.add(userId);
      
      const directTeam = members.filter(m => 
        (m.CoachId === userId || m.CoCoachId === userId) && m.UserId !== userId
      );
      let fullCount = directTeam.length;
      
      directTeam.forEach(member => {
        fullCount += calculateFullTeamCount(member.UserId, members, newVisited);
      });
      
      return fullCount;
    };

    // Build hierarchical attendance data
    const attendanceData = await Promise.all(
      teamMembers.map(async (member) => {
        // Calculate discipline metrics FIRST (this includes education on-time days)
        const discipline = calculateMemberDiscipline(member.UserId);

        // Use the education on-time days from discipline for attendance calculation
        // This ensures consistency between discipline and attendance
        const educationOnTimeDays = discipline.educationOnTime;

        // Get ALL education logs for this member to determine club vs remote breakdown
        const { data: allEducationLogs, error: allLogsError } = await supabase
          .from('education_logs_table')
          .select('id, attendance_type, CreatedAt')
          .eq('UserId', member.UserId)
          .eq('IsDeleted', false)
          .gte('CreatedAt', start)
          .lte('CreatedAt', end + 'T23:59:59');

        if (allLogsError) {
          console.error('⚠️ [attendance-report] Error fetching education logs for user', member.UserId, ':', allLogsError);
        }

        // Count unique days by club/remote for on-time education logs only
        const onTimeClubDays = new Set();
        const onTimeRemoteDays = new Set();
        
        if (allEducationLogs && allEducationLogs.length > 0) {
          allEducationLogs.forEach(log => {
            // Check if this education log is on-time (within time window)
            const isOnTime = log.CreatedAt && isTimeInWindow(log.CreatedAt, timeWindows.education.start, timeWindows.education.end);
            
            if (isOnTime) {
              const logDate = new Date(log.CreatedAt).toISOString().split('T')[0];
              
              // Count unique days by attendance type (only on-time logs)
              if (log.attendance_type === 'club') {
                onTimeClubDays.add(logDate);
              } else {
                // 'remote' or NULL = remote
                onTimeRemoteDays.add(logDate);
              }
            }
          });
        }

        const totalEducation = allEducationLogs?.length || 0;

        logger.debug(`📊 [attendance-report] User ${member.UserName} (${member.UserId}):`, {
          totalEducationLogs: totalEducation,
          educationOnTimeDays,
          clubDays: onTimeClubDays.size,
          remoteDays: onTimeRemoteDays.size,
          disciplineEducationOnTime: discipline.educationOnTime,
          timeWindow: `${timeWindows.education.start} - ${timeWindows.education.end}`,
          sampleLog: allEducationLogs?.[0] || null
        });

        // Calculate days in range
        const startDateObj = new Date(start);
        const endDateObj = new Date(end);
        const daysInRange = Math.ceil((endDateObj - startDateObj) / (1000 * 60 * 60 * 24)) + 1;

        // Calculate attendance percentage based on education on-time days from discipline
        // This uses the SAME calculation as discipline's education component
        // Logic: If education is logged on time for a day = 100% attendance for that day
        //        If education is NOT logged on time for a day = 0% attendance for that day
        const attendancePercentage = daysInRange > 0 
          ? Math.round((educationOnTimeDays / daysInRange) * 100) 
          : 0;

        // Calculate team counts (dual-coaching model)
        const directTeamCount = teamMembers.filter(m => 
          m.CoachId === member.UserId || m.CoCoachId === member.UserId
        ).length;
        const fullTeamCount = calculateFullTeamCount(member.UserId, teamMembers);

        return {
          userId: member.UserId,
          userName: member.UserName,
          email: member.Email,
          role: member.Role,
          hierarchyLevel: member.HierarchyLevel,
          uplineCoachId: member.HierarchyParent || null, // Use the tracked parent from hierarchy
          isLoggedInCoach: member.IsLoggedInCoach,
          
          // Attendance metrics (based on unique on-time days)
          clubAttendance: onTimeClubDays.size,
          remoteAttendance: onTimeRemoteDays.size,
          totalEducation: totalEducation,
          attendancePercentage,
          daysInRange,

          // Discipline metrics
          disciplinePercentage: discipline.disciplinePercentage,
          disciplineBreakdown: {
            weight: discipline.weightOnTime,
            education: discipline.educationOnTime,
            breakfast: discipline.breakfastOnTime,
            lunch: discipline.lunchOnTime,
            dinner: discipline.dinnerOnTime,
            total: discipline.totalOnTime,
            expected: discipline.expectedPosts
          },

          // Team counts
          directTeamCount,
          fullTeamCount
        };
      })
    );

    // Calculate coach-level summaries (dual-coaching model)
    const coaches = attendanceData.filter(m => m.role === 'coach' || m.role === 'admin' || m.role === 'developer');
    const coachSummaries = coaches.map(coach => {
      // Find members where this coach is CoachId OR CoCoachId
      const directTeam = attendanceData.filter(m => {
        const member = teamMembers.find(tm => tm.UserId === m.userId);
        return member && (member.CoachId === coach.userId || member.CoCoachId === coach.userId);
      });
      const directTeamSize = directTeam.length;
      
      const avgAttendance = directTeamSize > 0
        ? Math.round(
            directTeam.reduce((sum, m) => sum + m.attendancePercentage, 0) / directTeamSize
          )
        : 0;

      return {
        ...coach,
        directTeamSize,
        avgTeamAttendance: avgAttendance,
      };
    });

    logger.debug('✅ [attendance-report] Generated report for', attendanceData.length, 'members');
    logger.debug('📤 [attendance-report] Returning response with:', {
      memberCount: attendanceData.length,
      coachCount: coachSummaries.length,
      teamSize: teamMembers.length,
      sampleMember: attendanceData[0] ? {
        userId: attendanceData[0].userId,
        name: attendanceData[0].userName,
        uplineCoachId: attendanceData[0].uplineCoachId,
        discipline: attendanceData[0].disciplinePercentage,
        attendance: attendanceData[0].attendancePercentage,
        clubAttendance: attendanceData[0].clubAttendance,
        remoteAttendance: attendanceData[0].remoteAttendance,
        directTeam: attendanceData[0].directTeamCount,
        fullTeam: attendanceData[0].fullTeamCount
      } : null,
      allMemberNames: attendanceData.map(m => m.userName)
    });

    res.status(200).json({
      success: true,
      data: {
        members: attendanceData,
        coaches: coachSummaries,
        dateRange: { start, end },
        teamSize: teamMembers.length,
      },
    });

  } catch (error) {
    console.error('❌ [attendance-report] Error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }

}
