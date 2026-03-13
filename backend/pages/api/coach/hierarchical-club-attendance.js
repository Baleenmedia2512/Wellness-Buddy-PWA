import { getSupabaseClient } from '../../../utils/supabaseClient.js';
import { getDualCoachingTeamHierarchy } from '../../../utils/disciplineCalculationsSupabase.js';
import { formatDateForMySQL } from '../../../utils/disciplineHelpers.js';
import { buildHierarchyWithMetricCounts, calculateHierarchyStats } from '../../../utils/hierarchyHelpers.js';

/**
 * API: Hierarchical Club Attendance Report
 * Returns team hierarchy with club attendance data for each member
 * Shows who attended which club on a given date
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

  const { userId, date, clubId } = req.query;

  console.log('🏢 [hierarchical-club-attendance] Request:', { userId, date, clubId });

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

    console.log('📅 [hierarchical-club-attendance] Target date:', targetDate);
    console.log('🏢 [hierarchical-club-attendance] Club filter:', clubIdNum || 'All clubs');

    // Step 0: Fetch clubs owned by the user
    const { data: userClubs, error: clubsError } = await supabase
      .from('nutrition_centers_table')
      .select('id, center_name, owner_user_id')
      .eq('owner_user_id', userIdNum)
      .eq('status', 'active')
      .eq('is_deleted', false)
      .order('center_name');

    if (clubsError) {
      console.error('❌ [hierarchical-club-attendance] Error fetching clubs:', clubsError);
      throw new Error(clubsError.message);
    }

    const ownedClubs = userClubs || [];
    console.log('🏢 [hierarchical-club-attendance] User owns', ownedClubs.length, 'clubs');

    // Step 1: Get team hierarchy using dual-coaching model
    const teamHierarchy = await getDualCoachingTeamHierarchy(userIdNum, false);
    
    if (!teamHierarchy || teamHierarchy.length === 0) {
      console.log('⚠️ [hierarchical-club-attendance] No team members found');
      return res.status(200).json({
        success: true,
        data: {
          hierarchy: null,
          date: targetDate,
          totalAttendees: 0,
          ownedClubs: ownedClubs.map(c => ({
            id: c.id,
            name: c.center_name,
          })),
          selectedClubId: clubIdNum,
          externalAttendees: [],
        },
      });
    }

    console.log('👥 [hierarchical-club-attendance] Team hierarchy has', teamHierarchy.length, 'members');

    // Step 2: Get all user IDs from hierarchy
    const allUserIds = teamHierarchy.map(m => m.UserId);

    console.log('🔍 [hierarchical-club-attendance] allUserIds:', allUserIds);
    console.log('🔍 [hierarchical-club-attendance] Date range:', { startOfDay, endOfDay });

    // Step 3: Fetch ALL education logs (club + remote) for all team members on the target date
    // Use .filter() for quoted PascalCase column names — more reliable than .in() with quoted names
    let attendanceQuery = supabase
      .from('education_logs_table')
      .select(`
        "UserId",
        "CreatedAt",
        attendance_type,
        nutrition_center_id,
        center_name
      `)
      .filter('"UserId"', 'in', `(${allUserIds.join(',')})`)
      .gte('"CreatedAt"', startOfDay)
      .lte('"CreatedAt"', endOfDay)
      .eq('"IsDeleted"', false);

    // If specific club selected, filter to only that club
    if (clubIdNum) {
      attendanceQuery = attendanceQuery.eq('nutrition_center_id', clubIdNum);
    }

    const { data: attendanceLogs, error: logsError } = await attendanceQuery;

    if (logsError) {
      console.error('❌ [hierarchical-club-attendance] Error fetching attendance logs:', logsError);
      console.error('❌ [hierarchical-club-attendance] Query details:', { allUserIds, startOfDay, endOfDay });
      throw new Error(logsError.message);
    }

    console.log('📊 [hierarchical-club-attendance] Found', attendanceLogs?.length || 0, 'attendance records');
    if (attendanceLogs && attendanceLogs.length > 0) {
      console.log('📊 [hierarchical-club-attendance] Records:', JSON.stringify(attendanceLogs));
    } else {
      console.log('📊 [hierarchical-club-attendance] NO records found. Params:', { startOfDay, endOfDay, allUserIds });
    }

    // Step 3b: Fetch external attendees (people NOT in team who attended the club)
    let externalAttendees = [];
    if (clubIdNum) {
      // Fetch all attendance for the selected club
      const { data: allClubAttendance, error: allAttendanceError } = await supabase
        .from('education_logs_table')
        .select(`
          "UserId",
          "CreatedAt"
        `)
        .eq('attendance_type', 'club')
        .eq('nutrition_center_id', clubIdNum)
        .gte('"CreatedAt"', startOfDay)
        .lte('"CreatedAt"', endOfDay)
        .eq('"IsDeleted"', false);

      if (!allAttendanceError && allClubAttendance) {
        // Find user IDs who are NOT in the team
        // Convert all IDs to numbers for proper comparison
        const teamUserIdsSet = new Set(allUserIds.map(id => parseInt(id)));
        
        const externalUserIds = [...new Set(
          allClubAttendance
            .map(log => parseInt(log.UserId))
            .filter(userId => !teamUserIdsSet.has(userId))
        )];

        console.log('🔍 [hierarchical-club-attendance] External check:', {
          totalClubAttendees: allClubAttendance.length,
          uniqueClubAttendees: [...new Set(allClubAttendance.map(log => parseInt(log.UserId)))].length,
          teamMembers: teamUserIdsSet.size,
          externalCount: externalUserIds.length,
        });

        if (externalUserIds.length > 0) {
          console.log('👤 [hierarchical-club-attendance] External attendees:', externalUserIds);

          // Fetch user details for external attendees
          const { data: externalUsersData, error: externalUsersError } = await supabase
            .from('team_table')
            .select('UserId, UserName, Email, CoachName, ProfileImage')
            .in('UserId', externalUserIds);

          if (!externalUsersError && externalUsersData) {
            externalAttendees = externalUsersData.map(user => ({
              userId: user.UserId,
              userName: user.UserName,
              email: user.Email,
              coachName: user.CoachName || 'Unknown',
              profileImage: user.ProfileImage || null,
            }));
          }
        }
      }
    }

    // Step 4: Fetch club information for all attended clubs
    const attendedClubIds = attendanceLogs 
      ? [...new Set(attendanceLogs.map(log => log.nutrition_center_id).filter(id => id))]
      : [];
    
    let clubsMap = {};
    if (attendedClubIds.length > 0) {
      const { data: clubsData, error: clubsDataError } = await supabase
        .from('nutrition_centers_table')
        .select('id, center_name')
        .in('id', attendedClubIds)
        .eq('status', 'active')
        .eq('is_deleted', false);

      if (!clubsDataError && clubsData) {
        clubsData.forEach(club => {
          clubsMap[club.id] = {
            id: club.id,
            name: club.center_name,
          };
        });
      }
    }

    // Step 5: Build attendance map: userId -> attendance info
    const attendanceMap = new Map();
    
    if (attendanceLogs) {
      attendanceLogs.forEach(log => {
        const userId = log.UserId;
        const clubId = log.nutrition_center_id;
        const clubInfo = clubId ? clubsMap[clubId] : null;
        const isRemote = log.attendance_type === 'remote' || (!clubId && log.attendance_type !== 'club');

        if (!attendanceMap.has(userId)) {
          attendanceMap.set(userId, {
            attended: true,
            clubs: [],
            remoteCount: 0,
            timestamps: [],
          });
        }

        const userAttendance = attendanceMap.get(userId);
        
        if (!isRemote) {
          // Club attendance — use clubsMap name first, fallback to center_name stored in log
          const clubName = clubInfo?.name || log.center_name || null;
          if (clubName && !userAttendance.clubs.find(c => c.id === clubId && clubId)) {
            userAttendance.clubs.push({ id: clubId, name: clubName });
          } else if (!clubId && !isRemote) {
            // Has attendance_type='club' but no nutrition_center_id - count it
            userAttendance.remoteCount += 1;
          }
        } else {
          // Remote attendance
          userAttendance.remoteCount += 1;
        }
        
        userAttendance.timestamps.push(log.CreatedAt);
      });
    }

    // Step 6: Build hierarchical structure with attendance data and team counts
    // Using reusable generic utility functions from hierarchyHelpers.js
    const transformAttendanceFn = (userId, dataMap, attendance) => {
      return attendance ? {
        attended: true,
        clubs: attendance.clubs,
        count: attendance.clubs.length,
        remoteCount: attendance.remoteCount || 0,
        lastAttendance: attendance.timestamps[attendance.timestamps.length - 1],
      } : {
        attended: false,
        clubs: [],
        count: 0,
        remoteCount: 0,
        lastAttendance: null,
      };
    };

    // Condition function to check if someone has attended
    const attendedConditionFn = (child) => child.metrics?.attended === true;

    const hierarchyWithAttendance = buildHierarchyWithMetricCounts(
      teamHierarchy,
      attendanceMap,
      transformAttendanceFn,
      attendedConditionFn
    );

    // Step 7: Calculate statistics using reusable utility function
    const stats = calculateHierarchyStats(
      hierarchyWithAttendance,
      (root) => root.metrics?.attended === true
    );
    const totalTeamMembers = stats.totalMembers;
    const totalAttendees = stats.qualifiedMembers; // qualified = attended in this context
    const attendanceRate = stats.qualificationRate; // qualificationRate = attendanceRate in this context

    // Count by hierarchy level
    const directTeamMembers = teamHierarchy.filter(m => m.HierarchyLevel === 1);
    const directTeamAttendees = directTeamMembers.filter(m => attendanceMap.has(m.UserId)).length;

    console.log('✅ [hierarchical-club-attendance] Generated hierarchical report:', {
      date: targetDate,
      clubFilter: clubIdNum || 'All clubs',
      totalTeamMembers,
      totalAttendees,
      attendanceRate: attendanceRate + '%',
      directTeamMembers: directTeamMembers.length,
      directTeamAttendees,
      externalAttendees: externalAttendees.length,
    });

    res.status(200).json({
      success: true,
      data: {
        hierarchy: hierarchyWithAttendance,
        date: targetDate,
        selectedClubId: clubIdNum,
        ownedClubs: ownedClubs.map(c => ({
          id: c.id,
          name: c.center_name,
        })),
        stats: {
          totalTeamMembers,
          totalAttendees,
          attendanceRate,
          directTeamMembers: directTeamMembers.length,
          directTeamAttendees,
          totalClubsVisited: attendedClubIds.length,
          externalAttendees: externalAttendees.length,
        },
        clubs: Object.values(clubsMap),
        externalAttendees,
      },
    });

  } catch (error) {
    console.error('❌ [hierarchical-club-attendance] Error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}
