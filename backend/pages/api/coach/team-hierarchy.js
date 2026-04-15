import { getSupabaseClient } from "../../../utils/supabaseClient.js";

/**
 * API: Get Hierarchical Team Structure
 * Returns nested team hierarchy for the All Teams view
 * Supports multi-level Coach → Co-Coach → Members structure
 */
export default async function handler(req, res) {
  // Prevent caching
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate",
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  
  // Set CORS headers for all responses
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Cache-Control, Pragma");

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({ success: false, message: "Method not allowed" });
    return;
  }

  try {
    const { coachId, email, includeInactive } = req.query;

    console.log("📊 [team-hierarchy] Request:", {
      coachId,
      email,
      includeInactive,
    });

    const supabase = getSupabaseClient();
    let coachIdInt;

    // If email is provided, look up the coach ID
    if (email) {
      console.log("🔍 [team-hierarchy] Looking up coach by email:", email);
      const { data: coach, error: coachError } = await supabase
        .from("team_table")
        .select("UserId")
        .eq("Email", email)
        .maybeSingle();

      if (coachError) {
        console.error("❌ [team-hierarchy] Email lookup error:", coachError);
        res
          .status(500)
          .json({
            success: false,
            message: "Database error: " + coachError.message,
          });
        return;
      }

      if (!coach) {
        console.error("❌ [team-hierarchy] Coach not found for email:", email);
        res.status(404).json({ success: false, message: "Coach not found" });
        return;
      }

      coachIdInt = coach.UserId;
      console.log("✅ [team-hierarchy] Found coach ID:", coachIdInt);
    } else if (coachId) {
      coachIdInt = parseInt(coachId);
      console.log("✅ [team-hierarchy] Using provided coach ID:", coachIdInt);
    } else {
      console.error("❌ [team-hierarchy] No coach ID or email provided");
      res
        .status(400)
        .json({ success: false, message: "Coach ID or email required" });
      return;
    }

    // Fetch all users in the hierarchy
    let query = supabase
      .from("team_table")
      .select("UserId, UserName, Email, Role, CoachId, CoachTeamId, Status, ProfileImage");

    // Only filter by Active status if includeInactive is not true
    if (includeInactive !== "true") {
      query = query.eq("Status", "Active");
    }

    const { data: allUsers, error: usersError } = await query.order("UserName");

    if (usersError) {
      console.error("Error fetching users:", usersError);
      res
        .status(500)
        .json({ success: false, message: "Failed to fetch team data" });
      return;
    }

    console.log(
      `📊 [team-hierarchy] Fetched ${allUsers?.length || 0} total users from database`,
    );
    console.log(
      `📊 [team-hierarchy] Users sample:`,
      allUsers?.slice(0, 5).map((u) => ({
        UserId: u.UserId,
        UserName: u.UserName,
        CoachId: u.CoachId,
        Status: u.Status,
      })),
    );

    if (!allUsers || allUsers.length === 0) {
      res.status(200).json({
        success: true,
        hierarchy: [],
        totalCoaches: 0,
        totalMembers: 0,
      });
      return;
    }

    // Derive CoCoachId from coach_teams_table (instead of storing redundantly)
    // Get all unique CoachTeamIds
    // TEMPORARY: CoachTeamId is currently TeamId string until database migration
    const coachTeamIds = [...new Set(allUsers.map(u => u.CoachTeamId).filter(Boolean))];
    console.log(`📊 [team-hierarchy] Fetching ${coachTeamIds.length} coach teams for co-coach derivation`);
    
    const coachTeamsMap = {}; // Maps TeamId string -> {CoachId, CoCoachId}
    if (coachTeamIds.length > 0) {
      const { data: coachTeams, error: teamsError } = await supabase
        .from("coach_teams_table")
        .select("id, TeamId, CoachId, CoCoachId")
        .in("TeamId", coachTeamIds) // TEMPORARY: Query by TeamId string until schema migration
        .eq("Status", "active");
      
      if (teamsError) {
        console.error("❌ [team-hierarchy] Error fetching coach teams:", teamsError);
      } else if (coachTeams) {
        coachTeams.forEach(team => {
          coachTeamsMap[team.TeamId] = { // TEMPORARY: Map by TeamId string
            coachId: team.CoachId,
            coCoachId: team.CoCoachId
          };
        });
        console.log(`✅ [team-hierarchy] Loaded ${coachTeams.length} active coach team partnerships`);
      }
    }
    
    // Helper function to derive coCoachId for a user
    const deriveCoCoachId = (user) => {
      if (!user.CoachTeamId) return null;
      
      const team = coachTeamsMap[user.CoachTeamId];
      if (!team) return null;
      
      // The co-coach is whichever coach in the team ISN'T the user's primary coach
      if (user.CoachId === team.coachId) {
        return team.coCoachId; // User reports to coach, so co-coach is the partner
      } else if (user.CoachId === team.coCoachId) {
        return team.coachId; // User reports to co-coach, so co-coach is the primary
      }
      return null;
    };

    // Build user map for quick lookup
    const userMap = new Map();
    allUsers.forEach((user) => {
      userMap.set(user.UserId, {
        userId: user.UserId,
        userName: user.UserName,
        email: user.Email || "",
        role: user.Role || "user",
        coachId: user.CoachId,
        coCoachId: deriveCoCoachId(user), // Dynamically derived from coach_teams_table
        status: user.Status,
        profileImage: user.ProfileImage || null,
        teamMembers: [],
        directMemberCount: 0,
        totalMemberCount: 0,
      });
    });

    // Recursive function to build hierarchy (creates duplicate entries for dual reporting)
    const buildHierarchy = (
      userId,
      parentCoachId = null,
      visited = new Set(),
      coachPartnerIds = [userId], // IDs of co-coach partners (to exclude from nested view)
    ) => {
      const user = userMap.get(userId);
      if (!user) return null;

      // Prevent circular references - check if we've already visited this user in current path
      if (visited.has(userId)) {
        console.warn(`Circular reference detected for userId: ${userId}`);
        return null;
      }

      // Add to visited set for this path
      const newVisited = new Set(visited);
      newVisited.add(userId);

      // Clone user data for this specific relationship path
      const userNode = {
        ...user,
        parentCoachId, // Track which coach this entry reports through
        teamMembers: [],
      };

      // Find all direct reports (where CoachId OR derived coCoachId matches userId)
      // EXCLUDE co-coach partners from appearing as nested members
      // NOTE: u.CoCoachId does NOT exist on raw DB rows — must use userMap for the derived value
      const directReports = allUsers.filter((u) => {
        const derivedCoCoachId = userMap.get(u.UserId)?.coCoachId;
        return (
          (u.CoachId === userId || derivedCoCoachId === userId) &&
          u.UserId !== userId &&
          !coachPartnerIds.includes(u.UserId)
        );
      });

      console.log(
        `🔍 [team-hierarchy] User ${user.userName} (${userId}) has ${directReports.length} direct reports:`,
        directReports.map((r) => ({
          UserId: r.UserId,
          UserName: r.UserName,
          CoachId: r.CoachId,
        })),
      );

      // For each direct report, create entries for BOTH coach and co-coach relationships
      directReports.forEach((report) => {
        // Skip if report is the same as current user (self-reference)
        if (report.UserId === userId) return;

        // If this user reports through CoachId
        if (report.CoachId === userId) {
          const childNode = buildHierarchy(
            report.UserId,
            userId,
            newVisited,
            coachPartnerIds,
          );
          if (childNode) {
            childNode.isCoachRelationship = true;
            userNode.teamMembers.push(childNode);
          }
        }

        // If this user reports through CoCoachId (and it's different from CoachId)
        if (
          report.CoCoachId === userId &&
          report.CoCoachId !== report.CoachId
        ) {
          const childNode = buildHierarchy(
            report.UserId,
            userId,
            newVisited,
            coachPartnerIds,
          );
          if (childNode) {
            childNode.isCoachRelationship = false;
            userNode.teamMembers.push(childNode);
          }
        }
      });

      userNode.directMemberCount = userNode.teamMembers.length;

      // Calculate total member count (recursive)
      userNode.totalMemberCount =
        userNode.directMemberCount +
        userNode.teamMembers.reduce(
          (sum, member) => sum + member.totalMemberCount,
          0,
        );

      return userNode;
    };

    // Find the logged-in coach
    const loggedInCoach = allUsers.find((u) => u.UserId === coachIdInt);
    if (!loggedInCoach) {
      res.status(404).json({ success: false, message: "Coach not found" });
      return;
    }

    // Check if this coach has a co-coach partner
    // Query coach_teams_table to find which team this coach manages
    let coachPartnerIds = [coachIdInt];
    
    const { data: managedTeam } = await supabase
      .from('coach_teams_table')
      .select('TeamId, CoachId, CoCoachId')
      .or(`CoachId.eq.${coachIdInt},CoCoachId.eq.${coachIdInt}`)
      .eq('Status', 'active')
      .maybeSingle();
    
    if (managedTeam && managedTeam.CoachId && managedTeam.CoCoachId) {
      // This coach has a co-coach partner - exclude both from each other's nested view
      coachPartnerIds = [managedTeam.CoachId, managedTeam.CoCoachId];
      console.log(`👥 [team-hierarchy] Co-coach partnership detected:`, {
        TeamId: managedTeam.TeamId,
        CoachId: managedTeam.CoachId,
        CoCoachId: managedTeam.CoCoachId,
        LoggedInCoach: coachIdInt,
        WillExcludePartnerIds: coachPartnerIds
      });
    }

    // Build hierarchy starting from logged-in coach
    // Pass coachPartnerIds to exclude partner from nested view
    const hierarchy = buildHierarchy(coachIdInt, null, new Set(), coachPartnerIds);

    // If co-coach partnership exists, store co-coach info but DON'T add to team members
    if (managedTeam && managedTeam.CoachId && managedTeam.CoCoachId) {
      const partnerId = managedTeam.CoachId === coachIdInt
        ? managedTeam.CoCoachId
        : managedTeam.CoachId;

      const partnerData = userMap.get(partnerId);
      if (partnerData) {
        // Store co-coach info at root level (NOT in teamMembers array)
        hierarchy.coCoachInfo = {
          ...partnerData,
          isCoCoach: true,
          parentCoachId: coachIdInt,
          teamMembers: [],
          directMemberCount: 0,
          totalMemberCount: 0,
        };

        // Find co-coach's direct members that aren't already in root's team
        const existingIds = new Set(hierarchy.teamMembers.map(m => m.userId));
        existingIds.add(coachIdInt);
        existingIds.add(partnerId);

        const coCoachDirectMembers = allUsers.filter(
          u => u.CoachId === partnerId && !existingIds.has(u.UserId)
        );

        console.log(`👥 [team-hierarchy] Adding ${coCoachDirectMembers.length} co-coach members to root`);

        // Build hierarchy for each co-coach member and add to root
        coCoachDirectMembers.forEach(member => {
          const memberNode = buildHierarchy(
            member.UserId,
            coachIdInt,
            new Set([coachIdInt, partnerId]),
            coachPartnerIds
          );
          if (memberNode) {
            hierarchy.teamMembers.push(memberNode);
          }
        });

        // Recalculate counts (co-coach NOT counted as a team member)
        hierarchy.directMemberCount = hierarchy.teamMembers.length;
        hierarchy.totalMemberCount = hierarchy.directMemberCount +
          hierarchy.teamMembers.reduce((sum, m) => sum + (m.totalMemberCount || 0), 0);
      }
    }

    // Flatten hierarchy to get all members (for enrollment reports)
    // Use Set to avoid duplicates from dual reporting relationships
    const flattenHierarchy = (node, result = new Map()) => {
      if (!node) return result;

      // Add current node (excluding the root coach for allMembers)
      // Use Map to ensure unique users by UserId
      if (node.userId !== coachIdInt && !result.has(node.userId)) {
        const entry = {
          UserId: node.userId,
          UserName: node.userName,
          Email: node.email,
          Role: node.role,
          CoachId: node.coachId,
          CoCoachId: node.coCoachId,
          Status: node.status,
        };
        if (node.isCoCoach) entry.isCoCoach = true;
        result.set(node.userId, entry);
      }

      // Recursively flatten children
      if (node.teamMembers && node.teamMembers.length > 0) {
        node.teamMembers.forEach((child) => flattenHierarchy(child, result));
      }

      return result;
    };

    const memberMap = flattenHierarchy(hierarchy);
    const allMembers = Array.from(memberMap.values());

    console.log(
      `✅ [team-hierarchy] Team hierarchy built for coach ${coachIdInt}: ${allMembers.length} unique members`,
    );
    console.log(
      `✅ [team-hierarchy] All members:`,
      allMembers.map((m) => ({
        UserId: m.UserId,
        UserName: m.UserName,
        CoachId: m.CoachId,
      })),
    );

    // Count statistics (use unique users)
    const uniqueUserIds = new Set(allUsers.map((u) => u.UserId));
    const coaches = allUsers.filter(
      (u) => u.Role === "coach" || u.Role === "admin",
    );
    const totalMembers = allUsers.filter((u) => u.Role === "user");

    res.status(200).json({
      success: true,
      loggedInCoach: {
        userId: hierarchy.userId,
        userName: hierarchy.userName,
        email: hierarchy.email,
        role: hierarchy.role,
        coachId: hierarchy.coachId,
        coCoachId: hierarchy.coCoachId,
        totalMemberCount: hierarchy.totalMemberCount,
      },
      hierarchy: hierarchy,
      allMembers: allMembers, // Flat array of all unique team members
      stats: {
        totalCoaches: coaches.length,
        totalMembers: totalMembers.length,
        totalUsers: uniqueUserIds.size,
      },
    });
  } catch (error) {
    console.error("Team hierarchy error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
}
