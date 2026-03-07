import { getSupabaseClient } from '../../../utils/supabaseClient.js';
import { getTeamHierarchy } from '../../../utils/disciplineCalculationsSupabase.js';
import { formatDateForMySQL } from '../../../utils/disciplineHelpers.js';

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
    
    // Calculate date range
    const start = startDate || formatDateForMySQL(new Date());
    const end = endDate || formatDateForMySQL(new Date());

    console.log('📅 [attendance-report] Date range:', { start, end });
    console.log('👥 [attendance-report] Team size:', teamMembers.length);

    // Build hierarchical attendance data
    const attendanceData = await Promise.all(
      teamMembers.map(async (member) => {
        // Get club attendance count
        const { data: clubLogs, error: clubError } = await supabase
          .from('education_logs_table')
          .select('id', { count: 'exact', head: true })
          .eq('"UserId"', member.UserId)
          .eq('attendance_type', 'club')
          .eq('"IsDeleted"', false)
          .gte('"LogDate"', start + ' 00:00:00')
          .lte('"LogDate"', end + ' 23:59:59');

        const clubCount = clubError ? 0 : (clubLogs || 0);

        // Get remote attendance count
        const { data: remoteLogs, error: remoteError } = await supabase
          .from('education_logs_table')
          .select('id', { count: 'exact', head: true })
          .eq('"UserId"', member.UserId)
          .eq('attendance_type', 'remote')
          .eq('"IsDeleted"', false)
          .gte('"LogDate"', start + ' 00:00:00')
          .lte('"LogDate"', end + ' 23:59:59');

        const remoteCount = remoteError ? 0 : (remoteLogs || 0);

        // Get total education logs (for backward compatibility)
        const { data: totalLogs, error: totalError } = await supabase
          .from('education_logs_table')
          .select('id', { count: 'exact', head: true })
          .eq('"UserId"', member.UserId)
          .eq('"IsDeleted"', false)
          .gte('"LogDate"', start + ' 00:00:00')
          .lte('"LogDate"', end + ' 23:59:59');

        const totalEducation = totalError ? 0 : (totalLogs || 0);

        // Calculate days in range
        const startDateObj = new Date(start);
        const endDateObj = new Date(end);
        const daysInRange = Math.ceil((endDateObj - startDateObj) / (1000 * 60 * 60 * 24)) + 1;

        // Calculate attendance percentage (club sessions / days in range)
        const attendancePercentage = daysInRange > 0 
          ? Math.round((clubCount / daysInRange) * 100) 
          : 0;

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
        };
      })
    );

    // Calculate coach-level summaries
    const coaches = attendanceData.filter(m => m.role === 'coach');
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
