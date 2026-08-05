import * as repo from './centers.repository.js';
import logger from '../../shared/lib/logger.js';
import { todayInTimezone } from '../../shared/lib/datetime/index.js';
import { getUserTimezoneIana } from '../user/domain/userTimezone.js';
import { cache } from '../../utils/cache.js';
import { getSupabaseClient } from '../../utils/supabaseClient.js';

/** Global geo list for GPS check-in — identical for all users. */
const GEO_LIST_CACHE_TTL_MS = 2 * 60 * 1000;
const GEO_LIST_CACHE_KEY = 'nutrition-centers:geo:all';
const LIST_METRICS_CACHE_TTL_MS = 60 * 1000;
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

  cache.delete(GEO_LIST_CACHE_KEY);
  cache.deletePattern('nutrition-centers:list:');

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
  cache.delete(GEO_LIST_CACHE_KEY);
  cache.deletePattern('nutrition-centers:list:');
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
  cache.delete(GEO_LIST_CACHE_KEY);
  cache.deletePattern('nutrition-centers:list:');
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
    // Fast subtree walk (no ProfileImage / select *) — was ~5s via getDualCoachingTeamHierarchy.
    const supabase = getSupabaseClient();
    const {
      loadReportingContextForCoach,
      getFullReportingMembers,
    } = await import('../../utils/reportingHierarchyService.js');
    const context = await loadReportingContextForCoach(supabase, userIdNum);
    const members = getFullReportingMembers(userIdNum, context);
    return [...new Set([userIdNum, ...members.map((m) => m.UserId)])];
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
  const { userId, teamFilter, scope, includeMetrics = true } = input;
  let { startDate, endDate } = input;
  const userIdNum = parseInt(userId, 10);

  // scope=all ignores team ownership — skip hierarchy walk (was multi-second waste).
  const teamUserIds = scope === 'all'
    ? []
    : await resolveTeamUserIds({ userIdNum, teamFilter });

  // GPS proximity only needs lat/lng — skip per-center attendance (3 queries each).
  if (!includeMetrics && scope === 'all') {
    const cached = cache.get(GEO_LIST_CACHE_KEY);
    if (cached) {
      return { httpStatus: 200, body: { success: true, data: cached } };
    }
    const centers = await repo.listCenters({ teamUserIds: [], scope: 'all' });
    const geo = (centers || []).map((c) => ({
      id: c.id,
      center_name: c.center_name,
      latitude: c.latitude,
      longitude: c.longitude,
      education_hour: c.education_hour,
      owner_user_id: c.owner_user_id,
      status: c.status,
    }));
    cache.set(GEO_LIST_CACHE_KEY, geo, GEO_LIST_CACHE_TTL_MS);
    return { httpStatus: 200, body: { success: true, data: geo } };
  }

  if (!includeMetrics) {
    const centers = await repo.listCenters({ teamUserIds, scope });
    return {
      httpStatus: 200,
      body: {
        success: true,
        data: (centers || []).map((c) => ({
          id: c.id,
          center_name: c.center_name,
          latitude: c.latitude,
          longitude: c.longitude,
          education_hour: c.education_hour,
          owner_user_id: c.owner_user_id,
          status: c.status,
        })),
      },
    };
  }

  const timezoneIana = await getUserTimezoneIana(userId);

  if (!startDate || !endDate) {
    const today = todayInTimezone(timezoneIana);
    startDate = startDate || today;
    endDate = endDate || today;
  }

  const metricsCacheKey = `nutrition-centers:list:${userIdNum}:${teamFilter}:${scope}:${startDate}:${endDate}`;
  const cachedMetrics = cache.get(metricsCacheKey);
  if (cachedMetrics) {
    return { httpStatus: 200, body: { success: true, data: cachedMetrics } };
  }

  const centers = await repo.listCenters({ teamUserIds, scope });

  const ownerIds = centers.map((c) => c.owner_user_id);
  const owners = await repo.getOwnerNames(ownerIds);
  const ownerMap = {};
  owners.forEach((o) => { ownerMap[o.UserId] = o.UserName; });

  const attendanceByCenter = await repo.attendanceForCenters(
    centers.map((c) => c.id),
    startDate,
    endDate,
    timezoneIana,
  );

  const centersWithMetrics = centers.map((center) => {
    const rangeLogs = attendanceByCenter.get(Number(center.id)) || [];
    const todayAttendance = new Set(rangeLogs.map((log) => log.UserId)).size;
    return {
      ...center,
      ownerName: ownerMap[center.owner_user_id] || 'Unknown',
      totalParticipants: todayAttendance,
      todayAttendance,
      attendancePercentage: todayAttendance > 0 ? 100 : 0,
    };
  });

  cache.set(metricsCacheKey, centersWithMetrics, LIST_METRICS_CACHE_TTL_MS);
  return { httpStatus: 200, body: { success: true, data: centersWithMetrics } };
}

// ─── get attendees for a centre ──────────────────────────────────────────────
export async function getAttendees({ centerId, userId, startDate, endDate }) {
  // Prefer requester profile TZ (same as listCenters); fall back to platform IST.
  const timezoneIana = userId
    ? await getUserTimezoneIana(userId)
    : await getUserTimezoneIana(null);
  const today = todayInTimezone(timezoneIana);
  const startYmd = startDate || today;
  const endYmd = endDate || today;

  try {
    const attendees = await repo.getAttendeeList(
      parseInt(centerId, 10),
      startYmd,
      endYmd,
      timezoneIana,
    );
    logger.info({ centerId, startDate: startYmd, endDate: endYmd, count: attendees.length }, 'getAttendees');
    return { httpStatus: 200, body: { success: true, data: attendees } };
  } catch (err) {
    logger.error({ err, centerId }, 'getAttendees failed');
    return { httpStatus: 500, body: { success: false, error: { code: 'FETCH_FAILED', message: err.message } } };
  }
}
