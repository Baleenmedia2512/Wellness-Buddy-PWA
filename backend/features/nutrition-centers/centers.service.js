import * as repo from './centers.repository.js';
import { getDualCoachingTeamHierarchy } from '../../utils/disciplineCalculationsSupabase.js';

// ─── check name ──────────────────────────────────────────────────────────────
export async function checkName({ name }) {
  if (!name || name.length < 2) {
    return { httpStatus: 200, body: { available: true } };
  }
  const { data, error } = await repo.findByName(name);
  if (error) return { httpStatus: 200, body: { available: true } };
  return { httpStatus: 200, body: { available: !data } };
}

// ─── register ────────────────────────────────────────────────────────────────
export async function register(input) {
  const {
    centerName, latitude, longitude, educationHour, ownerUserId, ownerPhone,
  } = input;

  const { data: user, error: userErr } = await repo.findUserById(ownerUserId);
  if (userErr || !user) {
    return { httpStatus: 500, body: { success: false, message: 'User not found' } };
  }

  const { data: existing, error: dupErr } = await repo.findByName(centerName.trim());
  if (dupErr) {
    return { httpStatus: 500, body: { success: false, message: dupErr.message } };
  }
  if (existing) {
    return {
      httpStatus: 409,
      body: {
        success: false,
        message: 'This centre name is already taken. Please choose a different name.',
        duplicate: true,
      },
    };
  }

  const center = await repo.insertCenter({
    center_name: centerName,
    latitude,
    longitude,
    education_hour: educationHour || null,
    owner_user_id: ownerUserId,
    owner_phone: ownerPhone || null,
    status: 'active',
    is_deleted: false,
  });

  return {
    httpStatus: 201,
    body: { success: true, data: center, message: 'Nutrition center registered successfully' },
  };
}

// ─── shared: ownership + role guard ─────────────────────────────────────────
async function assertOwnerOrAdmin(centerId, userId) {
  const { data: center, error: centerErr } = await repo.findCenterOwner(centerId);
  if (centerErr || !center) return { allowed: false, httpStatus: 404, message: 'Center not found' };
  const { data: user } = await repo.findUserRole(userId);
  const isOwner = center.owner_user_id === parseInt(userId, 10);
  const isAdmin = user && (user.Role === 'admin' || user.Role === 'developer');
  if (!isOwner && !isAdmin) {
    return { allowed: false, httpStatus: 403, message: 'Only the owner or admin can modify this center' };
  }
  return { allowed: true };
}

// ─── unregister ──────────────────────────────────────────────────────────────
export async function unregister({ centerId, userId }) {
  const guard = await assertOwnerOrAdmin(centerId, userId);
  if (!guard.allowed) {
    return { httpStatus: guard.httpStatus, body: { success: false, message: guard.message } };
  }
  await repo.softDeleteCenter(centerId);
  return {
    httpStatus: 200,
    body: { success: true, message: 'Nutrition center unregistered successfully' },
  };
}

// ─── update ──────────────────────────────────────────────────────────────────
export async function updateCenter(input) {
  const { centerId, userId, centerName, latitude, longitude, ownerPhone, educationHour } = input;

  const guard = await assertOwnerOrAdmin(centerId, userId);
  if (!guard.allowed) {
    return { httpStatus: guard.httpStatus, body: { success: false, message: guard.message } };
  }

  // Name uniqueness: only check if name is being changed; skip if it belongs to the same centre
  if (centerName !== undefined) {
    const { data: existing } = await repo.findByName(centerName.trim());
    if (existing && existing.id !== parseInt(centerId, 10)) {
      return {
        httpStatus: 409,
        body: {
          success: false,
          message: 'This centre name is already taken. Please choose a different name.',
          duplicate: true,
        },
      };
    }
  }

  const payload = {};
  if (centerName !== undefined) payload.center_name = centerName.trim();
  if (latitude !== undefined) payload.latitude = latitude;
  if (longitude !== undefined) payload.longitude = longitude;
  if (ownerPhone !== undefined) payload.owner_phone = ownerPhone || null;
  if (educationHour !== undefined) payload.education_hour = educationHour || null;

  const updated = await repo.updateCenter(centerId, payload);
  return {
    httpStatus: 200,
    body: { success: true, data: updated, message: 'Nutrition center updated successfully' },
  };
}

// ─── list centers (with attendance metrics) ──────────────────────────────────
async function resolveTeamUserIds({ userIdNum, teamFilter }) {
  if (teamFilter === 'self') {
    const coachTeam = await repo.findCoachTeamForUser(userIdNum);
    if (coachTeam && coachTeam.CoachId && coachTeam.CoCoachId) {
      return [coachTeam.CoachId, coachTeam.CoCoachId];
    }
    return [userIdNum];
  }
  if (teamFilter === 'full') {
    const teamMembers = await getDualCoachingTeamHierarchy(userIdNum, false);
    return [userIdNum, ...teamMembers.map((m) => m.UserId)];
  }
  // direct
  const directMembers = await repo.findDirectMembers(userIdNum);
  const coCoachTeams = await repo.findCoCoachTeams(userIdNum);
  let coCoachMemberIds = [];
  if (coCoachTeams.length > 0) {
    const primaryCoachIds = [...new Set(
      coCoachTeams.map((t) => t.CoachId).filter((id) => id && id !== userIdNum),
    )];
    if (primaryCoachIds.length > 0) {
      const coMembers = await repo.findMembersByCoachIds(primaryCoachIds);
      coCoachMemberIds = coMembers.map((m) => m.UserId);
    }
  }
  const directMemberIds = directMembers.map((m) => m.UserId);
  return [...new Set([userIdNum, ...directMemberIds, ...coCoachMemberIds])];
}

export async function listCenters(input) {
  const { userId, teamFilter, scope } = input;
  let { startDate, endDate } = input;
  const userIdNum = parseInt(userId, 10);

  const teamUserIds = await resolveTeamUserIds({ userIdNum, teamFilter });
  const centers = await repo.listCenters({ teamUserIds, scope });

  const ownerIds = centers.map((c) => c.owner_user_id);
  const owners = await repo.getOwnerNames(ownerIds);
  const ownerMap = {};
  owners.forEach((o) => { ownerMap[o.UserId] = o.UserName; });

  if (!startDate || !endDate) {
    const today = new Date().toISOString().split('T')[0];
    startDate = today;
    endDate = today;
  }
  const rangeStart = `${startDate}T00:00:00`;
  const rangeEnd = `${endDate}T23:59:59`;

  const centersWithMetrics = await Promise.all(
    centers.map(async (center) => {
      const rangeLogs = await repo.attendanceForCenter(center.id, rangeStart, rangeEnd);
      const todayAttendance = new Set(rangeLogs.map((log) => log.UserId)).size;
      return {
        ...center,
        ownerName: ownerMap[center.owner_user_id] || 'Unknown',
        totalParticipants: todayAttendance,
        todayAttendance,
        attendancePercentage: todayAttendance > 0 ? 100 : 0,
      };
    }),
  );

  return { httpStatus: 200, body: { success: true, data: centersWithMetrics } };
}
