import { getSupabaseClient } from '../../../utils/supabaseClient.js';
import { getDualCoachingTeamHierarchy } from '../../../utils/disciplineCalculationsSupabase.js';
import { formatDateForMySQL } from '../../../utils/disciplineHelpers.js';

/**
 * API: Download Attendance Report as Excel
 * Returns attendance data with user details for Excel export
 */
export default async function handler(req, res) {
  // Set CORS headers for all requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cache-Control');

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ success: false, message: 'Method not allowed' });
    return;
  }

  const { userId, date, clubId } = req.query;

  console.log('📥 [download-attendance-excel] Request:', { userId, date, clubId });

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
    const clubIdNum = clubId ? parseInt(clubId) : null;

    // Use provided date or default to today
    const targetDate = date || formatDateForMySQL(new Date());
    const startOfDay = targetDate + 'T00:00:00';
    const endOfDay = targetDate + 'T23:59:59';

    console.log('📅 [download-attendance-excel] Target date:', targetDate);

    // Step 1: Get team hierarchy (includes logged-in coach, co-coach, and full downline)
    // This function handles co-coaching partnerships automatically
    const teamHierarchy = await getDualCoachingTeamHierarchy(userIdNum, true);
    
    console.log('👥 [download-attendance-excel] Team hierarchy for user', userIdNum, ':', {
      totalMembers: teamHierarchy.length,
      levelBreakdown: teamHierarchy.reduce((acc, m) => {
        acc[m.HierarchyLevel] = (acc[m.HierarchyLevel] || 0) + 1;
        return acc;
      }, {}),
      coaches: teamHierarchy.filter(m => m.HierarchyLevel === 0 || m.IsCoCoach).map(m => ({
        id: m.UserId,
        name: m.UserName,
        level: m.HierarchyLevel,
        isLoggedIn: m.IsLoggedInCoach,
        isCoCoach: m.IsCoCoach
      })),
      directTeam: teamHierarchy.filter(m => m.HierarchyLevel === 1 && !m.IsCoCoach).map(m => ({
        id: m.UserId,
        name: m.UserName,
        coachId: m.CoachId
      })),
      allUserIds: teamHierarchy.map(m => m.UserId)
    });
    
    if (!teamHierarchy || teamHierarchy.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        date: targetDate,
      });
    }

    // Step 2: Get all user IDs from hierarchy (includes coach, co-coach, and all team members)
    const allUserIds = teamHierarchy.map(m => m.UserId);
    
    console.log('🔍 [download-attendance-excel] Searching attendance for', allUserIds.length, 'team members');

    // Step 3: Fetch attendance logs for all team members (coach, co-coach, and downline)
    let attendanceQuery = supabase
      .from('education_logs_table')
      .select(`
        "UserId",
        "CreatedAt",
        nutrition_center_id,
        center_name,
        attendance_type,
        "City",
        "Village"
      `)
      .filter('"UserId"', 'in', `(${allUserIds.join(',')})`)
      .gte('"CreatedAt"', startOfDay)
      .lte('"CreatedAt"', endOfDay)
      .or('"IsDeleted".is.null,"IsDeleted".eq.false,"IsDeleted".eq.0');

    // If specific club selected, filter to only that club
    if (clubIdNum) {
      attendanceQuery = attendanceQuery.eq('nutrition_center_id', clubIdNum);
    }

    const { data: attendanceLogs, error: logsError } = await attendanceQuery;

    console.log('📊 [download-attendance-excel] Found', attendanceLogs?.length || 0, 'attendance records');
    if (attendanceLogs && attendanceLogs.length > 0) {
      console.log('   Attendance by user:', attendanceLogs.reduce((acc, log) => {
        acc[log.UserId] = (acc[log.UserId] || 0) + 1;
        return acc;
      }, {}));
    }

    if (logsError) {
      console.error('❌ [download-attendance-excel] Error fetching attendance:', logsError);
      throw new Error(logsError.message);
    }

    // Step 4: Get user details (name, phone, coach) for all attendees
    const attendeeIds = [...new Set(attendanceLogs.map(log => parseInt(log.UserId)))];
    
    if (attendeeIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        date: targetDate,
      });
    }

    const { data: usersData, error: usersError } = await supabase
      .from('team_table')
      .select(`
        "UserId",
        "UserName",
        "PhoneNumber",
        "CoachId"
      `)
      .in('"UserId"', attendeeIds);

    if (usersError) {
      console.error('❌ [download-attendance-excel] Error fetching users:', usersError);
      throw new Error(usersError.message);
    }

    // Step 5: Get coach names
    const coachIds = [...new Set(usersData.map(u => u.CoachId).filter(Boolean))];
    let coachNamesMap = {};
    
    if (coachIds.length > 0) {
      const { data: coaches } = await supabase
        .from('team_table')
        .select('"UserId", "UserName"')
        .in('"UserId"', coachIds);
      
      if (coaches) {
        coaches.forEach(coach => {
          coachNamesMap[coach.UserId] = coach.UserName;
        });
      }
    }

    // Step 6: Build attendance records with all required fields
    const attendanceRecords = [];
    const userMap = new Map(usersData.map(u => [u.UserId, u]));

    attendanceLogs.forEach(log => {
      const userId = parseInt(log.UserId);
      const user = userMap.get(userId);
      
      if (user) {
        attendanceRecords.push({
          userId: user.UserId,
          userName: user.UserName || 'Unknown',
          city: log.City || '',
          village: log.Village || '',
          phone: user.PhoneNumber || '',
          coach: user.CoachId ? (coachNamesMap[user.CoachId] || 'Unknown') : 'No Coach',
          attendedTime: new Date(log.CreatedAt).toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          }),
          clubName: log.center_name || '',
          attendanceType: log.attendance_type || 'club'
        });
      }
    });

    // Step 7: Sort by attended time
    attendanceRecords.sort((a, b) => {
      const timeA = new Date(a.attendedTime);
      const timeB = new Date(b.attendedTime);
      return timeA - timeB;
    });

    // Step 8: Add serial numbers
    const finalData = attendanceRecords.map((record, index) => ({
      sno: index + 1,
      ...record
    }));

    console.log('✅ [download-attendance-excel] Found', finalData.length, 'attendance records');

    res.status(200).json({
      success: true,
      data: finalData,
      date: targetDate,
      totalRecords: finalData.length
    });

  } catch (error) {
    console.error('❌ [download-attendance-excel] Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
}
