import { getSupabaseClient } from "../../../utils/supabaseClient.js";
import logger from '../../../shared/lib/logger.js';
import { isActiveTeamStatus } from '../../../utils/teamHierarchyBuilder.js';
import {
  buildLeadPartnerByUserId,
  listPrimaryDirectReports,
} from '../../../utils/teamHierarchyTree.js';
import { resolveCommunityPeerCoachIds } from '../../../utils/communityTeamVisibility.js';
import { getLatestWeightMetricsByUserIds } from '../../../features/user/user.repository.js';
import { computeBmiFromHeightWeight } from '../../../features/body-parameters-card/domain/card.rules.js';

/**
 * API: Get Hierarchical Team Structure
 * Returns nested team hierarchy for the All Teams / Leadership Dashboard view.
 *
 * Primary tree edges use CoachId only. Co-coach partners are attached as
 * metadata and (for shared-team leads) their CoachId downline is merged at
 * the root — never via recursive CoCoachId parent relationships.
 *
 * Same Community ID independent coaches are merged for Team visibility only
 * (their Direct/Full downlines) — never as Coach / Co-Coach of each other.
 *
 * By default, allMembers (used by Diary / team search) contains Active users only.
 * Pass includeInactive=true to include Inactive users in the flat list.
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
    const { coachId, email, includeInactive: includeInactiveRaw } = req.query;
    const includeInactive =
      String(includeInactiveRaw || '').toLowerCase() === 'true';

    logger.debug("📊 [team-hierarchy] Request:", {
      coachId,
      email,
      includeInactive,
    });

    const supabase = getSupabaseClient();
    let coachIdInt;

    // If email is provided, look up the coach ID
    if (email) {
      logger.debug("🔍 [team-hierarchy] Looking up coach by email:", email);
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
      logger.debug("✅ [team-hierarchy] Found coach ID:", coachIdInt);
    } else if (coachId) {
      coachIdInt = parseInt(coachId);
      // ── Demo account redirect for App Store review ───────────────────────
      // The old build stored userId=9999 (fake). Silently remap to real user 554.
      if (coachIdInt === 9999) coachIdInt = 554;
      // ─────────────────────────────────────────────────────────────────────
      logger.debug("✅ [team-hierarchy] Using provided coach ID:", coachIdInt);
    } else {
      console.error("❌ [team-hierarchy] No coach ID or email provided");
      res
        .status(400)
        .json({ success: false, message: "Coach ID or email required" });
      return;
    }

    // Fetch all users in the hierarchy (omit ProfileImage base64 — ~16MB on large trees).
    // Leaderboard strips load avatars separately for top-N only.
    // Optional body-metric columns may be missing until migration — fall back.
    const SELECT_FULL =
      "UserId, UserName, Email, Role, CoachId, CoachTeamId, Status, PhoneNumber, Height, Bmr, CommunityId, Gender, Age, VisceralFat, BodyAge, ChestCm, WaistCm, HipCm";
    const SELECT_BASIC =
      "UserId, UserName, Email, Role, CoachId, CoachTeamId, Status, PhoneNumber, Height, Bmr, CommunityId, Gender";

    let allUsers;
    let usersError;
    ({ data: allUsers, error: usersError } = await supabase
      .from("team_table")
      .select(SELECT_FULL)
      .order("UserName"));

    if (
      usersError &&
      /Age|VisceralFat|BodyAge|ChestCm|WaistCm|HipCm/i.test(String(usersError.message || "")) &&
      /column/i.test(String(usersError.message || ""))
    ) {
      ({ data: allUsers, error: usersError } = await supabase
        .from("team_table")
        .select(SELECT_BASIC)
        .order("UserName"));
    }

    if (usersError) {
      console.error("Error fetching users:", usersError);
      res
        .status(500)
        .json({ success: false, message: "Failed to fetch team data" });
      return;
    }

    logger.debug(
      `📊 [team-hierarchy] Fetched ${allUsers?.length || 0} total users from database`,
    );
    logger.debug(
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

    // Load coach_teams for display CoCoachId + lead-partner exclusion map.
    // Tree edges use CoachId only (see teamHierarchyTree.js).
    // TEMPORARY: CoachTeamId is currently TeamId string until database migration
    const coachTeamIds = [...new Set(allUsers.map(u => u.CoachTeamId).filter(Boolean))];
    logger.debug(`📊 [team-hierarchy] Fetching ${coachTeamIds.length} coach teams for co-coach derivation`);
    
    const coachTeamsMap = {}; // Maps TeamId string -> {CoachId, CoCoachId}
    const coachTeamRows = [];
    if (coachTeamIds.length > 0) {
      const { data: coachTeams, error: teamsError } = await supabase
        .from("coach_teams_table")
        .select("Id, TeamId, CoachId, CoCoachId")
        .in("TeamId", coachTeamIds) // TEMPORARY: Query by TeamId string until schema migration
        .eq("Status", "active");
      
      if (teamsError) {
        console.error("❌ [team-hierarchy] Error fetching coach teams:", teamsError);
      } else if (coachTeams) {
        coachTeams.forEach(team => {
          coachTeamRows.push(team);
          coachTeamsMap[team.TeamId] = { // TEMPORARY: Map by TeamId string
            coachId: team.CoachId,
            coCoachId: team.CoCoachId
          };
        });
        logger.debug(`✅ [team-hierarchy] Loaded ${coachTeams.length} active coach team partnerships`);
      }
    }

    const leadPartnerByUserId = buildLeadPartnerByUserId(coachTeamRows);
    
    // Helper: display-only coCoachId for members (not used for tree edges)
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
    const numOrNull = (v) => {
      if (v == null || v === "") return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };
    const userMap = new Map();
    allUsers.forEach((user) => {
      userMap.set(user.UserId, {
        userId: user.UserId,
        userName: user.UserName,
        email: user.Email || "",
        communityId: user.CommunityId ? String(user.CommunityId).trim() : null,
        role: user.Role || "user",
        coachId: user.CoachId,
        coCoachId: deriveCoCoachId(user), // Dynamically derived from coach_teams_table
        status: user.Status,
        profileImage: null,
        phoneNumber: user.PhoneNumber ? String(user.PhoneNumber).trim() : null,
        height: user.Height != null ? Number(user.Height) : null,
        bmr: user.Bmr != null ? Number(user.Bmr) : null,
        gender: user.Gender || null,
        age: numOrNull(user.Age),
        visceralFat: numOrNull(user.VisceralFat),
        bodyAge: numOrNull(user.BodyAge),
        chestCm: numOrNull(user.ChestCm),
        waistCm: numOrNull(user.WaistCm),
        hipCm: numOrNull(user.HipCm),
        teamMembers: [],
        directMemberCount: 0,
        totalMemberCount: 0,
      });
    });

    // Collect the active descendants of an Inactive node, recursively.
    // Walk CoachId only — never derived CoCoachId.
    // NOTE: defined before buildHierarchy but only called at runtime (mutual
    //       recursion is safe because both are fully defined before first call).
    const collectPromotedChildren = (inactiveUserId, promotedParentId, visited) => {
      const result = [];
      const newVisited = new Set(visited);
      newVisited.add(inactiveUserId);

      const directReports = listPrimaryDirectReports(
        allUsers,
        inactiveUserId,
        leadPartnerByUserId,
        newVisited,
      );

      directReports.forEach((report) => {
        if (!isActiveTeamStatus(report.Status)) {
          // Inactive chain: keep promoting deeper
          const deeper = collectPromotedChildren(report.UserId, promotedParentId, newVisited);
          result.push(...deeper);
        } else {
          const childNode = buildHierarchy(report.UserId, promotedParentId, newVisited);
          if (childNode) {
            childNode.isCoachRelationship = true;
            result.push(childNode);
          }
        }
      });

      return result;
    };

    // Recursive function to build primary CoachId hierarchy
    const buildHierarchy = (
      userId,
      parentCoachId = null,
      visited = new Set(),
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

      // Primary CoachId directs only. Co-coach partners of this node are excluded.
      const directReports = listPrimaryDirectReports(
        allUsers,
        userId,
        leadPartnerByUserId,
        newVisited,
      );

      logger.debug(
        `🔍 [team-hierarchy] User ${user.userName} (${userId}) has ${directReports.length} direct reports:`,
        directReports.map((r) => ({
          UserId: r.UserId,
          UserName: r.UserName,
          CoachId: r.CoachId,
        })),
      );

      directReports.forEach((report) => {
        // Skip if report is the same as current user (self-reference)
        if (report.UserId === userId) return;

        // If this direct report is Inactive: hide it, promote its active descendants up
        if (!isActiveTeamStatus(report.Status)) {
          const promoted = collectPromotedChildren(report.UserId, userId, newVisited);
          promoted.forEach((child) => userNode.teamMembers.push(child));
          return;
        }

        const childNode = buildHierarchy(
          report.UserId,
          userId,
          newVisited,
        );
        if (childNode) {
          childNode.isCoachRelationship = true;
          userNode.teamMembers.push(childNode);
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

    logger.debug(`🔍 [team-hierarchy] Logged-in user:`, {
      UserId: loggedInCoach.UserId,
      UserName: loggedInCoach.UserName,
      Role: loggedInCoach.Role,
      CoachId: loggedInCoach.CoachId,
      CoachTeamId: loggedInCoach.CoachTeamId
    });

    // Check if this coach has a co-coach partner
    // Query coach_teams_table using BOTH the user's ID and their CoachTeamId
    let managedTeam = null;
    
    // Try multiple approaches to find the partnership:
    // 1. Check if user is Coach or CoCoach in coach_teams_table
    const { data: teamByRole } = await supabase
      .from('coach_teams_table')
      .select('TeamId, CoachId, CoCoachId')
      .or(`CoachId.eq.${coachIdInt},CoCoachId.eq.${coachIdInt}`)
      .eq('Status', 'active')
      .maybeSingle();
    
    // 2. If user has CoachTeamId, also try looking up by TeamId
    if (!teamByRole && loggedInCoach.CoachTeamId) {
      const { data: teamByTeamId } = await supabase
        .from('coach_teams_table')
        .select('TeamId, CoachId, CoCoachId')
        .eq('TeamId', loggedInCoach.CoachTeamId)
        .eq('Status', 'active')
        .maybeSingle();
      
      // Verify the user is actually part of this team
      if (teamByTeamId && 
          (teamByTeamId.CoachId === coachIdInt || teamByTeamId.CoCoachId === coachIdInt)) {
        managedTeam = teamByTeamId;
      }
    } else {
      managedTeam = teamByRole;
    }
    
    logger.debug(`🔍 [team-hierarchy] Partnership lookup result:`, {
      foundTeam: !!managedTeam,
      teamData: managedTeam ? {
        TeamId: managedTeam.TeamId,
        CoachId: managedTeam.CoachId,
        CoCoachId: managedTeam.CoCoachId
      } : null,
      loggedInUserId: coachIdInt,
      loggedInUserTeamId: loggedInCoach.CoachTeamId
    });

    if (managedTeam?.CoachId && managedTeam?.CoCoachId) {
      const a = Number(managedTeam.CoachId);
      const b = Number(managedTeam.CoCoachId);
      if (Number.isFinite(a) && Number.isFinite(b) && a !== b) {
        leadPartnerByUserId.set(a, b);
        leadPartnerByUserId.set(b, a);
      }
      logger.debug(`👥 [team-hierarchy] Co-coach partnership detected:`, {
        TeamId: managedTeam.TeamId,
        CoachId: managedTeam.CoachId,
        CoCoachId: managedTeam.CoCoachId,
        LoggedInCoach: coachIdInt,
      });
    }

    // Build primary CoachId hierarchy starting from logged-in coach
    const hierarchy = buildHierarchy(coachIdInt, null, new Set());

    // If co-coach partnership exists, store co-coach info but DON'T add to team members
    if (managedTeam && managedTeam.CoachId && managedTeam.CoCoachId) {
      const partnerId = managedTeam.CoachId === coachIdInt
        ? managedTeam.CoCoachId
        : managedTeam.CoachId;

      // Mark the logged-in user's role in the partnership
      const loggedInIsCoach = (coachIdInt === managedTeam.CoachId);
      hierarchy.isCoach = loggedInIsCoach;
      hierarchy.isCoCoach = !loggedInIsCoach;

      const partnerData = userMap.get(partnerId);
      if (partnerData) {
        // Store co-coach info at root level (NOT in teamMembers array)
        hierarchy.coCoachInfo = {
          ...partnerData,
          isCoach: !loggedInIsCoach,
          isCoCoach: loggedInIsCoach,
          parentCoachId: null,
          teamMembers: [],
          directMemberCount: 0,
          totalMemberCount: 0,
        };

        logger.debug(`✅ [team-hierarchy] Partnership setup complete:`, {
          LoggedInUser: {
            userId: hierarchy.userId,
            userName: hierarchy.userName,
            isCoach: hierarchy.isCoach,
            isCoCoach: hierarchy.isCoCoach
          },
          Partner: {
            userId: hierarchy.coCoachInfo.userId,
            userName: hierarchy.coCoachInfo.userName,
            isCoach: hierarchy.coCoachInfo.isCoach,
            isCoCoach: hierarchy.coCoachInfo.isCoCoach
          }
        });

        // Shared visibility: append partner's primary CoachId directs + subtrees.
        const existingIds = new Set(hierarchy.teamMembers.map(m => m.userId));
        existingIds.add(coachIdInt);
        existingIds.add(partnerId);

        const partnerMembers = listPrimaryDirectReports(
          allUsers,
          partnerId,
          leadPartnerByUserId,
          existingIds,
        );

        logger.debug(`👥 [team-hierarchy] Merging ${partnerMembers.length} partner CoachId directs:`,
          partnerMembers.map(m => ({ 
            UserId: m.UserId, 
            UserName: m.UserName, 
            CoachId: m.CoachId,
            CoachTeamId: m.CoachTeamId 
          }))
        );

        // Build hierarchy for each partner member and add to root.
        // Inactive members are hidden; their active descendants are promoted.
        partnerMembers.forEach(member => {
          if (!isActiveTeamStatus(member.Status)) {
            const promoted = collectPromotedChildren(
              member.UserId,
              partnerId,
              new Set([coachIdInt, partnerId]),
            );
            promoted.forEach((child) => {
              if (!existingIds.has(child.userId)) {
                existingIds.add(child.userId);
                hierarchy.teamMembers.push(child);
              }
            });
            return;
          }
          const memberNode = buildHierarchy(
            member.UserId,
            partnerId,
            new Set([coachIdInt, partnerId]),
          );
          if (memberNode && !existingIds.has(memberNode.userId)) {
            existingIds.add(memberNode.userId);
            hierarchy.teamMembers.push(memberNode);
          }
        });

        // Recalculate counts (co-coach NOT counted as a team member)
        hierarchy.directMemberCount = hierarchy.teamMembers.length;
        hierarchy.totalMemberCount = hierarchy.directMemberCount +
          hierarchy.teamMembers.reduce((sum, m) => sum + (m.totalMemberCount || 0), 0);
      } else {
        console.warn(`⚠️ [team-hierarchy] Partner data not found for partnerId: ${partnerId}`);
      }
    } else {
      logger.debug(`ℹ️ [team-hierarchy] No co-coach partnership found for user ${coachIdInt}`);
    }

    // Same Community ID: merge independent peer coaches' Direct/Full downlines
    // for Team visibility. Do not attach coCoachInfo or create CoachId edges.
    const partnerIdsForCommunity = managedTeam?.CoachId && managedTeam?.CoCoachId
      ? [managedTeam.CoachId, managedTeam.CoCoachId].filter((id) => Number(id) !== coachIdInt)
      : [];
    const communityPeerIds = resolveCommunityPeerCoachIds(coachIdInt, allUsers, {
      partnerIds: partnerIdsForCommunity,
    });

    if (hierarchy && communityPeerIds.length > 0) {
      const existingIds = new Set(hierarchy.teamMembers.map((m) => m.userId));
      existingIds.add(coachIdInt);
      for (const pid of partnerIdsForCommunity) existingIds.add(Number(pid));
      for (const peerId of communityPeerIds) existingIds.add(Number(peerId));

      logger.debug(`🏘️ [team-hierarchy] Merging ${communityPeerIds.length} community peer coach trees:`,
        communityPeerIds);

      for (const peerId of communityPeerIds) {
        const peerMembers = listPrimaryDirectReports(
          allUsers,
          peerId,
          leadPartnerByUserId,
          existingIds,
        );

        peerMembers.forEach((member) => {
          if (!isActiveTeamStatus(member.Status)) {
            const promoted = collectPromotedChildren(
              member.UserId,
              peerId,
              new Set([coachIdInt, peerId]),
            );
            promoted.forEach((child) => {
              if (!existingIds.has(child.userId)) {
                existingIds.add(child.userId);
                hierarchy.teamMembers.push(child);
              }
            });
            return;
          }
          const memberNode = buildHierarchy(
            member.UserId,
            peerId,
            new Set([coachIdInt, peerId]),
          );
          if (memberNode && !existingIds.has(memberNode.userId)) {
            existingIds.add(memberNode.userId);
            hierarchy.teamMembers.push(memberNode);
          }
        });
      }

      hierarchy.directMemberCount = hierarchy.teamMembers.length;
      hierarchy.totalMemberCount = hierarchy.directMemberCount
        + hierarchy.teamMembers.reduce((sum, m) => sum + (m.totalMemberCount || 0), 0);
    }

    // Flatten hierarchy to get all members (for Diary / team search).
    // Active-only by default — matches teamHierarchyBuilder + includeInactive flag.
    // Use Map to avoid duplicates from dual reporting relationships.
    const flattenHierarchy = (node, result = new Map()) => {
      if (!node) return result;

      const includeNode = includeInactive || isActiveTeamStatus(node.status);
      // Add current node (excluding the root coach for allMembers)
      if (
        includeNode &&
        node.userId !== coachIdInt &&
        !result.has(node.userId)
      ) {
        const entry = {
          UserId: node.userId,
          UserName: node.userName,
          Email: node.email,
          CommunityId: node.communityId || null,
          Role: node.role,
          CoachId: node.coachId,
          CoCoachId: node.coCoachId,
          Status: node.status,
          phoneNumber: node.phoneNumber || null,
          height: node.height != null ? node.height : null,
          bmr: node.bmr != null ? node.bmr : null,
          gender: node.gender || null,
          age: node.age != null ? node.age : null,
          visceralFat: node.visceralFat != null ? node.visceralFat : null,
          bodyAge: node.bodyAge != null ? node.bodyAge : null,
          chestCm: node.chestCm != null ? node.chestCm : null,
          waistCm: node.waistCm != null ? node.waistCm : null,
          hipCm: node.hipCm != null ? node.hipCm : null,
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
    
    // Add co-coach to allMembers for search functionality
    // Even though they're excluded from the nested tree view, they should be searchable
    // when Active (or when includeInactive is requested).
    if (
      hierarchy.coCoachInfo &&
      !memberMap.has(hierarchy.coCoachInfo.userId) &&
      (includeInactive || isActiveTeamStatus(hierarchy.coCoachInfo.status))
    ) {
      memberMap.set(hierarchy.coCoachInfo.userId, {
        UserId: hierarchy.coCoachInfo.userId,
        UserName: hierarchy.coCoachInfo.userName,
        Email: hierarchy.coCoachInfo.email,
        CommunityId: hierarchy.coCoachInfo.communityId || null,
        Role: hierarchy.coCoachInfo.role,
        CoachId: hierarchy.coCoachInfo.coachId,
        CoCoachId: hierarchy.coCoachInfo.coCoachId,
        Status: hierarchy.coCoachInfo.status,
        phoneNumber: hierarchy.coCoachInfo.phoneNumber || null,
        height: hierarchy.coCoachInfo.height != null ? hierarchy.coCoachInfo.height : null,
        bmr: hierarchy.coCoachInfo.bmr != null ? hierarchy.coCoachInfo.bmr : null,
        gender: hierarchy.coCoachInfo.gender || null,
        age: hierarchy.coCoachInfo.age != null ? hierarchy.coCoachInfo.age : null,
        visceralFat: hierarchy.coCoachInfo.visceralFat != null ? hierarchy.coCoachInfo.visceralFat : null,
        bodyAge: hierarchy.coCoachInfo.bodyAge != null ? hierarchy.coCoachInfo.bodyAge : null,
        chestCm: hierarchy.coCoachInfo.chestCm != null ? hierarchy.coCoachInfo.chestCm : null,
        waistCm: hierarchy.coCoachInfo.waistCm != null ? hierarchy.coCoachInfo.waistCm : null,
        hipCm: hierarchy.coCoachInfo.hipCm != null ? hierarchy.coCoachInfo.hipCm : null,
        isCoCoach: true
      });
    }
    
    const allMembers = Array.from(memberMap.values());

    // Attach latest weight / fat% / BMI for BCM phone prefill (best-effort).
    try {
      const weightByUser = await getLatestWeightMetricsByUserIds(
        allMembers.map((m) => m.UserId),
      );
      for (const m of allMembers) {
        const w = weightByUser.get(Number(m.UserId));
        if (!w) continue;
        m.weightKg = w.weightKg;
        m.fatPercent = w.fatPercent;
        let bmi = w.bmi;
        if (bmi == null && w.weightKg != null && m.height != null) {
          bmi = computeBmiFromHeightWeight(m.height, w.weightKg);
        }
        m.bmi = bmi;
        if (m.bmr == null && w.bmr != null) m.bmr = w.bmr;
      }
    } catch (weightErr) {
      logger.warn('[team-hierarchy] weight enrich failed', {
        message: weightErr?.message || String(weightErr),
      });
    }

    logger.debug(
      `✅ [team-hierarchy] Team hierarchy built for coach ${coachIdInt}: ${allMembers.length} unique members`,
    );
    logger.debug(
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
