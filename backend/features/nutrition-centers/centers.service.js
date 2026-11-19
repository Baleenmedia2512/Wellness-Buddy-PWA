import * as repo from './centers.repository.js';
import logger from '../../shared/lib/logger.js';
import { todayInTimezone } from '../../shared/lib/datetime/index.js';
import { getUserTimezoneIana } from '../user/domain/userTimezone.js';
import { cache } from '../../utils/cache.js';
import { paginateCentersListRecords } from './domain/centers.pagination.js';
import { canUnregisterCenter } from './domain/center-access.rules.js';
import { prepareCentreProfile } from './domain/centreProfile.rules.js';
import {
  CENTRE_FACILITIES,
  CENTRE_FEATURES,
  parseStoredCatalogIds,
  parseStoredOpeningHours,
  prepareCentreListing,
} from './domain/centreListing.rules.js';
import {
  centrePhotoUrls,
  removeCentrePhotoFiles,
  saveCentrePhotoFiles,
} from './centre-photo-storage.service.js';
import { normalizeSeatingCount } from './domain/centreApproval.rules.js';
import { normalizePlaceName } from './domain/placeLocation.rules.js';
import {
  assertCentreCoachApproved,
  consumeCentreCoachApproval,
} from './centre-approval.service.js';
import {
  assertCentrePhoneVerified,
  consumeCentrePhoneOtp,
} from './centre-phone.service.js';

/** Global geo list for GPS check-in — identical for all users. */
const GEO_LIST_CACHE_TTL_MS = 2 * 60 * 1000;
const GEO_LIST_CACHE_KEY = 'nutrition-centers:geo:all';
const LIST_METRICS_CACHE_TTL_MS = 30 * 1000;
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
function listingColumns(listing) {
  const columns = {};
  if (listing.openingHours !== undefined) {
    columns.opening_hours_json = listing.openingHours ? JSON.stringify(listing.openingHours) : null;
  }
  if (listing.facilities !== undefined) {
    columns.facilities_json = listing.facilities ? JSON.stringify(listing.facilities) : null;
  }
  if (listing.features !== undefined) {
    columns.features_json = listing.features ? JSON.stringify(listing.features) : null;
  }
  return columns;
}

function publicListing(row) {
  return {
    openingHours: parseStoredOpeningHours(row?.opening_hours_json),
    facilities: parseStoredCatalogIds(row?.facilities_json, CENTRE_FACILITIES),
    features: parseStoredCatalogIds(row?.features_json, CENTRE_FEATURES),
    seatingCount: storedSeatingCount(row?.seating_count),
  };
}

function storedSeatingCount(raw) {
  if (raw == null || raw === '') return null;
  const count = Number(raw);
  return Number.isInteger(count) && count >= 0 ? count : null;
}

function duplicateCentreMessage(err) {
  const message = String(err?.message || '');
  if (/center_code|uq_nutrition_centers_center_code/i.test(message)) {
    return 'This centre code is already used. Please choose a different code.';
  }
  return null;
}

export async function register(input) {
  const {
    centerName, latitude, longitude, educationHour, ownerUserId, ownerPhone,
    centerCode, photos, openingHours, facilities, features, seatingCount, area, city, appVersion,
  } = input;

  const profile = prepareCentreProfile({
    centerCode, photos, appVersion, mode: 'register',
  });
  if (profile.error) {
    return { httpStatus: 400, body: { success: false, message: profile.error } };
  }
  const listing = prepareCentreListing({
    openingHours, facilities, features, appVersion, mode: 'register',
  });
  if (listing.error) {
    return { httpStatus: 400, body: { success: false, message: listing.error } };
  }
  const seating = normalizeSeatingCount(seatingCount);
  if (seating.error) {
    return { httpStatus: 400, body: { success: false, message: seating.error } };
  }
  const approvalError = await assertCentreCoachApproved({
    userId: ownerUserId,
    appVersion,
    openingHours: listing.openingHours,
  });
  if (approvalError) {
    return { httpStatus: 400, body: { success: false, message: approvalError } };
  }
  const phoneError = await assertCentrePhoneVerified({
    userId: ownerUserId,
    ownerPhone,
    savedPhone: null,
    appVersion,
    openingHours: listing.openingHours,
  });
  if (phoneError) {
    return { httpStatus: 400, body: { success: false, message: phoneError } };
  }

  const codeLookup = profile.centerCode
    ? repo.findByCode(profile.centerCode)
    : Promise.resolve({ data: null, error: null });
  const [{ data: user, error: userErr }, { data: existing, error: dupErr }, { data: codeOwner, error: codeErr }] = await Promise.all([
    repo.findUserById(ownerUserId),
    repo.findByName(centerName.trim()),
    codeLookup,
  ]);
  if (userErr || !user) {
    return { httpStatus: 500, body: { success: false, message: 'User not found' } };
  }
  if (dupErr) {
    return { httpStatus: 500, body: { success: false, message: dupErr.message } };
  }
  if (codeErr) {
    return { httpStatus: 500, body: { success: false, message: codeErr.message } };
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
  if (codeOwner) {
    return {
      httpStatus: 409,
      body: {
        success: false,
        message: 'This centre code is already used. Please choose a different code.',
        duplicate: true,
      },
    };
  }

  let center;
  try {
    center = await repo.insertCenter({
      center_name: centerName,
      center_code: profile.centerCode,
      latitude,
      longitude,
      education_hour: educationHour || null,
      owner_user_id: ownerUserId,
      owner_phone: ownerPhone || null,
      status: 'active',
      is_deleted: false,
      seating_count: seating.value,
      area: normalizePlaceName(area),
      city: normalizePlaceName(city),
      ...listingColumns(listing),
    });
  } catch (err) {
    const duplicateMessage = duplicateCentreMessage(err);
    if (duplicateMessage) {
      return { httpStatus: 409, body: { success: false, message: duplicateMessage, duplicate: true } };
    }
    throw err;
  }

  if (profile.photos) {
    try {
      await saveCentrePhotoFiles(center.id, profile.photos);
    } catch (err) {
      await repo.softDeleteCenter(center.id).catch(() => {});
      logger.error({ message: err?.message, centerId: center.id }, 'centre photos save failed');
      return {
        httpStatus: 500,
        body: { success: false, message: 'Centre photos could not be saved. Please try again.' },
      };
    }
  }

  await consumeCentreCoachApproval(ownerUserId);
  await consumeCentrePhoneOtp(ownerUserId, ownerPhone);
  invalidateNutritionCentersListCache();

  return {
    httpStatus: 201,
    body: { success: true, data: center, message: 'Nutrition center registered successfully' },
  };
}

// ─── shared: ownership + role guard ─────────────────────────────────────────
async function assertOwnerOrAdmin(centerId, userId) {
  const [{ data: center, error: centerErr }, { data: user }] = await Promise.all([
    repo.findCenterOwner(centerId),
    repo.findUserRole(userId),
  ]);
  if (centerErr || !center) return { allowed: false, httpStatus: 404, message: 'Center not found' };
  const isOwner = center.owner_user_id === parseInt(userId, 10);
  const isAdmin = user && (user.Role === 'admin' || user.Role === 'developer');
  if (!isOwner && !isAdmin) {
    return { allowed: false, httpStatus: 403, message: 'Only the owner or admin can modify this center' };
  }
  return { allowed: true };
}

async function assertCanUnregister(centerId, userId) {
  const { data: center, error: centerErr } = await repo.findCenterOwner(centerId);
  if (centerErr || !center) return { allowed: false, httpStatus: 404, message: 'Center not found' };
  const actor = parseInt(userId, 10);
  const { data: user } = await repo.findUserRole(userId);
  const coachTeam = Number.isFinite(actor) ? await repo.findCoachTeamForUser(actor) : null;
  if (canUnregisterCenter({
    actorUserId: actor,
    ownerUserId: center.owner_user_id,
    role: user?.Role,
    coachTeam,
  })) {
    return { allowed: true };
  }
  return { allowed: false, httpStatus: 403, message: 'Only the owner or a team partner can delete this center' };
}

// ─── unregister ──────────────────────────────────────────────────────────────
export async function unregister({ centerId, userId }) {
  const guard = await assertCanUnregister(centerId, userId);
  if (!guard.allowed) {
    return { httpStatus: guard.httpStatus, body: { success: false, message: guard.message } };
  }
  await removeCentrePhotoFiles(centerId);
  await repo.softDeleteCenter(centerId);
  invalidateNutritionCentersListCache();
  return {
    httpStatus: 200,
    body: { success: true, message: 'Nutrition center unregistered successfully' },
  };
}

// ─── update ──────────────────────────────────────────────────────────────────
export async function updateCenter(input) {
  const {
    centerId, userId, centerName, latitude, longitude, ownerPhone, educationHour,
    centerCode, photos, openingHours, facilities, features, seatingCount, area, city, appVersion,
  } = input;

  const profile = prepareCentreProfile({
    centerCode, photos, appVersion, mode: 'update',
  });
  if (profile.error) {
    return { httpStatus: 400, body: { success: false, message: profile.error } };
  }
  const listing = prepareCentreListing({
    openingHours, facilities, features, appVersion, mode: 'update',
  });
  if (listing.error) {
    return { httpStatus: 400, body: { success: false, message: listing.error } };
  }
  const seating = seatingCount === undefined ? { value: undefined } : normalizeSeatingCount(seatingCount);
  if (seating.error) {
    return { httpStatus: 400, body: { success: false, message: seating.error } };
  }
  let savedPhone = null;
  if (ownerPhone !== undefined) {
    const existingCenter = await repo.findCenterById(centerId);
    if (existingCenter.error) {
      return { httpStatus: 500, body: { success: false, message: 'Centre could not be loaded' } };
    }
    savedPhone = existingCenter.data?.owner_phone || null;
  }
  const phoneError = await assertCentrePhoneVerified({
    userId,
    ownerPhone,
    savedPhone,
    appVersion,
    openingHours: listing.openingHours,
  });
  if (phoneError) {
    return { httpStatus: 400, body: { success: false, message: phoneError } };
  }

  const nameLookup = centerName !== undefined
    ? repo.findByName(centerName.trim())
    : Promise.resolve({ data: null });
  const [guard, { data: existing }] = await Promise.all([
    assertOwnerOrAdmin(centerId, userId),
    nameLookup,
  ]);
  if (!guard.allowed) {
    return { httpStatus: guard.httpStatus, body: { success: false, message: guard.message } };
  }

  // Name uniqueness: only check if name is being changed; skip if it belongs to the same centre
  if (centerName !== undefined) {
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

  if (profile.centerCode) {
    const { data: codeOwner, error: codeErr } = await repo.findByCode(profile.centerCode);
    if (codeErr) {
      return { httpStatus: 500, body: { success: false, message: codeErr.message } };
    }
    if (codeOwner && codeOwner.id !== parseInt(centerId, 10)) {
      return {
        httpStatus: 409,
        body: {
          success: false,
          message: 'This centre code is already used. Please choose a different code.',
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
  if (profile.centerCode) payload.center_code = profile.centerCode;
  if (seating.value !== undefined) payload.seating_count = seating.value;
  if (area !== undefined) payload.area = normalizePlaceName(area);
  if (city !== undefined) payload.city = normalizePlaceName(city);
  Object.assign(payload, listingColumns(listing));

  let updated;
  try {
    updated = Object.keys(payload).length
      ? await repo.updateCenter(centerId, payload)
      : (await repo.findCenterById(centerId)).data;
  } catch (err) {
    const duplicateMessage = duplicateCentreMessage(err);
    if (duplicateMessage) {
      return { httpStatus: 409, body: { success: false, message: duplicateMessage, duplicate: true } };
    }
    throw err;
  }
  if (profile.photos) {
    await saveCentrePhotoFiles(centerId, profile.photos);
  }
  await consumeCentrePhoneOtp(userId, ownerPhone);
  invalidateNutritionCentersListCache();
  return {
    httpStatus: 200,
    body: { success: true, data: updated, message: 'Nutrition center updated successfully' },
  };
}

export async function getCenterPhotos({ centerId, userId }) {
  const guard = await assertOwnerOrAdmin(centerId, userId);
  if (!guard.allowed) {
    return { httpStatus: guard.httpStatus, body: { success: false, message: guard.message } };
  }
  const { data: center, error } = await repo.findCenterById(centerId);
  if (error || !center) {
    return { httpStatus: 404, body: { success: false, message: 'Center not found' } };
  }
  const rows = await repo.listCenterPhotos(centerId);
  return {
    httpStatus: 200,
    body: {
      success: true,
      data: {
        centerCode: center.center_code || null,
        photos: await centrePhotoUrls(rows),
        ...publicListing(center),
      },
    },
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
    // Shared 60s subtree cache (same as Activity Report) — avoids re-walking on tab switch.
    const { buildActivityReportCoachScope } = await import(
      '../activity/domain/activity-report.hierarchy.js'
    );
    const { fullIds } = await buildActivityReportCoachScope(userIdNum);
    return [...new Set([userIdNum, ...fullIds])];
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

/** In-flight dedup — concurrent Full Team clicks share one hierarchy+metrics build. */
const inflightListCenters = new Map();
/** Bumped on create/update/delete so an older list query cannot repopulate the cache. */
let centersListEpoch = 0;

export function getNutritionCentersListEpoch() {
  return centersListEpoch;
}

export function invalidateNutritionCentersListCache() {
  centersListEpoch += 1;
  cache.delete(GEO_LIST_CACHE_KEY);
  cache.deletePattern('nutrition-centers:list:');
}

function listCacheIsCurrent(epochAtStart) {
  return epochAtStart === centersListEpoch;
}

export async function listCenters(input, attempt = 0) {
  const {
    userId, teamFilter, scope, includeMetrics = true, startDate, endDate,
    page, limit, search, paginate = true,
  } = input;
  const userIdNum = parseInt(userId, 10);
  // Inflight key excludes page/search so concurrent page requests share one metrics build.
  const cacheKey = [
    userIdNum, teamFilter, scope, startDate || '', endDate || '', includeMetrics ? 1 : 0,
  ].join(':');
  const epochAtStart = centersListEpoch;

  const inflight = inflightListCenters.get(cacheKey);
  if (inflight && inflight.epoch === epochAtStart) {
    const shared = await inflight.promise;
    if (!listCacheIsCurrent(epochAtStart) && attempt < 2) {
      return listCenters(input, attempt + 1);
    }
    return applyCentersPagination(shared, { page, limit, search, paginate, includeMetrics });
  }

  const promise = listCentersImpl(input, epochAtStart).finally(() => {
    const current = inflightListCenters.get(cacheKey);
    if (current?.promise === promise) inflightListCenters.delete(cacheKey);
  });
  inflightListCenters.set(cacheKey, { epoch: epochAtStart, promise });
  const result = await promise;
  if (!listCacheIsCurrent(epochAtStart) && attempt < 2) {
    return listCenters(input, attempt + 1);
  }
  return applyCentersPagination(result, { page, limit, search, paginate, includeMetrics });
}

/**
 * Slice a full metrics payload into a page. Geo / metrics=0 paths skip pagination.
 */
function applyCentersPagination(result, { page, limit, search, paginate, includeMetrics }) {
  if (!includeMetrics || paginate === false) return result;
  const all = result?.body?.data;
  if (!Array.isArray(all)) return result;

  const { records, pagination } = paginateCentersListRecords(all, { page, limit, search });
  return {
    httpStatus: result.httpStatus,
    body: {
      success: true,
      data: records,
      pagination,
    },
  };
}

async function listCentersImpl(input, epochAtStart = centersListEpoch) {
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
    if (listCacheIsCurrent(epochAtStart)) {
      cache.set(GEO_LIST_CACHE_KEY, geo, GEO_LIST_CACHE_TTL_MS);
    }
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

  const ownerIds = [...new Set(centers.map((c) => c.owner_user_id).filter(Boolean))];
  const [owners, attendanceByCenter] = await Promise.all([
    repo.getOwnerNames(ownerIds),
    repo.attendanceForCenters(
      centers.map((c) => c.id),
      startDate,
      endDate,
      timezoneIana,
    ),
  ]);

  const ownerMap = {};
  owners.forEach((o) => { ownerMap[o.UserId] = o.UserName; });

  // Slim enriched rows — drop unused registered_at/status from client payload later via pagination mapper
  const centersWithMetrics = centers.map((center) => {
    const rangeLogs = attendanceByCenter.get(Number(center.id)) || [];
    const todayAttendance = new Set(rangeLogs.map((log) => log.UserId)).size;
    return {
      id: center.id,
      center_name: center.center_name,
      center_code: center.center_code || null,
      latitude: center.latitude,
      longitude: center.longitude,
      education_hour: center.education_hour,
      owner_user_id: center.owner_user_id,
      owner_phone: center.owner_phone,
      ownerName: ownerMap[center.owner_user_id] || 'Unknown',
      totalParticipants: todayAttendance,
      todayAttendance,
      attendancePercentage: todayAttendance > 0 ? 100 : 0,
      area: center.area || null,
      city: center.city || null,
      ...publicListing(center),
    };
  });

  if (listCacheIsCurrent(epochAtStart)) {
    cache.set(metricsCacheKey, centersWithMetrics, LIST_METRICS_CACHE_TTL_MS);
  }
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
