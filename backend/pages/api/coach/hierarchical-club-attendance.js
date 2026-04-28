import { getSupabaseClient } from '../../../utils/supabaseClient.js';
import { formatDateForMySQL } from '../../../utils/disciplineHelpers.js';

/**
 * Helper function to get team hierarchy from team-hierarchy API
 */
async function getTeamHierarchyFromAPI(userId) {
  const supabase = getSupabaseClient();
  
  // Query team_table to get all users
  let query = supabase
    .from("team_table")
    .select("UserId, UserName, Email, Role, CoachId, CoachTeamId, Status, ProfileImage")
    .eq("Status", "Active");

  const { data: allUsers } = await query.order("UserName");
  
  // Derive CoCoachId from coach_teams_table
  const coachTeamIds = [...new Set(allUsers.map(u => u.CoachTeamId).filter(Boolean))];
  const coachTeamsMap = {};
  
  if (coachTeamIds.length > 0) {
    const { data: coachTeams } = await supabase
      .from("coach_teams_table")
      .select("Id, TeamId, CoachId, CoCoachId")
      .in("TeamId", coachTeamIds)
      .eq("Status", "active");
    
    if (coachTeams) {
      coachTeams.forEach(team => {
        coachTeamsMap[team.TeamId] = {
          coachId: team.CoachId,
          coCoachId: team.CoCoachId
        };
      });
    }
  }
  
  // Build user map with derived coCoachId
  const userMap = new Map();
  const coachNameMap = {}; // Map CoachId -> CoachName
  
  // First pass: build coach name map
  allUsers.forEach((user) => {
    coachNameMap[user.UserId] = user.UserName;
  });
  
  // Second pass: build user map with all needed fields
  allUsers.forEach((user) => {
    const team = coachTeamsMap[user.CoachTeamId];
    let coCoachId = null;
    
    if (team) {
      if (user.CoachId === team.coachId) {
        coCoachId = team.coCoachId;
      } else if (user.CoachId === team.coCoachId) {
        coCoachId = team.coachId;
      }
    }
    
    userMap.set(user.UserId, {
      UserId: user.UserId,
      UserName: user.UserName,
      Email: user.Email,
      Role: user.Role,
      CoachId: user.CoachId,
      CoCoachId: coCoachId,
      CoachName: user.CoachId ? (coachNameMap[user.CoachId] || null) : null,
      CoCoachName: coCoachId ? (coachNameMap[coCoachId] || null) : null,
      CoachTeamId: user.CoachTeamId,
      Status: user.Status,
      ProfileImage: user.ProfileImage
    });
  });
  
  // Check if user is part of a coach partnership
  const { data: managedTeam } = await supabase
    .from('coach_teams_table')
    .select('TeamId, CoachId, CoCoachId')
    .or(`CoachId.eq.${userId},CoCoachId.eq.${userId}`)
    .eq('Status', 'active')
    .maybeSingle();
  
  // Collect all team members (including nested hierarchy)
  const teamMembers = [];
  const addedIds = new Set();
  
  // Helper function to recursively collect all downline members
  const collectDownline = (coachId, visited = new Set()) => {
    if (visited.has(coachId)) return; // Prevent circular references
    visited.add(coachId);
    
    allUsers.forEach(user => {
      if (addedIds.has(user.UserId)) return; // Already added
      
      const userData = userMap.get(user.UserId);
      
      // Check if this user reports to the given coachId (via CoachId or CoCoachId)
      const reportsToCoach = (
        user.CoachId === coachId || 
        userData.CoCoachId === coachId
      );
      
      if (reportsToCoach) {
        teamMembers.push(userData);
        addedIds.add(user.UserId);
        
        // Recursively collect this user's downline
        collectDownline(user.UserId, visited);
      }
    });
  };
  
  if (managedTeam && managedTeam.CoachId && managedTeam.CoCoachId) {
    // Partnership exists - collect ALL members in downline of EITHER partner
    const coachId = managedTeam.CoachId;
    const coCoachId = managedTeam.CoCoachId;
    
    console.log(`👥 [hierarchical-club-attendance] Partnership detected: Coach ${coachId}, Co-Coach ${coCoachId}`);
    
    // Add both coaches to the team members list
    const coachData = userMap.get(coachId);
    const coCoachData = userMap.get(coCoachId);
    
    if (coachData) {
      teamMembers.push(coachData);
      addedIds.add(coachId);
    }
    
    if (coCoachData) {
      teamMembers.push(coCoachData);
      addedIds.add(coCoachId);
    }
    
    // Recursively collect downline of BOTH partners
    collectDownline(coachId);
    collectDownline(coCoachId);
    
    console.log(`👥 [hierarchical-club-attendance] Total team members (including full downline): ${teamMembers.length}`);
    console.log(`👥 [hierarchical-club-attendance] Member IDs:`, teamMembers.map(m => m.UserId));
  } else {
    // No partnership - collect logged-in user and their full downline
    const loggedInUser = userMap.get(userId);
    if (loggedInUser) {
      teamMembers.push(loggedInUser);
      addedIds.add(userId);
    }
    
    // Recursively collect downline
    collectDownline(userId);
  }
  
  return teamMembers;
}

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

    // Step 1: Get team hierarchy using partnership-aware logic
    const teamHierarchy = await getTeamHierarchyFromAPI(userIdNum);
    
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
        "Platform",
        attendance_type,
        nutrition_center_id,
        center_name
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
        .eq('nutrition_center_id', clubIdNum)
        .gte('"CreatedAt"', startOfDay)
        .lte('"CreatedAt"', endOfDay)
        .or('"IsDeleted".is.null,"IsDeleted".eq.false');

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
            .select('UserId, UserName, Email, CoachId, ProfileImage')
            .in('UserId', externalUserIds);

          if (!externalUsersError && externalUsersData) {
            // Batch lookup coach names from CoachId
            const externalCoachIds = [...new Set(externalUsersData.map(u => u.CoachId).filter(Boolean))];
            const coachNameMap = {};
            if (externalCoachIds.length > 0) {
              const { data: coaches } = await supabase
                .from('team_table')
                .select('UserId, UserName')
                .in('UserId', externalCoachIds);
              if (coaches) coaches.forEach(c => { coachNameMap[c.UserId] = c.UserName; });
            }

            externalAttendees = externalUsersData.map(user => ({
              userId: user.UserId,
              userName: user.UserName,
              email: user.Email,
              coachName: user.CoachId ? (coachNameMap[user.CoachId] || 'Unknown') : 'No Coach',
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
        // education_logs_table.UserId is varchar — convert to number so it matches
        // team_table.UserId (int4) used as the Map key in hierarchyHelpers
        const userId = parseInt(log.UserId, 10);
        const clubId = log.nutrition_center_id;
        const clubInfo = clubId ? clubsMap[clubId] : null;
        // Determine if remote: check attendance_type first, then fall back to Platform column
        const platform = (log.Platform || '').toLowerCase();
        const attendanceType = (log.attendance_type || '').toLowerCase();
        const isClubVisit = attendanceType === 'club' || platform === 'club' || !!clubId;
        const isRemote = attendanceType === 'remote' || platform === 'zoom' || platform === 'online meeting' || (!isClubVisit && !clubId);

        if (!attendanceMap.has(userId)) {
          attendanceMap.set(userId, {
            attended: true,
            clubs: [],
            remoteCount: 0,
            timestamps: [],
          });
        }

        const userAttendance = attendanceMap.get(userId);
        
        if (isClubVisit && !isRemote) {
          // Club / In-Person attendance
          const clubName = clubInfo?.name || log.center_name || null;
          if (clubName && !userAttendance.clubs.find(c => c.id === clubId && clubId)) {
            userAttendance.clubs.push({ id: clubId, name: clubName });
          }
          // Club visit with no center ID is still physical attendance — don't penalise
        } else {
          // Remote / Online attendance
          userAttendance.remoteCount += 1;
        }
        
        userAttendance.timestamps.push(log.CreatedAt);
      });
    }

    // Step 6: Build hierarchical structure with attendance data
    // Create a map of userId -> node for quick lookup
    const nodeMap = new Map();
    
    // Transform attendance function
    const getAttendanceMetrics = (userId) => {
      const attendance = attendanceMap.get(userId);
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
    
    // Check if logged-in user is part of a partnership
    const { data: managedTeam } = await supabase
      .from('coach_teams_table')
      .select('TeamId, CoachId, CoCoachId')
      .or(`CoachId.eq.${userIdNum},CoCoachId.eq.${userIdNum}`)
      .eq('Status', 'active')
      .maybeSingle();
    
    // Create array of partner IDs to exclude from nested hierarchy
    const coachPartnerIds = (managedTeam && managedTeam.CoachId && managedTeam.CoCoachId)
      ? [managedTeam.CoachId, managedTeam.CoCoachId]
      : [userIdNum];
    
    console.log('🔍 [hierarchical-club-attendance] Building hierarchy with partner exclusion:', coachPartnerIds);
    
    // Build nodes for all team members
    teamHierarchy.forEach(member => {
      nodeMap.set(member.UserId, {
        userId: member.UserId,
        userName: member.UserName,
        email: member.Email,
        role: member.Role,
        coachId: member.CoachId,
        coCoachId: member.CoCoachId,
        coachName: member.CoachName,
        coCoachName: member.CoCoachName,
        status: member.Status,
        profileImage: member.ProfileImage || null,
        hierarchyLevel: 0,
        metrics: getAttendanceMetrics(member.UserId),
        teamMembers: [],
      });
    });
    
    // Build parent-child relationships
    // Members report via EITHER CoachId OR CoCoachId
    teamHierarchy.forEach(member => {
      // Skip if member is one of the partners (they go at root level)
      if (coachPartnerIds.includes(member.UserId)) {
        return;
      }
      
      // Check CoachId relationship
      if (member.CoachId && nodeMap.has(member.CoachId)) {
        const parent = nodeMap.get(member.CoachId);
        const child = nodeMap.get(member.UserId);
        if (parent && child) {
          // Only add if not already added
          if (!parent.teamMembers.some(m => m.userId === child.userId)) {
            parent.teamMembers.push(child);
            child.hierarchyLevel = (parent.hierarchyLevel || 0) + 1;
          }
        }
      }
      
      // Check CoCoachId relationship (if different from CoachId)
      if (member.CoCoachId && 
          member.CoCoachId !== member.CoachId && 
          nodeMap.has(member.CoCoachId)) {
        const parent = nodeMap.get(member.CoCoachId);
        const child = nodeMap.get(member.UserId);
        if (parent && child) {
          // Only add if not already added
          if (!parent.teamMembers.some(m => m.userId === child.userId)) {
            parent.teamMembers.push(child);
            child.hierarchyLevel = (parent.hierarchyLevel || 0) + 1;
          }
        }
      }
    });
    
    // Find root node (logged-in user)
    let hierarchyWithAttendance = nodeMap.get(userIdNum);
    
    if (!hierarchyWithAttendance) {
      console.error('❌ [hierarchical-club-attendance] Root user not found in nodeMap');
      throw new Error('Failed to build hierarchy - root user not found');
    }
    
    // Calculate team counts recursively
    const calculateTeamCounts = (node) => {
      if (!node.teamMembers || node.teamMembers.length === 0) {
        node.directTeamCount = { total: 0, qualified: 0, totalClubs: 0 };
        node.fullTeamCount = { total: 0, qualified: 0, totalClubs: 0 };
        return;
      }
      
      // Recursively calculate for children first
      node.teamMembers.forEach(calculateTeamCounts);
      
      // Direct team counts
      const directAttended = node.teamMembers.filter(m => m.metrics?.attended).length;
      const directClubs = node.teamMembers.reduce((sum, m) => sum + (m.metrics?.count || 0), 0);
      
      node.directTeamCount = {
        total: node.teamMembers.length,
        qualified: directAttended,
        totalClubs: directClubs,
      };
      
      // Full team counts (recursive)
      let fullTotal = 0;
      let fullQualified = 0;
      let fullClubs = 0;
      
      const traverse = (n) => {
        fullTotal++;
        if (n.metrics?.attended) fullQualified++;
        fullClubs += (n.metrics?.count || 0);
        if (n.teamMembers) {
          n.teamMembers.forEach(traverse);
        }
      };
      
      node.teamMembers.forEach(traverse);
      
      node.fullTeamCount = {
        total: fullTotal,
        qualified: fullQualified,
        totalClubs: fullClubs,
      };
    };
    
    calculateTeamCounts(hierarchyWithAttendance);

    // Step 6b: Add co-coach partnership info if exists (managedTeam already fetched earlier)
    if (managedTeam && managedTeam.CoachId && managedTeam.CoCoachId) {
      const partnerId = managedTeam.CoachId === userIdNum
        ? managedTeam.CoCoachId
        : managedTeam.CoachId;

      // Find co-coach node
      const coCoachNode = nodeMap.get(partnerId);
      
      if (coCoachNode) {
        // Double-check co-coach is not in teamMembers (should already be excluded)
        hierarchyWithAttendance.teamMembers = hierarchyWithAttendance.teamMembers.filter(m => m.userId !== partnerId);
        
        // Set up coCoachInfo
        hierarchyWithAttendance.coCoachInfo = {
          ...coCoachNode,
          isCoCoach: true,
          isCoach: false,
          directTeamCount: hierarchyWithAttendance.directTeamCount,
          fullTeamCount: hierarchyWithAttendance.fullTeamCount,
          teamMembers: [],
        };
        
        // Mark logged-in user's role
        hierarchyWithAttendance.isCoach = (userIdNum === managedTeam.CoachId);
        hierarchyWithAttendance.isCoCoach = (userIdNum === managedTeam.CoCoachId);

        console.log(`👥 [hierarchical-club-attendance] Added co-coach partnership info for ${coCoachNode.userName}`);
      }
    }

    // Step 7: Calculate statistics
    const totalTeamMembers = hierarchyWithAttendance.fullTeamCount?.total || 0;
    const totalAttendees = hierarchyWithAttendance.fullTeamCount?.qualified || 0;
    const attendanceRate = totalTeamMembers > 0 
      ? ((totalAttendees / totalTeamMembers) * 100).toFixed(1)
      : '0.0';

    const directTeamMembers = hierarchyWithAttendance.directTeamCount?.total || 0;
    const directTeamAttendees = hierarchyWithAttendance.directTeamCount?.qualified || 0;

    console.log('✅ [hierarchical-club-attendance] Generated hierarchical report:', {
      date: targetDate,
      clubFilter: clubIdNum || 'All clubs',
      totalTeamMembers,
      totalAttendees,
      attendanceRate: attendanceRate + '%',
      directTeamMembers,
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
