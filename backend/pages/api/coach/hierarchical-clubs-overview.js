import { getSupabaseClient } from '../../../utils/supabaseClient.js';
import { getDualCoachingTeamHierarchy } from '../../../utils/disciplineCalculationsSupabase.js';
import { buildHierarchyWithMetricCounts } from '../../../utils/hierarchyHelpers.js';
import logger from '../../../shared/lib/logger.js';

/**
 * API: Hierarchical Clubs Overview
 * Returns team hierarchy with clubs owned by each member
 * Shows who owns which clubs and participant counts
 */
export default async function handler(req, res) {
  // Prevent caching
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
    res.status(405).json({ success: false, message: 'Method not allowed' });
    return;
  }

  const { userId, date } = req.query;

  logger.debug('🏢 [hierarchical-clubs-overview] Request:', { userId, date });

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

    // Step 1: Get team hierarchy using dual-coaching model
    const teamHierarchy = await getDualCoachingTeamHierarchy(userIdNum, false);
    
    if (!teamHierarchy || teamHierarchy.length === 0) {
      logger.debug('⚠️ [hierarchical-clubs-overview] No team members found');
      return res.status(200).json({
        success: true,
        data: {
          hierarchy: null,
          totalClubs: 0,
          totalParticipants: 0,
        },
      });
    }

    logger.debug('👥 [hierarchical-clubs-overview] Team hierarchy has', teamHierarchy.length, 'members');

    // Step 2: Get all user IDs from hierarchy
    const allUserIds = teamHierarchy.map(m => m.UserId);

    // Step 3: Fetch all clubs owned by team members
    const { data: teamClubs, error: clubsError } = await supabase
      .from('nutrition_centers_table')
      .select('id, center_name, owner_user_id, latitude, longitude, education_hour, owner_phone, registered_at')
      .in('owner_user_id', allUserIds)
      .eq('status', 'active')
      .eq('is_deleted', false)
      .order('center_name');

    if (clubsError) {
      console.error('❌ [hierarchical-clubs-overview] Error fetching clubs:', clubsError);
      throw new Error(clubsError.message);
    }

    logger.debug('🏢 [hierarchical-clubs-overview] Found', teamClubs?.length || 0, 'clubs owned by team');

    // Step 4: Calculate participant counts for each club
    const clubsWithMetrics = await Promise.all(
      (teamClubs || []).map(async (club) => {
        // Use the requested date (or today as fallback)
        const targetDateStr = date || new Date().toISOString().split('T')[0];
        const startOfDay = targetDateStr + 'T00:00:00';
        const endOfDay = targetDateStr + 'T23:59:59';

        // Count total unique participants at this club (all time)
        const { data: totalLogs } = await supabase
          .from('education_logs_table')
          .select('"UserId"', { count: 'exact', head: false })
          .eq('nutrition_center_id', club.id)
          .or('"IsDeleted".is.null,"IsDeleted".eq.false');

        const uniqueUserIds = new Set((totalLogs || []).map(log => log.UserId));
        const totalParticipants = uniqueUserIds.size;

        // Get selected date's attendance
        const { data: todayLogs } = await supabase
          .from('education_logs_table')
          .select('"UserId"')
          .eq('nutrition_center_id', club.id)
          .or('"IsDeleted".is.null,"IsDeleted".eq.false')
          .gte('"CreatedAt"', startOfDay)
          .lte('"CreatedAt"', endOfDay);

        const todayUniqueUsers = new Set((todayLogs || []).map(log => log.UserId));
        const todayAttendance = todayUniqueUsers.size;

        // Get this week's attendance (7 days ending on target date)
        const targetDateObj = new Date(targetDateStr + 'T00:00:00');
        const weekAgoObj = new Date(targetDateObj);
        weekAgoObj.setDate(weekAgoObj.getDate() - 6);
        const weekAgoStr = weekAgoObj.toISOString().split('T')[0];

        const { data: weekLogs } = await supabase
          .from('education_logs_table')
          .select('"UserId"')
          .eq('nutrition_center_id', club.id)
          .or('"IsDeleted".is.null,"IsDeleted".eq.false')
          .gte('"CreatedAt"', weekAgoStr + 'T00:00:00')
          .lte('"CreatedAt"', endOfDay);

        const weekUniqueUsers = new Set((weekLogs || []).map(log => log.UserId));
        const weekAttendance = weekUniqueUsers.size;

        return {
          id: club.id,
          name: club.center_name,
          ownerId: club.owner_user_id,
          latitude: club.latitude,
          longitude: club.longitude,
          educationHour: club.education_hour,
          ownerPhone: club.owner_phone,
          registeredAt: club.registered_at,
          totalParticipants,
          todayAttendance,
          weekAttendance,
        };
      })
    );

    // Step 5: Build map of userId -> clubs owned
    const clubsMap = new Map();
    clubsWithMetrics.forEach(club => {
      if (!clubsMap.has(club.ownerId)) {
        clubsMap.set(club.ownerId, {
          hasClubs: true,
          clubs: [],
          totalParticipants: 0,
          totalClubs: 0,
        });
      }
      const ownerData = clubsMap.get(club.ownerId);
      ownerData.clubs.push(club);
      ownerData.totalParticipants += club.totalParticipants;
      ownerData.totalClubs++;
    });

    // Step 6: Build hierarchical structure with club ownership data
    const transformClubsFn = (userId, dataMap, data) => {
      return data ? {
        hasClubs: true,
        clubs: data.clubs,
        totalClubs: data.totalClubs,
        totalParticipants: data.totalParticipants,
      } : {
        hasClubs: false,
        clubs: [],
        totalClubs: 0,
        totalParticipants: 0,
      };
    };

    // Condition: Has at least one club
    const hasClubsConditionFn = (child) => child.metrics?.hasClubs === true;

    const hierarchyWithClubs = buildHierarchyWithMetricCounts(
      teamHierarchy,
      clubsMap,
      transformClubsFn,
      hasClubsConditionFn
    );

    // Step 7: Calculate overall statistics
    const totalClubs = clubsWithMetrics.length;
    const totalParticipants = clubsWithMetrics.reduce((sum, club) => sum + club.totalParticipants, 0);
    const totalTodayAttendance = clubsWithMetrics.reduce((sum, club) => sum + club.todayAttendance, 0);
    const totalWeekAttendance = clubsWithMetrics.reduce((sum, club) => sum + club.weekAttendance, 0);

    // Count team members with clubs
    const membersWithClubs = allUserIds.filter(id => clubsMap.has(id)).length;

    logger.debug('✅ [hierarchical-clubs-overview] Generated hierarchical clubs overview:', {
      totalTeamMembers: teamHierarchy.length,
      membersWithClubs,
      totalClubs,
      totalParticipants,
      todayAttendance: totalTodayAttendance,
      weekAttendance: totalWeekAttendance,
    });

    res.status(200).json({
      success: true,
      data: {
        hierarchy: hierarchyWithClubs,
        stats: {
          totalTeamMembers: teamHierarchy.length,
          membersWithClubs,
          totalClubs,
          totalParticipants,
          todayAttendance: totalTodayAttendance,
          weekAttendance: totalWeekAttendance,
        },
        allClubs: clubsWithMetrics, // Flat list for map view
      },
    });
  } catch (error) {
    console.error('❌ [hierarchical-clubs-overview] Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
}
