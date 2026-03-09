import { getSupabaseClient } from '../../../utils/supabaseClient.js';
import { getTeamHierarchy } from '../../../utils/disciplineCalculationsSupabase.js';
import { 
  formatDateForMySQL,
  getDaysBetween,
  calculateDisciplinePercentage 
} from '../../../utils/disciplineHelpers.js';

export default async function handler(req, res) {
  // Prevent browser/service worker caching
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

  console.log('📈 [attendance-report] Request:', { userId, startDate, endDate });

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

    // Get team hierarchy
    const teamMembers = await getTeamHierarchy(userIdNum);
    
    console.log('🔍 [attendance-report] Team members returned from getTeamHierarchy:', {
      count: teamMembers?.length || 0,
      members: teamMembers?.map(m => ({ id: m.UserId, name: m.UserName, role: m.Role, upline: m.UplineCoachId })) || []
    });
    
    if (!teamMembers || teamMembers.length === 0) {
      console.log('⚠️ [attendance-report] No team members found for user:', userIdNum);
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

    console.log('📅 [attendance-report] Date range:', { start, end });
    console.log('👥 [attendance-report] Team size:', teamMembers.length);

    // Fetch discipline data for all members in bulk
    const allUserIds = teamMembers.map(m => m.UserId);
    const daysInPeriod = getDaysBetween(new Date(start), new Date(end));
    const expectedPostsPerActivity = daysInPeriod;

    console.log('📊 [attendance-report] Fetching discipline data for', allUserIds.length, 'members');

    const [weightData, educationData, foodData] = await Promise.all([
      // Weight records
      supabase
        .from('weight_records_table')
        .select('"UserId", "CreatedAt"')
        .in('"UserId"', allUserIds)
        .gte('"CreatedAt"', start + 'T00:00:00')
        .lte('"CreatedAt"', end + 'T23:59:59')
        .eq('"IsDeleted"', false),
      
      // Education records
      supabase
        .from('education_logs_table')
        .select('"UserId", "CreatedAt"')
        .in('"UserId"', allUserIds)
        .gte('"CreatedAt"', start + 'T00:00:00')
        .lte('"CreatedAt"', end + 'T23:59:59')
        .eq('"IsDeleted"', false),
      
      // Food/nutrition records
      supabase
        .from('food_nutrition_data_table')
        .select('"UserID", "CreatedAt"')
        .in('"UserID"', allUserIds.map(String))
        .gte('"CreatedAt"', start + 'T00:00:00')
        .lte('"CreatedAt"', end + 'T23:59:59')
        .eq('"IsDeleted"', false)
    ]);

    console.log('📊 [attendance-report] Discipline data fetched:', {
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

        // Meals on-time (breakfast, lunch, dinner)
        const breakfastOnTime = getUniqueOnTimeDates(
          foodData.data || [], userId, timeWindows.breakfast.start, timeWindows.breakfast.end, 'UserID'
        ).size;
        const lunchOnTime = getUniqueOnTimeDates(
          foodData.data || [], userId, timeWindows.lunch.start, timeWindows.lunch.end, 'UserID'
        ).size;
        const dinnerOnTime = getUniqueOnTimeDates(
          foodData.data || [], userId, timeWindows.dinner.start, timeWindows.dinner.end, 'UserID'
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

    // Helper: Calculate full team count recursively
    const calculateFullTeamCount = (userId, members) => {
      const directTeam = members.filter(m => m.UplineCoachId === userId);
      let fullCount = directTeam.length;
      
      directTeam.forEach(member => {
        fullCount += calculateFullTeamCount(member.UserId, members);
      });
      
      return fullCount;
    };

    // Build hierarchical attendance data
    const attendanceData = await Promise.all(
      teamMembers.map(async (member) => {
  // Get club attendance count
        const { data: clubLogs, error: clubError, count: clubCountValue } = await supabase
          .from('education_logs_table')
          .select('id', { count: 'exact', head: true })
          .eq('"UserId"', member.UserId)
          .eq('attendance_type', 'club')
          .eq('"IsDeleted"', false)
          .gte('"LogDate"', start + ' 00:00:00')
          .lte('"LogDate"', end + ' 23:59:59');

        if (clubError) {
          console.error('⚠️ [attendance-report] Club logs error for user', member.UserId, ':', clubError);
        }
        const clubCount = clubCountValue || 0;

        // Get remote attendance count
        const { data: remoteLogs, error: remoteError, count: remoteCountValue } = await supabase
          .from('education_logs_table')
          .select('id', { count: 'exact', head: true })
          .eq('"UserId"', member.UserId)
          .eq('attendance_type', 'remote')
          .eq('"IsDeleted"', false)
          .gte('"LogDate"', start + ' 00:00:00')
          .lte('"LogDate"', end + ' 23:59:59');

        if (remoteError) {
          console.error('⚠️ [attendance-report] Remote logs error for user', member.UserId, ':', remoteError);
        }
        const remoteCount = remoteCountValue || 0;

        // Get total education logs (for backward compatibility)
        const { data: totalLogs, error: totalError, count: totalCountValue } = await supabase
          .from('education_logs_table')
          .select('id', { count: 'exact', head: true })
          .eq('"UserId"', member.UserId)
          .eq('"IsDeleted"', false)
          .gte('"LogDate"', start + ' 00:00:00')
          .lte('"LogDate"', end + ' 23:59:59');

        if (totalError) {
          console.error('⚠️ [attendance-report] Total logs error for user', member.UserId, ':', totalError);
        }
        const totalEducation = totalCountValue || 0;

        // Calculate days in range
        const startDateObj = new Date(start);
        const endDateObj = new Date(end);
        const daysInRange = Math.ceil((endDateObj - startDateObj) / (1000 * 60 * 60 * 24)) + 1;

        // Calculate attendance percentage (club sessions / days in range)
        const attendancePercentage = daysInRange > 0 
          ? Math.round((clubCount / daysInRange) * 100) 
          : 0;

        // Calculate discipline metrics
        const discipline = calculateMemberDiscipline(member.UserId);

        // Calculate team counts
        const directTeamCount = teamMembers.filter(m => m.UplineCoachId === member.UserId).length;
        const fullTeamCount = calculateFullTeamCount(member.UserId, teamMembers);

        return {
          userId: member.UserId,
          userName: member.UserName,
          email: member.Email,
          role: member.Role,
          hierarchyLevel: member.HierarchyLevel,
          uplineCoachId: member.UplineCoachId,
          isLoggedInCoach: member.IsLoggedInCoach,
          
          // Attendance metrics
          clubAttendance: clubCount,
          remoteAttendance: remoteCount,
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

    // Calculate coach-level summaries
    const coaches = attendanceData.filter(m => m.role === 'coach' || m.role === 'admin' || m.role === 'developer');
    const coachSummaries = coaches.map(coach => {
      const directTeam = attendanceData.filter(m => m.uplineCoachId === coach.userId);
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

    console.log('✅ [attendance-report] Generated report for', attendanceData.length, 'members');
    console.log('📤 [attendance-report] Returning response with:', {
      memberCount: attendanceData.length,
      coachCount: coachSummaries.length,
      sampleMember: attendanceData[0] ? {
        userId: attendanceData[0].userId,
        name: attendanceData[0].userName,
        uplineCoachId: attendanceData[0].uplineCoachId,
        discipline: attendanceData[0].disciplinePercentage,
        attendance: attendanceData[0].attendancePercentage,
        directTeam: attendanceData[0].directTeamCount,
        fullTeam: attendanceData[0].fullTeamCount
      } : null
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
