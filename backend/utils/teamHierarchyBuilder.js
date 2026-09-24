/**
 * Shared Team Hierarchy Builder
 * ─────────────────────────────────────────────────────────────────────────────
 * Builds the CoachId primary tree for Reports / Results / Leadership Dashboard.
 * Co-coach partners are metadata + optional root-level shared merge of the
 * partner's CoachId tree — never recursive CoCoachId parent edges.
 *
 * Inactive users are hidden by default; their active descendants are promoted
 * to the nearest active ancestor (same rules as team-hierarchy.js).
 *
 * Includes the pre-existing cycle guards (`visited` Set in `buildHierarchy`) so
 * it cannot stack-overflow.
 */

import {
  filterPublicAggregateUsers,
  shouldExcludeDeveloperFromAggregates,
} from '../features/user/domain/aggregate-eligibility.rules.js';
import {
  buildLeadPartnerByUserId,
  listPrimaryDirectReports,
} from './teamHierarchyTree.js';

/** Case-insensitive active check for team_table.Status. */
export function isActiveTeamStatus(status) {
  return String(status || '').toLowerCase() === 'active';
}

/**
 * @param {object} supabase  Supabase client
 * @param {number} coachIdInt  Logged-in user id (already parsed to int)
 * @param {object} [opts]
 * @param {boolean} [opts.includeInactive=false] — include inactive users in allMembers
 * @returns {Promise<{ hierarchy: object|null, allMembers: object[], loggedInCoach: object|null, stats: object }>}
 */
export async function buildTeamHierarchy(supabase, coachIdInt, opts = {}) {
  const { includeInactive = false } = opts;

  // 1. Fetch all users (Active + Inactive) so inactive intermediate coaches
  // can be detected and their active members promoted upward.
  const { data: allUsers, error: usersError } = await supabase
    .from('team_table')
    .select('UserId, UserName, Email, Role, CoachId, CoachTeamId, Status, ProfileImage')
    .order('UserName');

  if (usersError) throw new Error('Failed to fetch team data: ' + usersError.message);
  if (!allUsers || allUsers.length === 0) {
    return {
      hierarchy: null,
      allMembers: [],
      loggedInCoach: null,
      stats: { totalCoaches: 0, totalMembers: 0, totalUsers: 0 },
    };
  }

  // 2. Load coach_teams for display CoCoachId + lead-partner exclusion map.
  // Tree edges use CoachId only (see teamHierarchyTree.js).
  const coachTeamIds = [...new Set(allUsers.map(u => u.CoachTeamId).filter(Boolean))];
  const coachTeamsMap = {};
  const coachTeamRows = [];
  if (coachTeamIds.length > 0) {
    const { data: coachTeams } = await supabase
      .from('coach_teams_table')
      .select('Id, TeamId, CoachId, CoCoachId')
      .in('TeamId', coachTeamIds)
      .eq('Status', 'active');
    if (coachTeams) {
      coachTeams.forEach(team => {
        coachTeamRows.push(team);
        coachTeamsMap[team.TeamId] = { coachId: team.CoachId, coCoachId: team.CoCoachId };
      });
    }
  }

  const leadPartnerByUserId = buildLeadPartnerByUserId(coachTeamRows);

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

  // Collect active descendants of an inactive node (promote up to active ancestor).
  // Walk CoachId only — never derived CoCoachId.
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
        const deeper = collectPromotedChildren(report.UserId, promotedParentId, newVisited);
        result.push(...deeper);
        return;
      }
      const childNode = buildHierarchy(report.UserId, promotedParentId, newVisited);
      if (childNode) {
        childNode.isCoachRelationship = true;
        result.push(childNode);
      }
    });

    return result;
  };

  // 4. Recursive tree builder — primary CoachId edges only.
  const buildHierarchy = (
    userId,
    parentCoachId = null,
    visited = new Set(),
  ) => {
    const user = userMap.get(userId);
    if (!user) return null;
    if (visited.has(userId)) return null;

    const newVisited = new Set(visited);
    newVisited.add(userId);

    const userNode = { ...user, parentCoachId, teamMembers: [] };

    const directReports = listPrimaryDirectReports(
      allUsers,
      userId,
      leadPartnerByUserId,
      newVisited,
    );

    directReports.forEach(report => {
      if (report.UserId === userId) return;

      // Hide inactive nodes; bubble their active descendants up to this ancestor.
      if (!isActiveTeamStatus(report.Status)) {
        const promoted = collectPromotedChildren(report.UserId, userId, newVisited);
        promoted.forEach((child) => userNode.teamMembers.push(child));
        return;
      }

      const childNode = buildHierarchy(report.UserId, userId, newVisited);
      if (childNode) {
        childNode.isCoachRelationship = true;
        userNode.teamMembers.push(childNode);
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

  if (managedTeam?.CoachId && managedTeam?.CoCoachId) {
    // Ensure viewer's partnership is on the exclusion map even if TeamId
    // was missing from the bulk CoachTeamId fetch.
    const a = Number(managedTeam.CoachId);
    const b = Number(managedTeam.CoCoachId);
    if (Number.isFinite(a) && Number.isFinite(b) && a !== b) {
      leadPartnerByUserId.set(a, b);
      leadPartnerByUserId.set(b, a);
    }
  }

  // 7. Build primary CoachId hierarchy
  const hierarchy = buildHierarchy(coachIdInt, null, new Set());

  // 8. Attach co-coach partnership info + merge partner's CoachId downline at root
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
        parentCoachId: null,
        teamMembers: [],
        directMemberCount: 0,
        totalMemberCount: 0,
      };

      // Shared visibility: own CoachId tree already built; append partner's
      // primary directs (and their CoachId subtrees). Never via CoCoachId.
      const existingIds = new Set(hierarchy.teamMembers.map(m => m.userId));
      existingIds.add(coachIdInt);
      existingIds.add(partnerId);

      const partnerMembers = listPrimaryDirectReports(
        allUsers,
        partnerId,
        leadPartnerByUserId,
        existingIds,
      );

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

      hierarchy.directMemberCount = hierarchy.teamMembers.length;
      hierarchy.totalMemberCount =
        hierarchy.directMemberCount +
        hierarchy.teamMembers.reduce((sum, m) => sum + (m.totalMemberCount || 0), 0);
    }
  }

  // 9. Flatten hierarchy → allMembers (active users only unless includeInactive)
  const flattenHierarchy = (node, result = new Map()) => {
    if (!node) return result;
    const includeNode = includeInactive || isActiveTeamStatus(node.status);
    if (includeNode && node.userId !== coachIdInt && !result.has(node.userId)) {
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
      if (!shouldExcludeDeveloperFromAggregates(entry, { viewerUserId: coachIdInt })) {
        result.set(node.userId, entry);
      }
    }
    if (node.teamMembers && node.teamMembers.length > 0) {
      node.teamMembers.forEach(child => flattenHierarchy(child, result));
    }
    return result;
  };

  const memberMap = flattenHierarchy(hierarchy);
  if (
    hierarchy?.coCoachInfo &&
    !memberMap.has(hierarchy.coCoachInfo.userId) &&
    (includeInactive || isActiveTeamStatus(hierarchy.coCoachInfo.status))
  ) {
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
  const allMembers = filterPublicAggregateUsers(
    Array.from(memberMap.values()),
    { viewerUserId: coachIdInt },
  );

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
