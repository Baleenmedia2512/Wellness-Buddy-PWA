import { getSupabaseClient } from '../../../utils/supabaseClient.js';
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

  const { userId, clubId, startDate, endDate } = req.query;

  console.log('🏢 [club-attendance-report] Request:', { userId, clubId, startDate, endDate });

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

    // Calculate date range
    const start = startDate || formatDateForMySQL(new Date());
    const end = endDate || formatDateForMySQL(new Date());

    console.log('📅 [club-attendance-report] Date range:', { start, end });

    // If clubId is provided, fetch attendance for that specific club
    // Otherwise, return empty data (require club selection)
    if (!clubId) {
      console.log('⚠️ [club-attendance-report] No clubId provided, returning empty data');
      return res.status(200).json({
        success: true,
        data: {
          attendees: [],
          clubInfo: null,
          dateRange: { start, end },
        },
      });
    }

    const clubIdNum = parseInt(clubId);

    // Verify club ownership or access
    const { data: clubData, error: clubError } = await supabase
      .from('nutrition_centers_table')
      .select('id, center_name, owner_user_id')
      .eq('id', clubIdNum)
      .eq('status', 'active')
      .eq('is_deleted', false)
      .single();

    if (clubError || !clubData) {
      console.error('❌ [club-attendance-report] Club not found:', clubError);
      return res.status(404).json({
        success: false,
        message: 'Club not found or inactive',
      });
    }

    // Verify ownership (user must own the club)
    if (clubData.owner_user_id !== userIdNum) {
      console.error('❌ [club-attendance-report] Unauthorized: User does not own this club');
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this club',
      });
    }

    console.log('✅ [club-attendance-report] Club verified:', clubData.center_name);

    // Fetch all education logs with attendance_type = 'club' for this club within the date range
    // Note: We need to join with club location data or use a nutrition_center_id field
    // For now, we'll fetch all club attendance and filter by users in the system
    
    // First, let's get all education logs marked as 'club' attendance in the date range
    const { data: educationLogs, error: logsError } = await supabase
      .from('education_logs_table')
      .select(`
        "UserId",
        "CreatedAt",
        attendance_type,
        nutrition_center_id
      `)
      .eq('nutrition_center_id', clubIdNum)
      .gte('"CreatedAt"', start + 'T00:00:00')
      .lte('"CreatedAt"', end + 'T23:59:59')
      .or('"IsDeleted".is.null,"IsDeleted".eq.false');

    if (logsError) {
      console.error('❌ [club-attendance-report] Error fetching education logs:', logsError);
      throw new Error(logsError.message);
    }

    console.log('📊 [club-attendance-report] Found', educationLogs?.length || 0, 'club education logs');

    if (!educationLogs || educationLogs.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          attendees: [],
          clubInfo: {
            id: clubData.id,
            name: clubData.center_name,
          },
          dateRange: { start, end },
        },
      });
    }

    // Get unique user IDs who attended
    const attendeeUserIds = [...new Set(educationLogs.map(log => log.UserId))];
    
    console.log('👥 [club-attendance-report] Unique attendees:', attendeeUserIds.length);

    // Fetch user details including coach information
    const { data: usersData, error: usersError } = await supabase
      .from('team_table')
      .select('UserId, UserName, Email, CoachId, ProfileImage')
      .in('UserId', attendeeUserIds);

    if (usersError) {
      console.error('❌ [club-attendance-report] Error fetching user data:', usersError);
      throw new Error(usersError.message);
    }

    console.log('👤 [club-attendance-report] Fetched user data for', usersData?.length || 0, 'users');

    // Build attendee list with attendance count
    const attendeeMap = new Map();
    
    educationLogs.forEach(log => {
      const attendanceDate = new Date(log.CreatedAt).toISOString().split('T')[0];
      const key = log.UserId;
      
      if (!attendeeMap.has(key)) {
        attendeeMap.set(key, new Set());
      }
      attendeeMap.get(key).add(attendanceDate);
    });

    // Batch lookup coach names from CoachId
    const coachIds = [...new Set(usersData.map(u => u.CoachId).filter(Boolean))];
    const coachNameMap = {};
    if (coachIds.length > 0) {
      const { data: coaches } = await supabase
        .from('team_table')
        .select('UserId, UserName')
        .in('UserId', coachIds);
      if (coaches) coaches.forEach(c => { coachNameMap[c.UserId] = c.UserName; });
    }

    // Combine user data with attendance count
    const attendees = usersData.map(user => {
      const attendanceDays = attendeeMap.get(user.UserId) || new Set();
      
      return {
        userId: user.UserId,
        userName: user.UserName,
        email: user.Email,
        profileImage: user.ProfileImage || null,
        coachName: user.CoachId ? (coachNameMap[user.CoachId] || 'Unknown') : 'No Coach',
        attendanceDays: attendanceDays.size,
        attendanceDates: Array.from(attendanceDays).sort(),
      };
    });

    // Sort by attendance days (descending)
    attendees.sort((a, b) => b.attendanceDays - a.attendanceDays);

    console.log('✅ [club-attendance-report] Generated report:', {
      clubName: clubData.center_name,
      totalAttendees: attendees.length,
      dateRange: { start, end },
    });

    res.status(200).json({
      success: true,
      data: {
        attendees,
        clubInfo: {
          id: clubData.id,
          name: clubData.center_name,
        },
        dateRange: { start, end },
      },
    });

  } catch (error) {
    console.error('❌ [club-attendance-report] Error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}
