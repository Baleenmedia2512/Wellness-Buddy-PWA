import { getSupabaseClient } from '../../../utils/supabaseClient.js';
import { formatDateForMySQL } from '../../../utils/disciplineHelpers.js';

/**
 * Extract main area name from city string
 * Example: "CMWSSB Division 175, Zone 13 Adyar" → "Adyar"
 */
function extractMainAreaName(cityString) {
  if (!cityString) return '';
  
  // Split by comma and take the last part
  const parts = cityString.split(',').map(part => part.trim());
  let mainArea = parts[parts.length - 1];
  
  // Remove common prefixes like "Division", "Zone" and their numbers
  mainArea = mainArea
    .replace(/^(CMWSSB|Division|Zone)\s+\d+\s*/gi, '') // Remove "Division 175", "Zone 13", etc.
    .replace(/^(CMWSSB|Division|Zone)\s+/gi, '') // Remove just "Division", "Zone" without numbers
    .trim();
  
  return mainArea;
}

/**
 * Helper function to get team hierarchy with partnership support
 * Same logic as hierarchical-club-attendance.js
 */
async function getTeamHierarchyFromAPI(userId) {
  const supabase = getSupabaseClient();
  
  // Query team_table to get all users
  let query = supabase
    .from("team_table")
    .select("UserId, UserName, Email, Role, CoachId, CoachTeamId, Status, ProfileImage, PhoneNumber")
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
      ProfileImage: user.ProfileImage,
      PhoneNumber: user.PhoneNumber
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
    
    console.log(`👥 [download-attendance-excel] Partnership detected: Coach ${coachId}, Co-Coach ${coCoachId}`);
    
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
    
    console.log(`👥 [download-attendance-excel] Total team members (including full downline): ${teamMembers.length}`);
    console.log(`👥 [download-attendance-excel] Member IDs:`, teamMembers.map(m => m.UserId));
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

    // Step 1: Get team hierarchy using partnership-aware logic
    const teamHierarchy = await getTeamHierarchyFromAPI(userIdNum);
    
    if (!teamHierarchy || teamHierarchy.length === 0) {
      console.log('⚠️ [download-attendance-excel] No team members found');
      return res.status(200).json({
        success: true,
        data: [],
        date: targetDate,
      });
    }

    console.log('👥 [download-attendance-excel] Team hierarchy has', teamHierarchy.length, 'members');

    // Step 2: Get all user IDs from hierarchy
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

    // Step 4: Build user map from teamHierarchy (already has all data we need)
    const attendeeIds = [...new Set(attendanceLogs.map(log => parseInt(log.UserId)))];
    
    if (attendeeIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        date: targetDate,
      });
    }

    const userMap = new Map(teamHierarchy.map(u => [u.UserId, u]));

    // Step 5: Build attendance records with all required fields
    const attendanceRecords = [];

    attendanceLogs.forEach(log => {
      const userId = parseInt(log.UserId);
      const user = userMap.get(userId);
      
      if (user) {
        attendanceRecords.push({
          userId: user.UserId,
          userName: user.UserName || 'Unknown',
          city: extractMainAreaName(log.City),
          village: log.Village || '',
          phone: user.PhoneNumber || '',
          coach: user.CoachName || 'No Coach',
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

    // Step 6: Sort by attended time
    attendanceRecords.sort((a, b) => {
      const timeA = new Date(a.attendedTime);
      const timeB = new Date(b.attendedTime);
      return timeA - timeB;
    });

    // Step 7: Add serial numbers
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
