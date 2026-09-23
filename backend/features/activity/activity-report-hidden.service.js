/**
 * Activity Report hide / unhide service.
 * Hide is global across all Activity Report viewers.
 */
import { ValidationError } from '../../shared/lib/ValidationError.js';
import { getSupabaseClient } from '../../utils/supabaseClient.js';
import { resolveLeadSeatForUser } from '../../utils/coachTeamSeats.js';
import * as userRepo from '../user/user.repository.js';
import { resolveActivityReportUserIds } from './domain/activity-report.scope.js';
import { canManageActivityReportHiddenUsers } from './domain/activity-report.hidden-users.js';
import * as hiddenRepo from './activity-report-hidden.repository.js';

async function assertCanManageHiddenUsers(viewerUserId) {
  const viewerId = Number(viewerUserId);
  if (!Number.isFinite(viewerId) || viewerId <= 0) {
    throw new ValidationError(400, 'userId is required');
  }

  const [profile, seat] = await Promise.all([
    userRepo.findByUserId(viewerId, '"UserId", "Role"'),
    resolveLeadSeatForUser(getSupabaseClient(), viewerId),
  ]);

  if (!profile) {
    throw new ValidationError(404, 'Viewer not found');
  }

  const allowed = canManageActivityReportHiddenUsers({
    role: profile.Role,
    leadSeat: seat?.seat || null,
  });

  if (!allowed) {
    throw new ValidationError(403, 'You are not allowed to hide or unhide Activity Report users');
  }

  return { viewerId, role: profile.Role, leadSeat: seat?.seat || null };
}

/**
 * @param {string|null|undefined} role
 * @returns {'admin'|'coach'}
 */
function mapRoleForScope(role) {
  const r = String(role || '').toLowerCase();
  if (r === 'admin' || r === 'developer') return 'admin';
  return 'coach';
}

async function resolveViewerFullScopeIds(viewerId, role) {
  const { userIds } = await resolveActivityReportUserIds({
    userId: viewerId,
    role: mapRoleForScope(role),
    teamScope: 'full',
  });
  return userIds.map(Number).filter((id) => Number.isFinite(id));
}

/**
 * Target must be in the viewer's Activity Report team scope (full tree).
 */
async function assertTargetInViewerScope(viewerId, role, targetId) {
  if (viewerId === targetId) {
    throw new ValidationError(400, 'You cannot hide yourself from the Activity Report');
  }

  const allowed = new Set(await resolveViewerFullScopeIds(viewerId, role));
  if (!allowed.has(targetId)) {
    throw new ValidationError(403, 'That user is outside your Activity Report team scope');
  }
}

export async function listActivityReportHiddenUsers({ userId }) {
  const { viewerId, role } = await assertCanManageHiddenUsers(userId);
  const scopeIds = await resolveViewerFullScopeIds(viewerId, role);
  // Unhide list: globally hidden members that appear in this viewer's team.
  const members = await hiddenRepo.listHiddenMembers(scopeIds);
  return {
    httpStatus: 200,
    body: {
      success: true,
      members,
      count: members.length,
    },
  };
}

export async function hideActivityReportUser({ userId, hiddenUserId }) {
  const { viewerId, role } = await assertCanManageHiddenUsers(userId);
  const targetId = Number(hiddenUserId);
  if (!Number.isFinite(targetId) || targetId <= 0) {
    throw new ValidationError(400, 'hiddenUserId is required');
  }

  await assertTargetInViewerScope(viewerId, role, targetId);
  await hiddenRepo.setMemberHidden(viewerId, targetId);

  return {
    httpStatus: 200,
    body: {
      success: true,
      message: 'User hidden from Activity Report for all viewers',
      hiddenUserId: targetId,
      isHidden: true,
      viewerUserId: viewerId,
    },
  };
}

export async function unhideActivityReportUser({ userId, hiddenUserId }) {
  const { viewerId, role } = await assertCanManageHiddenUsers(userId);
  const targetId = Number(hiddenUserId);
  if (!Number.isFinite(targetId) || targetId <= 0) {
    throw new ValidationError(400, 'hiddenUserId is required');
  }

  await assertTargetInViewerScope(viewerId, role, targetId);

  const updated = await hiddenRepo.setMemberVisible(targetId);
  if (!updated) {
    throw new ValidationError(404, 'Hidden user not found');
  }

  return {
    httpStatus: 200,
    body: {
      success: true,
      message: 'User restored to Activity Report for all viewers',
      hiddenUserId: targetId,
      isHidden: false,
      viewerUserId: viewerId,
    },
  };
}
