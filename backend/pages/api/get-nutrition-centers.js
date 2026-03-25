import { getSupabaseClient } from '../../utils/supabaseClient.js';
import { getTeamHierarchy, getDualCoachingTeamHierarchy } from '../../utils/disciplineCalculationsSupabase.js';

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
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, cache-control, pragma');
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ message: 'Method not allowed' });
    return;
  }

  const { userId, teamFilter = 'direct', scope = 'team', dateRange = 'today', startDate: rawStartDate, endDate: rawEndDate } = req.query;
  let startDate = rawStartDate;
  let endDate = rawEndDate;

  console.log('🗺️ [get-nutrition-centers] Request:', { userId, teamFilter, scope, dateRange, startDate, endDate });

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

    console.log('🔄 [get-nutrition-centers] Using DUAL COACHING MODEL for team filtering');

    // Get team hierarchy using DUAL COACHING MODEL
    let teamMembers = [];
    let teamUserIds = [];
    
    if (teamFilter === 'self') {
      // Only show the logged-in user's own clubs
      console.log('👤 [get-nutrition-centers] Fetching SELF only...');
      teamUserIds = [userIdNum];
    } else if (teamFilter === 'full') {
      // Get full team hierarchy with dual-coaching support
      console.log('📊 [get-nutrition-centers] Fetching FULL team hierarchy...');
      teamMembers = await getDualCoachingTeamHierarchy(userIdNum, false);
      teamUserIds = [userIdNum, ...teamMembers.map(m => m.UserId)];
    } else {
      // Get direct team only (dual-coaching model)
      console.log('📊 [get-nutrition-centers] Fetching DIRECT team...');

      // Direct members: their CoachId = me
      const { data: directMembers } = await supabase
        .from('team_table')
        .select('UserId')
        .eq('CoachId', userIdNum)
        .eq('Status', 'Active');

      // Co-coached members: find teams where I'm co-coach, then get their members
      const { data: coCoachTeams } = await supabase
        .from('coach_teams_table')
        .select('CoachId')
        .eq('CoCoachId', userIdNum)
        .eq('Status', 'active');

      let coCoachMemberIds = [];
      if (coCoachTeams && coCoachTeams.length > 0) {
        const primaryCoachIds = [...new Set(coCoachTeams.map(t => t.CoachId).filter(id => id && id !== userIdNum))];
        if (primaryCoachIds.length > 0) {
          const { data: coMembers } = await supabase
            .from('team_table')
            .select('UserId')
            .in('CoachId', primaryCoachIds)
            .eq('Status', 'Active');
          coCoachMemberIds = (coMembers || []).map(m => m.UserId);
        }
      }

      // Merge and deduplicate
      const directMemberIds = (directMembers || []).map(m => m.UserId);
      teamUserIds = [...new Set([userIdNum, ...directMemberIds, ...coCoachMemberIds])];
    }

    console.log('👥 [get-nutrition-centers] Team size:', teamUserIds.length, 'members');

    // Build query for nutrition centers
    let centersQuery = supabase
      .from('nutrition_centers_table')
      .select(`
        id,
        center_name,
        latitude,
        longitude,
        education_hour,
        owner_user_id,
        owner_phone,
        registered_at,
        status
      `)
      .eq('status', 'active')
      .eq('is_deleted', false);

    // Apply team filter only if scope is 'team' (default)
    // For GPS-based attendance (scope='all'), fetch ALL clubs globally
    if (scope === 'team') {
      console.log('🔒 [get-nutrition-centers] Filtering by team ownership');
      centersQuery = centersQuery.in('owner_user_id', teamUserIds);
    } else {
      console.log('🌍 [get-nutrition-centers] Fetching ALL clubs globally (for attendance detection)');
    }

    const { data: centers, error: centersError } = await centersQuery
      .order('registered_at', { ascending: false });

    if (centersError) {
      console.error('❌ [get-nutrition-centers] Error:', centersError);
      throw new Error(centersError.message);
    }

    // Get owner names from team_table
    const ownerIds = centers.map(c => c.owner_user_id);
    const { data: owners } = await supabase
      .from('team_table')
      .select('UserId, UserName')
      .in('UserId', ownerIds);

    const ownerMap = {};
    (owners || []).forEach(o => {
      ownerMap[o.UserId] = o.UserName;
    });

    // Calculate attendance metrics for each center
    // Dates are always sent from the frontend using local timezone (avoids UTC shift issues)
    if (!startDate || !endDate) {
      // Fallback: should not happen as frontend always sends dates
      const today = new Date().toISOString().split('T')[0];
      startDate = today;
      endDate = today;
    }
    const rangeStart = startDate + 'T00:00:00';
    const rangeEnd = endDate + 'T23:59:59';
    console.log('📅 [get-nutrition-centers] Attendance window:', { rangeStart, rangeEnd, dateRange });

    const centersWithMetrics = await Promise.all(
      centers.map(async (center) => {
        // Get attendance for selected date range
        const { data: rangeLogs } = await supabase
          .from('education_logs_table')
          .select('"UserId"')
          .eq('nutrition_center_id', center.id)
          .eq('"IsDeleted"', false)
          .gte('"CreatedAt"', rangeStart)
          .lte('"CreatedAt"', rangeEnd);

        const rangeUniqueUsers = new Set((rangeLogs || []).map(log => log.UserId));
        const todayAttendance = rangeUniqueUsers.size;

        // Calculate attendance percentage
        const attendancePercentage = todayAttendance > 0 ? 100 : 0;

        return {
          ...center,
          ownerName: ownerMap[center.owner_user_id] || 'Unknown',
          totalParticipants: todayAttendance,
          todayAttendance,
          attendancePercentage,
        };
      })
    );

    console.log('✅ [get-nutrition-centers] Found', centersWithMetrics.length, 'centers with metrics');
    console.log('📍 [get-nutrition-centers] Centers:', centersWithMetrics.map(c => ({ 
      name: c.center_name, 
      owner: c.ownerName, 
      participants: c.totalParticipants,
      today: c.todayAttendance 
    })));

    res.status(200).json({
      success: true,
      data: centersWithMetrics,
    });

  } catch (error) {
    console.error('❌ [get-nutrition-centers] Error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}
