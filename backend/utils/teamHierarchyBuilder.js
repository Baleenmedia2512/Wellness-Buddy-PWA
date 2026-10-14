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
import {
  getUserCommunityTeamCode,
  resolveCommunityPeerCoachIds,
} from './communityTeamVisibility.js';
import { fetchAllSupabaseRows } from './supabasePaginate.js';

/** Case-insensitive active check for team_table.Status. */
export function isActiveTeamStatus(status) {
  return String(status || '').toLowerCase() === 'active';
}

const DEFAULT_SUBTREE_SELECT =
  'UserId, UserName, Email, Role, CoachId, CoachTeamId, TeamId, Status, ProfileImage, CommunityId';
const MAX_SUBTREE_DEPTH = 12;
const COACH_ID_IN_CHUNK = 100;

/**
 * @param {object} supabase
 * @param {number} userId
 * @param {string} select
 * @returns {Promise<object|null>}
 */
async function fetchSubtreeUserById(supabase, userId, select) {
  const { data, error } = await supabase
    .from('team_table')
    .select(select)
    .eq('UserId', userId)
    .maybeSingle();
  if (error) throw new Error('Failed to fetch team user: ' + error.message);
  return data || null;
}

/**
 * Paginated CoachId children (Active + Inactive) for subtree walks.
 * @param {object} supabase
 * @param {number[]} coachIds
 * @param {string} select
 * @returns {Promise<object[]>}
 */
async function fetchSubtreeChildrenByCoachIds(supabase, coachIds, select) {
  const ids = [...new Set(
    (coachIds || [])
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id)),
  )];
  if (ids.length === 0) return [];

  const chunks = [];
  for (let i = 0; i < ids.length; i += COACH_ID_IN_CHUNK) {
    chunks.push(ids.slice(i, i + COACH_ID_IN_CHUNK));
  }

  const pages = await Promise.all(
    chunks.map((chunk) =>
      fetchAllSupabaseRows(() =>
        supabase
          .from('team_table')
          .select(select)
          .in('CoachId', chunk)
          .order('UserId', { ascending: true }),
      ),
    ),
  );
  return pages.flat();
}

/**
 * @param {object} supabase
 * @param {string} communityCode
 * @param {string} select
 * @returns {Promise<object[]>}
 */
async function fetchSubtreeUsersByCommunityCode(supabase, communityCode, select) {
  const code = String(communityCode || '').trim();
  if (!code) return [];
  return fetchAllSupabaseRows(() =>
    supabase
      .from('team_table')
      .select(select)
      .or(`CommunityId.eq.${code},CoachTeamId.eq.${code},TeamId.eq.${code}`)
      .order('UserId', { ascending: true }),
  );
}

/**
 * Resolve Sponsor/Co-Sponsor partner ids when the viewer is a lead.
 * @param {object} supabase
 * @param {object} rootUser
 * @returns {Promise<number[]>}
 */
async function resolveSubtreeCoCoachRootIds(supabase, rootUser) {
  const rootId = Number(rootUser?.UserId);
  if (!Number.isFinite(rootId)) return [];

  const { data: byRole, error: byRoleError } = await supabase
    .from('coach_teams_table')
    .select('CoachId, CoCoachId')
    .or(`CoachId.eq.${rootId},CoCoachId.eq.${rootId}`)
    .eq('Status', 'active')
    .maybeSingle();

  if (!byRoleError && byRole?.CoachId && byRole?.CoCoachId) {
    return [...new Set([byRole.CoachId, byRole.CoCoachId].filter(Boolean))];
  }

  const teamCode = rootUser.TeamId || rootUser.CoachTeamId;
  if (!teamCode) return [rootId];

  const { data: coachTeam, error } = await supabase
    .from('coach_teams_table')
    .select('CoachId, CoCoachId')
    .eq('TeamId', teamCode)
    .eq('Status', 'active')
    .maybeSingle();

  if (error || !coachTeam?.CoachId || !coachTeam?.CoCoachId) {
    return [rootId];
  }

  if (rootId !== Number(coachTeam.CoachId) && rootId !== Number(coachTeam.CoCoachId)) {
    return [rootId];
  }

  return [...new Set([coachTeam.CoachId, coachTeam.CoCoachId].filter(Boolean))];
}

/**
 * Load only the coach-visible team_table rows via indexed CoachId / community walks
 * (no full team_table scan). Includes inactive intermediate coaches so promotion
 * rules still work. Same Community ID peer coaches + their downlines are included
 * for Team visibility parity with the previous full-scan builder.
 *
 * @param {object} supabase
 * @param {number} rootCoachId
 * @param {{ select?: string }} [options]
 * @returns {Promise<object[]>}
 */
export async function loadCoachSubtreeTeamUsers(supabase, rootCoachId, options = {}) {
  const select = options.select || DEFAULT_SUBTREE_SELECT;
  const rootId = Number(rootCoachId);
  if (!Number.isFinite(rootId)) return [];

  const usersById = new Map();
  const rootUser = await fetchSubtreeUserById(supabase, rootId, select);
  if (!rootUser) return [];
  usersById.set(rootUser.UserId, rootUser);

  // Ancestor chain (club enrichment / upline resolution — not expanded sideways).
  let walkId = Number(rootUser.CoachId);
  const visitedUp = new Set([rootId]);
  while (Number.isFinite(walkId) && !visitedUp.has(walkId)) {
    visitedUp.add(walkId);
    const ancestor = await fetchSubtreeUserById(supabase, walkId, select);
    if (!ancestor) break;
    usersById.set(ancestor.UserId, ancestor);
    walkId = Number(ancestor.CoachId);
  }

  const rootCoachIds = await resolveSubtreeCoCoachRootIds(supabase, rootUser);
  for (const partnerId of rootCoachIds) {
    if (partnerId === rootId || usersById.has(partnerId)) continue;
    const partner = await fetchSubtreeUserById(supabase, partnerId, select);
    if (partner) usersById.set(partner.UserId, partner);
  }

  let currentCoachIds = rootCoachIds;
  let depth = 0;
  while (currentCoachIds.length > 0 && depth < MAX_SUBTREE_DEPTH) {
    const children = await fetchSubtreeChildrenByCoachIds(supabase, currentCoachIds, select);
    const nextCoachIds = [];
    for (const child of children) {
      if (!usersById.has(child.UserId)) {
        usersById.set(child.UserId, child);
      }
      nextCoachIds.push(child.UserId);
    }
    currentCoachIds = [...new Set(nextCoachIds)];
    depth += 1;
  }

  const partnerRootIds = rootCoachIds
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id) && id !== rootId);
  const communityCode = getUserCommunityTeamCode(rootUser);
  if (communityCode) {
    const communityRows = await fetchSubtreeUsersByCommunityCode(supabase, communityCode, select);
    const communityUserIds = [];
    for (const row of communityRows) {
      const id = Number(row?.UserId);
      if (!Number.isFinite(id)) continue;
      if (!usersById.has(id)) usersById.set(id, row);
      communityUserIds.push(id);
    }
    if (communityUserIds.length > 0) {
      const communityChildren = await fetchSubtreeChildrenByCoachIds(
        supabase,
        communityUserIds,
        select,
      );
      for (const child of communityChildren) {
        if (!usersById.has(child.UserId)) usersById.set(child.UserId, child);
      }
    }
  }

  const communityPeerRootIds = resolveCommunityPeerCoachIds(
    rootId,
    [...usersById.values()],
    { partnerIds: partnerRootIds },
  );

  let peerFrontier = communityPeerRootIds.filter((id) => Number.isFinite(id) && id !== rootId);
  let peerDepth = 0;
  while (peerFrontier.length > 0 && peerDepth < MAX_SUBTREE_DEPTH) {
    const children = await fetchSubtreeChildrenByCoachIds(supabase, peerFrontier, select);
    const nextIds = [];
    for (const child of children) {
      if (!usersById.has(child.UserId)) {
        usersById.set(child.UserId, child);
      }
      nextIds.push(child.UserId);
    }
    peerFrontier = [...new Set(nextIds)];
    peerDepth += 1;
  }

  return [...usersById.values()];
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

  // 1. Subtree-only load (Active + Inactive) so inactive intermediate coaches
  // can be detected and their active members promoted upward — no full table scan.
  let allUsers;
  try {
    allUsers = await loadCoachSubtreeTeamUsers(supabase, coachIdInt, {
      select: DEFAULT_SUBTREE_SELECT,
    });
  } catch (usersError) {
    throw new Error('Failed to fetch team data: ' + (usersError?.message || usersError));
  }
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

  // Same Community ID: merge independent peer coaches' Direct/Full downlines.
  // Visibility only — never coCoachInfo / CoachId / CoCoachId edges.
  if (hierarchy) {
    const partnerIdsForCommunity = managedTeam?.CoachId && managedTeam?.CoCoachId
      ? [managedTeam.CoachId, managedTeam.CoCoachId].filter((id) => Number(id) !== coachIdInt)
      : [];
    const communityPeerIds = resolveCommunityPeerCoachIds(coachIdInt, allUsers, {
      partnerIds: partnerIdsForCommunity,
    });

    if (communityPeerIds.length > 0) {
      const existingIds = new Set(hierarchy.teamMembers.map((m) => m.userId));
      existingIds.add(coachIdInt);
      for (const pid of partnerIdsForCommunity) existingIds.add(Number(pid));
      for (const peerId of communityPeerIds) existingIds.add(Number(peerId));

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
