/**
 * Shared Team Hierarchy Builder
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for building the coach → co-coach → team-members tree
 * used by /api/coach/team-hierarchy (Discipline Report) AND
 * /api/coach/hierarchical-club-attendance (Attendance Report).
 *
 * Extracted verbatim from the original team-hierarchy.js handler so that both
 * endpoints produce *identical* member lists and respect the same partnership
 * rules.  Includes the pre-existing cycle guards (`visited` Set in
 * `buildHierarchy`) so it cannot stack-overflow.
 */

/**
 * @param {object} supabase  Supabase client
 * @param {number} coachIdInt  Logged-in user id (already parsed to int)
 * @param {object} [opts]
 * @param {boolean} [opts.includeInactive=false]
 * @returns {Promise<{ hierarchy: object|null, allMembers: object[], loggedInCoach: object|null, stats: object }>}
 */
export async function buildTeamHierarchy(supabase, coachIdInt, opts = {}) {
  const { includeInactive = false } = opts;

  // 1. Fetch all users
  let query = supabase
    .from('team_table')
    .select('UserId, UserName, Email, Role, CoachId, CoachTeamId, Status, ProfileImage');
  if (!includeInactive) query = query.eq('Status', 'Active');
  const { data: allUsers, error: usersError } = await query.order('UserName');

  if (usersError) throw new Error('Failed to fetch team data: ' + usersError.message);
  if (!allUsers || allUsers.length === 0) {
    return {
      hierarchy: null,
      allMembers: [],
      loggedInCoach: null,
      stats: { totalCoaches: 0, totalMembers: 0, totalUsers: 0 },
    };
  }

  // 2. Derive CoCoachId from coach_teams_table
  const coachTeamIds = [...new Set(allUsers.map(u => u.CoachTeamId).filter(Boolean))];
  const coachTeamsMap = {};
  if (coachTeamIds.length > 0) {
    const { data: coachTeams } = await supabase
      .from('coach_teams_table')
      .select('Id, TeamId, CoachId, CoCoachId')
      .in('TeamId', coachTeamIds)
      .eq('Status', 'active');
    if (coachTeams) {
      coachTeams.forEach(team => {
        coachTeamsMap[team.TeamId] = { coachId: team.CoachId, coCoachId: team.CoCoachId };
      });
    }
  }

  const deriveCoCoachId = (user) => {
    if (!user.CoachTeamId) return null;
    const team = coachTeamsMap[user.CoachTeamId];
    if (!team) return null;
    if (user.CoachId === team.coachId) return team.coCoachId;
    if (user.CoachId === team.coCoachId) return team.coachId;
    return null;
  };

  // 3. Build user map
  const userMap = new Map();
  allUsers.forEach(user => {
    userMap.set(user.UserId, {
      userId: user.UserId,
      userName: user.UserName,
      email: user.Email || '',
      role: user.Role || 'user',
      coachId: user.CoachId,
      coCoachId: deriveCoCoachId(user),
      status: user.Status,
      profileImage: user.ProfileImage || null,
      teamMembers: [],
      directMemberCount: 0,
      totalMemberCount: 0,
    });
  });

  // 4. Recursive tree builder (with the existing visited-Set cycle guard).
  const buildHierarchy = (
    userId,
    parentCoachId = null,
    visited = new Set(),
    coachPartnerIds = [userId],
  ) => {
    const user = userMap.get(userId);
    if (!user) return null;
    if (visited.has(userId)) return null;

    const newVisited = new Set(visited);
    newVisited.add(userId);

    const userNode = { ...user, parentCoachId, teamMembers: [] };

    const directReports = allUsers.filter(u => {
      const derivedCoCoachId = userMap.get(u.UserId)?.coCoachId;
      return (
        (u.CoachId === userId || derivedCoCoachId === userId) &&
        u.UserId !== userId &&
        !coachPartnerIds.includes(u.UserId)
      );
    });

    directReports.forEach(report => {
      if (report.UserId === userId) return;

      if (report.CoachId === userId) {
        const childNode = buildHierarchy(report.UserId, userId, newVisited, coachPartnerIds);
        if (childNode) {
          childNode.isCoachRelationship = true;
          userNode.teamMembers.push(childNode);
        }
      }

      const reportCoCoachId = userMap.get(report.UserId)?.coCoachId;
      if (
        reportCoCoachId === userId &&
        reportCoCoachId !== report.CoachId
      ) {
        const childNode = buildHierarchy(report.UserId, userId, newVisited, coachPartnerIds);
        if (childNode) {
          childNode.isCoachRelationship = false;
          userNode.teamMembers.push(childNode);
        }
      }
    });

    userNode.directMemberCount = userNode.teamMembers.length;
    userNode.totalMemberCount =
      userNode.directMemberCount +
      userNode.teamMembers.reduce((sum, m) => sum + (m.totalMemberCount || 0), 0);

    return userNode;
  };

  // 5. Find logged-in coach
  const loggedInCoach = allUsers.find(u => u.UserId === coachIdInt);
  if (!loggedInCoach) {
    return {
      hierarchy: null,
      allMembers: [],
      loggedInCoach: null,
      stats: { totalCoaches: 0, totalMembers: 0, totalUsers: allUsers.length },
    };
  }

  // 6. Look up partnership (covers both "by role" and "by team id" paths)
  let coachPartnerIds = [coachIdInt];
  let managedTeam = null;

  const { data: teamByRole } = await supabase
    .from('coach_teams_table')
    .select('TeamId, CoachId, CoCoachId')
    .or(`CoachId.eq.${coachIdInt},CoCoachId.eq.${coachIdInt}`)
    .eq('Status', 'active')
    .maybeSingle();

  if (!teamByRole && loggedInCoach.CoachTeamId) {
    const { data: teamByTeamId } = await supabase
      .from('coach_teams_table')
      .select('TeamId, CoachId, CoCoachId')
      .eq('TeamId', loggedInCoach.CoachTeamId)
      .eq('Status', 'active')
      .maybeSingle();
    if (
      teamByTeamId &&
      (teamByTeamId.CoachId === coachIdInt || teamByTeamId.CoCoachId === coachIdInt)
    ) {
      managedTeam = teamByTeamId;
    }
  } else {
    managedTeam = teamByRole;
  }

  if (managedTeam && managedTeam.CoachId && managedTeam.CoCoachId) {
    coachPartnerIds = [managedTeam.CoachId, managedTeam.CoCoachId];
  }

  // 7. Build hierarchy
  const hierarchy = buildHierarchy(coachIdInt, null, new Set(), coachPartnerIds);

  // 8. Attach co-coach partnership info + merge partner's downline at root
  if (managedTeam && managedTeam.CoachId && managedTeam.CoCoachId && hierarchy) {
    const partnerId = managedTeam.CoachId === coachIdInt
      ? managedTeam.CoCoachId
      : managedTeam.CoachId;

    const loggedInIsCoach = (coachIdInt === managedTeam.CoachId);
    hierarchy.isCoach = loggedInIsCoach;
    hierarchy.isCoCoach = !loggedInIsCoach;

    const partnerData = userMap.get(partnerId);
    if (partnerData) {
      hierarchy.coCoachInfo = {
        ...partnerData,
        isCoach: !loggedInIsCoach,
        isCoCoach: loggedInIsCoach,
        parentCoachId: coachIdInt,
        teamMembers: [],
        directMemberCount: 0,
        totalMemberCount: 0,
      };

      // Merge ALL members who report to EITHER partner
      const existingIds = new Set(hierarchy.teamMembers.map(m => m.userId));
      existingIds.add(coachIdInt);
      existingIds.add(partnerId);

      const partnerMembers = allUsers.filter(u => {
        const derivedCoCoachId = userMap.get(u.UserId)?.coCoachId;
        const reportsToEitherPartner = (
          u.CoachId === coachIdInt ||
          u.CoachId === partnerId ||
          derivedCoCoachId === coachIdInt ||
          derivedCoCoachId === partnerId
        );
        return reportsToEitherPartner && !existingIds.has(u.UserId);
      });

      partnerMembers.forEach(member => {
        const memberNode = buildHierarchy(
          member.UserId,
          coachIdInt,
          new Set([coachIdInt, partnerId]),
          coachPartnerIds,
        );
        if (memberNode) hierarchy.teamMembers.push(memberNode);
      });

      hierarchy.directMemberCount = hierarchy.teamMembers.length;
      hierarchy.totalMemberCount =
        hierarchy.directMemberCount +
        hierarchy.teamMembers.reduce((sum, m) => sum + (m.totalMemberCount || 0), 0);
    }
  }

  // 9. Flatten hierarchy → allMembers
  const flattenHierarchy = (node, result = new Map()) => {
    if (!node) return result;
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
    if (node.teamMembers && node.teamMembers.length > 0) {
      node.teamMembers.forEach(child => flattenHierarchy(child, result));
    }
    return result;
  };

  const memberMap = flattenHierarchy(hierarchy);
  if (hierarchy?.coCoachInfo && !memberMap.has(hierarchy.coCoachInfo.userId)) {
    memberMap.set(hierarchy.coCoachInfo.userId, {
      UserId: hierarchy.coCoachInfo.userId,
      UserName: hierarchy.coCoachInfo.userName,
      Email: hierarchy.coCoachInfo.email,
      Role: hierarchy.coCoachInfo.role,
      CoachId: hierarchy.coCoachInfo.coachId,
      CoCoachId: hierarchy.coCoachInfo.coCoachId,
      Status: hierarchy.coCoachInfo.status,
      isCoCoach: true,
    });
  }
  const allMembers = Array.from(memberMap.values());

  const uniqueUserIds = new Set(allUsers.map(u => u.UserId));
  const coaches = allUsers.filter(u => u.Role === 'coach' || u.Role === 'admin');
  const totalMembers = allUsers.filter(u => u.Role === 'user');

  return {
    hierarchy,
    allMembers,
    loggedInCoach: hierarchy
      ? {
          userId: hierarchy.userId,
          userName: hierarchy.userName,
          email: hierarchy.email,
          role: hierarchy.role,
          coachId: hierarchy.coachId,
          coCoachId: hierarchy.coCoachId,
          totalMemberCount: hierarchy.totalMemberCount,
        }
      : null,
    stats: {
      totalCoaches: coaches.length,
      totalMembers: totalMembers.length,
      totalUsers: uniqueUserIds.size,
    },
  };
}
