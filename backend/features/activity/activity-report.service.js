/**
 * Activity Report Service
 * Orchestrates activity report generation for downline members
 */
import { ValidationError } from '../../shared/lib/ValidationError.js';
import * as repo from './activity-report.repository.js';
import { resolveActivityReportUserIds } from './domain/activity-report.scope.js';
import {
  approxJsonBytes,
  createActivityReportPerf,
} from './domain/activity-report.perf.js';
import {
  ACTIVITY_REPORT_DEFAULT_PAGE_SIZE,
  buildActivityReportPaginationMeta,
  paginateActivityReportRecords,
  slicePreparedActivityReportRows,
} from './domain/activity-report.pagination.js';
import { getUserTimezoneIana, getUserTimezonesIanaMap, resolveTimezoneFromMap } from '../user/domain/userTimezone.js';
import {
  IANA_IST,
  parseRelativeDateRangeYmd,
  normalizeStoredTimestampToUtcIso,
  timestampToCalendarYmd,
  timeOfDayInTimezone,
} from '../../shared/lib/datetime/index.js';
import { resolveFoodTimestamp } from '../../shared/lib/datetime/foodTimestamp.js';
import { resolveSponsorAndIdealCoachForMembers } from '../../utils/sponsorCoachResolution.js';
import { filterPublicAggregateUsers } from '../user/domain/aggregate-eligibility.rules.js';
import { parseWatchKcalFromTopic } from './domain/watch-calories.helpers.js';

function emptyPagination(page = 1, limit = ACTIVITY_REPORT_DEFAULT_PAGE_SIZE) {
  return buildActivityReportPaginationMeta(0, page, limit);
}

/**
 * Attach sponsor + ideal-coach fields onto a member info object (ADR-0007).
 * coachName stays as sponsor alias for older clients.
 */
function applySponsorFields(info, resolved) {
  const sponsorName = resolved?.sponsorName || null;
  info.coachName = sponsorName || 'N/A';
  info.sponsorName = sponsorName || 'N/A';
  info.idealCoachId = resolved?.idealCoachId || null;
  info.idealCoachName = resolved?.idealCoachName || null;
  return info;
}

/**
 * Fields to attach on every activity report row for Sponsor / Ideal Coach.
 */
function sponsorCoachRowFields(member) {
  return {
    coachName: member.coachName || 'N/A',
    sponsorName: member.sponsorName || member.coachName || 'N/A',
    idealCoachId: member.idealCoachId || null,
    idealCoachName: member.idealCoachName || null,
  };
}

/**
 * Resolve date range using the requesting user's timezone (coach calendar for
 * relative presets). Per-member wall clocks / meal windows use owner TZ maps.
 */
async function resolveReportDateRange(userId, dateRange, customStart, customEnd) {
  const timezoneIana = await getUserTimezoneIana(userId);
  return {
    timezoneIana,
    ...parseRelativeDateRangeYmd(dateRange, customStart, customEnd, timezoneIana),
  };
}

/**
 * Extract date and time from a stored timestamp in the record owner's timezone.
 */
function extractDateTime(timestamp, timezoneIana, { food = false } = {}) {
  if (food) {
    const { calendarYmd, timeOfDay } = resolveFoodTimestamp(timestamp, timezoneIana);
    return { date: calendarYmd, time: timeOfDay };
  }
  // Legacy weight/education CreatedAt is IST wall-clock; display in owner TZ.
  const utcIso = normalizeStoredTimestampToUtcIso(timestamp, IANA_IST);
  return {
    date: timestampToCalendarYmd(utcIso, timezoneIana),
    time: timeOfDayInTimezone(utcIso, timezoneIana),
  };
}

function ownerTz(timezoneByUserId, userId, fallback) {
  return resolveTimezoneFromMap(timezoneByUserId, userId, fallback);
}

function buildSummaryCounts({
  weightRecords, educationRecords, foodRecords, stepRecords, watchRecords, timeWindows, timezoneIana, timezoneByUserId,
}) {
  const breakfast = new Set();
  const lunch = new Set();
  const dinner = new Set();

  const breakfastWindow = timeWindows?.breakfast;
  const lunchWindow = timeWindows?.lunch;
  const dinnerWindow = timeWindows?.dinner;

  for (const record of foodRecords || []) {
    const uid = parseInt(record.UserID, 10);
    if (!Number.isFinite(uid)) continue;

    if (repo.isReportBeverageRecord(record)) continue;

    try {
      const tz = resolveTimezoneFromMap(
        timezoneByUserId,
        record.UserID ?? record.UserId,
        timezoneIana,
      );
      const { timeOfDay } = resolveFoodTimestamp(record.CreatedAt, tz);
      if (breakfastWindow && timeOfDay >= breakfastWindow.start && timeOfDay <= breakfastWindow.end) {
        breakfast.add(uid);
      }
      if (lunchWindow && timeOfDay >= lunchWindow.start && timeOfDay <= lunchWindow.end) {
        lunch.add(uid);
      }
      if (dinnerWindow && timeOfDay >= dinnerWindow.start && timeOfDay <= dinnerWindow.end) {
        dinner.add(uid);
      }
    } catch {
      /* skip malformed timestamps */
    }
  }

  const waterUsers = new Set(
    repo.filterWaterRecords(foodRecords || [])
      .map((record) => parseInt(record.UserID, 10))
      .filter((id) => Number.isFinite(id)),
  );

  const exerciseUsers = new Set();
  for (const record of stepRecords || []) {
    if (record.UserId != null) exerciseUsers.add(record.UserId);
  }
  for (const record of watchRecords || []) {
    const uid = parseInt(record.UserId, 10);
    if (Number.isFinite(uid) && parseWatchKcalFromTopic(record.Topic) > 0) {
      exerciseUsers.add(uid);
    }
  }

  return {
    weight: new Set(weightRecords.map((r) => r.UserId)).size,
    education: new Set(educationRecords.map((r) => parseInt(r.UserId, 10))).size,
    breakfast: breakfast.size,
    lunch: lunch.size,
    dinner: dinner.size,
    water: waterUsers.size,
    calories: exerciseUsers.size,
  };
}

function buildMemberSummaryList(userIds, memberMap, educationRecords, timezoneIana, timezoneByUserId) {
  const dedupedEducation = repo.dedupeFirstLogPerMemberPerDay(
    educationRecords,
    timezoneIana,
    { timezoneByUserId },
  );
  const countMap = {};
  dedupedEducation.forEach((record) => {
    const key = String(record.UserId);
    countMap[key] = (countMap[key] || 0) + 1;
  });

  const memberList = userIds.map((uid) => {
    const info = memberMap[uid] || memberMap[String(uid)] || {};
    return {
      userId: uid,
      memberName: info.name || 'N/A',
      ...sponsorCoachRowFields(info),
      educationCount: countMap[String(uid)] || 0,
    };
  }).sort((a, b) => b.educationCount - a.educationCount);

  const attended = memberList.filter((m) => m.educationCount > 0).length;
  const notAttended = memberList.length - attended;
  const totalCount = memberList.reduce((sum, m) => sum + m.educationCount, 0);
  const topMember = memberList[0]?.educationCount > 0 ? memberList[0] : null;
  const avgAttendance = memberList.length > 0
    ? Math.round((totalCount / memberList.length) * 10) / 10
    : 0;

  return {
    members: memberList,
    stats: {
      totalMembers: memberList.length,
      attended,
      notAttended,
      topMember: topMember ? { name: topMember.memberName, count: topMember.educationCount } : null,
      avgAttendance,
    },
  };
}

function buildSimpleMemberMap(members, sponsorByUser) {
  const memberMap = {};
  members.forEach((member) => {
    const resolved = sponsorByUser?.get(String(member.UserId));
    const info = applySponsorFields({
      name: member.UserName || 'N/A',
      phone: member.PhoneNumber || 'N/A',
    }, resolved);
    memberMap[member.UserId] = info;
    memberMap[String(member.UserId)] = info;
  });
  return memberMap;
}

function buildDetailMemberMap(members, sponsorByUser) {
  const memberMap = {};
  members.forEach((member) => {
    const resolved = sponsorByUser?.get(String(member.UserId));
    const info = applySponsorFields({
      name: member.UserName || 'N/A',
      phone: member.PhoneNumber || 'N/A',
      email: member.Email || '',
      city: 'N/A',
      village: 'N/A',
      role: member.Role || 'member',
    }, resolved);
    memberMap[member.UserId] = info;
    memberMap[String(member.UserId)] = info;
  });
  return memberMap;
}

/** AnalysisData is large — only water volume needs it. Meals use ProcessedBy + time windows. */
function needsFoodAnalysisData(activityType) {
  return activityType === 'water';
}

function collectTimezoneUserIds(weightRecords, educationRecords, foodRecords, stepRecords, watchRecords) {
  return [...new Set([
    ...(weightRecords || []).map((r) => r.UserId).filter(Boolean),
    ...(educationRecords || []).map((r) => r.UserId).filter(Boolean),
    ...(foodRecords || []).map((r) => r.UserID || r.UserId).filter(Boolean),
    ...(stepRecords || []).map((r) => r.UserId).filter(Boolean),
    ...(watchRecords || []).map((r) => r.UserId).filter(Boolean),
  ].map(String))];
}

/**
 * Attach sponsor / ideal-coach labels onto an already-built page of rows.
 * Avoids walking the full hierarchy for every member in the filtered set.
 */
async function attachSponsorsToRecords(records, { viewerUserId, membersById }) {
  const list = Array.isArray(records) ? records : [];
  if (list.length === 0) return list;

  const pageMembers = [];
  const seen = new Set();
  for (const row of list) {
    const uid = row?.userId;
    if (uid == null || seen.has(String(uid))) continue;
    seen.add(String(uid));
    const member = membersById.get(String(uid));
    if (member) {
      pageMembers.push({
        userId: member.UserId,
        coachId: member.CoachId,
        role: member.Role,
      });
    } else {
      pageMembers.push({ userId: uid, coachId: null, role: 'member' });
    }
  }

  const sponsorByUser = await resolveSponsorAndIdealCoachForMembers(pageMembers, {
    viewerUserId,
  });

  return list.map((row) => {
    const resolved = sponsorByUser.get(String(row.userId));
    if (!resolved) return row;
    return {
      ...row,
      coachName: resolved.sponsorName || row.coachName || 'N/A',
      sponsorName: resolved.sponsorName || row.sponsorName || 'N/A',
      idealCoachId: resolved.idealCoachId || null,
      idealCoachName: resolved.idealCoachName || null,
    };
  });
}

/**
 * Build → (optional full sponsor enrich for coach search) → paginate →
 * page-only sponsor enrich when search is empty.
 */
async function buildPagedActivityRecords({
  activityType,
  members,
  viewerUserId,
  timezoneIana,
  timezoneByUserId,
  weightRecords,
  educationRecords,
  foodRecords,
  stepRecords,
  watchRecords,
  timeWindows,
  paginationOpts,
}) {
  const search = String(paginationOpts.search || '').trim();
  // Coach/sponsor search needs full enrichment before filter; default path
  // enriches only the returned page (major win for teamScope=full).
  const needsFullSponsorPass = Boolean(search) || Boolean(paginationOpts.exportAll);

  let sponsorByUser = null;
  if (needsFullSponsorPass) {
    sponsorByUser = await resolveSponsorAndIdealCoachForMembers(
      members.map((m) => ({ userId: m.UserId, coachId: m.CoachId, role: m.Role })),
      { viewerUserId },
    );
  }

  const memberMap = buildDetailMemberMap(members, sponsorByUser);
  const allRecords = await buildDetailRecordsFromBundle({
    activityType,
    memberMap,
    timezoneIana,
    timezoneByUserId,
    weightRecords,
    educationRecords,
    foodRecords,
    stepRecords,
    watchRecords,
    timeWindows,
  });

  const paged = paginateActivityReportRecords(allRecords, paginationOpts);

  if (needsFullSponsorPass) {
    return paged;
  }

  const membersById = new Map(members.map((m) => [String(m.UserId), m]));
  const enrichedPage = await attachSponsorsToRecords(paged.records, {
    viewerUserId,
    membersById,
  });
  return {
    ...paged,
    records: enrichedPage,
  };
}

async function buildDetailRecordsFromBundle({
  activityType,
  memberMap,
  timezoneIana,
  timezoneByUserId,
  weightRecords,
  educationRecords,
  foodRecords,
  stepRecords,
  watchRecords,
  timeWindows,
}) {
  switch (activityType) {
    case 'weight': {
      const dedupedWeight = repo.dedupeFirstLogPerMemberPerDay(
        weightRecords,
        timezoneIana,
        { timezoneByUserId },
      );
      const centerIds = [...new Set(
        dedupedWeight.filter((r) => !r.CenterName && r.NutritionCenterId).map((r) => r.NutritionCenterId),
      )];
      const centerMap = centerIds.length > 0 ? await repo.fetchNutritionCenters(centerIds) : {};
      return dedupedWeight.map((record) => {
        const member = memberMap[record.UserId] || {};
        const tz = ownerTz(timezoneByUserId, record.UserId, timezoneIana);
        const { date, time } = extractDateTime(record.CreatedAt, tz);
        return {
          userId: record.UserId,
          memberName: member.name,
          city: record.City || member.city || 'N/A',
          village: record.Village || member.village || 'N/A',
          phone: member.phone,
          ...sponsorCoachRowFields(member),
          date,
          time,
          clubName: record.CenterName || centerMap[record.NutritionCenterId] || 'N/A',
          weight: record.Weight || 'N/A',
        };
      });
    }
    case 'education': {
      const dedupedEducation = repo.dedupeFirstLogPerMemberPerDay(
        educationRecords,
        timezoneIana,
        { timezoneByUserId },
      );
      const centerIds = [...new Set(
        dedupedEducation.filter((r) => !r.center_name && r.nutrition_center_id).map((r) => r.nutrition_center_id),
      )];
      const centerMap = centerIds.length > 0 ? await repo.fetchNutritionCenters(centerIds) : {};
      return dedupedEducation.map((record) => {
        const uidKey = String(record.UserId);
        const member = memberMap[uidKey] || {};
        const tz = ownerTz(timezoneByUserId, record.UserId, timezoneIana);
        const { date, time } = extractDateTime(record.CreatedAt, tz);
        return {
          userId: uidKey,
          memberName: member.name || 'N/A',
          city: record.City || member.city || 'N/A',
          village: record.Village || member.village || 'N/A',
          phone: member.phone || 'N/A',
          ...sponsorCoachRowFields(member),
          date,
          time,
          clubName: record.center_name || centerMap[record.nutrition_center_id] || 'N/A',
          attendanceType: record.attendance_type || 'N/A',
          topic: record.Topic || 'N/A',
        };
      });
    }
    case 'breakfast':
    case 'lunch':
    case 'dinner': {
      const mealRecords = repo.filterFoodByMealTime(
        foodRecords, activityType, timeWindows, timezoneIana, timezoneByUserId,
      );
      const dedupedMeals = repo.dedupeFirstLogPerMemberPerDay(
        mealRecords,
        timezoneIana,
        { foodTimestamp: true, timezoneByUserId },
      );
      const centerIds = [...new Set(
        dedupedMeals.filter((r) => !r.CenterName && r.NutritionCenterId).map((r) => r.NutritionCenterId),
      )];
      const centerMap = centerIds.length > 0 ? await repo.fetchNutritionCenters(centerIds) : {};
      return dedupedMeals.map((record) => {
        const memberUserId = parseInt(record.UserID, 10);
        const member = memberMap[memberUserId] || {};
        const tz = ownerTz(timezoneByUserId, memberUserId, timezoneIana);
        const { date, time } = extractDateTime(record.CreatedAt, tz, { food: true });
        return {
          userId: memberUserId,
          memberName: member.name,
          city: record.City || member.city || 'N/A',
          village: record.Village || member.village || 'N/A',
          phone: member.phone,
          ...sponsorCoachRowFields(member),
          date,
          time,
          clubName: record.CenterName || centerMap[record.NutritionCenterId] || 'N/A',
          calories: record.TotalCalories || 0,
          mealType: activityType,
        };
      });
    }
    case 'water': {
      const waterRecords = repo.filterWaterRecords(foodRecords);
      const centerIds = [...new Set(
        waterRecords.filter((r) => !r.CenterName && r.NutritionCenterId).map((r) => r.NutritionCenterId),
      )];
      const centerMap = centerIds.length > 0 ? await repo.fetchNutritionCenters(centerIds) : {};
      return waterRecords.map((record) => {
        const memberUserId = parseInt(record.UserID, 10);
        const member = memberMap[memberUserId] || {};
        const tz = ownerTz(timezoneByUserId, memberUserId, timezoneIana);
        const { date, time } = extractDateTime(record.CreatedAt, tz, { food: true });
        return {
          userId: memberUserId,
          memberName: member.name,
          city: record.City || member.city || 'N/A',
          village: record.Village || member.village || 'N/A',
          phone: member.phone,
          ...sponsorCoachRowFields(member),
          date,
          time,
          clubName: record.CenterName || centerMap[record.NutritionCenterId] || 'N/A',
          waterLiters: repo.calculateWaterVolume(record),
        };
      });
    }
    case 'calories': {
      const stepRows = (stepRecords || []).map((record) => {
        const member = memberMap[record.UserId] || {};
        const tz = ownerTz(timezoneByUserId, record.UserId, timezoneIana);
        const { date, time } = extractDateTime(record.CreatedAt, tz);
        return {
          userId: record.UserId,
          memberName: member.name,
          city: member.city,
          village: member.village,
          phone: member.phone,
          ...sponsorCoachRowFields(member),
          date,
          time,
          clubName: 'N/A',
          caloriesBurned: record.CaloriesBurned || 0,
          steps: record.Steps || 0,
        };
      });
      const watchRows = (watchRecords || [])
        .filter((record) => parseWatchKcalFromTopic(record.Topic) > 0)
        .map((record) => {
          const memberUserId = parseInt(record.UserId, 10);
          const member = memberMap[memberUserId] || {};
          const tz = ownerTz(timezoneByUserId, memberUserId, timezoneIana);
          const { date, time } = extractDateTime(record.CreatedAt, tz);
          return {
            userId: memberUserId,
            memberName: member.name,
            city: record.City || member.city || 'N/A',
            village: record.Village || member.village || 'N/A',
            phone: member.phone,
            ...sponsorCoachRowFields(member),
            date,
            time,
            clubName: record.center_name || 'N/A',
            caloriesBurned: parseWatchKcalFromTopic(record.Topic),
            steps: 0,
          };
        });
      return [...stepRows, ...watchRows];
    }
    default:
      throw new ValidationError(400, `Invalid activityType: ${activityType}`);
  }
}

const EMPTY_SUMMARY = {
  weight: 0, education: 0, breakfast: 0, lunch: 0, dinner: 0, water: 0, calories: 0,
};
const EMPTY_STATS = {
  totalMembers: 0, attended: 0, notAttended: 0, topMember: null, avgAttendance: 0,
};

/**
 * User IDs that would appear in the selected detail tab — used to skip
 * member/sponsor enrichment when the table would be empty.
 */
function collectDetailRecordUserIds({
  activityType,
  weightRecords,
  educationRecords,
  foodRecords,
  stepRecords,
  watchRecords,
  timeWindows,
  timezoneIana,
  timezoneByUserId,
}) {
  switch (activityType) {
    case 'weight':
      return [...new Set(
        repo.dedupeFirstLogPerMemberPerDay(weightRecords, timezoneIana, { timezoneByUserId })
          .map((r) => r.UserId)
          .filter(Boolean),
      )];
    case 'education':
      return [...new Set(
        repo.dedupeFirstLogPerMemberPerDay(educationRecords, timezoneIana, { timezoneByUserId })
          .map((r) => parseInt(r.UserId, 10))
          .filter((id) => Number.isFinite(id)),
      )];
    case 'breakfast':
    case 'lunch':
    case 'dinner': {
      const meals = repo.filterFoodByMealTime(
        foodRecords, activityType, timeWindows, timezoneIana, timezoneByUserId,
      );
      return [...new Set(
        repo.dedupeFirstLogPerMemberPerDay(meals, timezoneIana, { foodTimestamp: true, timezoneByUserId })
          .map((r) => parseInt(r.UserID, 10))
          .filter((id) => Number.isFinite(id)),
      )];
    }
    case 'water':
      return [...new Set(
        repo.filterWaterRecords(foodRecords)
          .map((r) => parseInt(r.UserID, 10))
          .filter((id) => Number.isFinite(id)),
      )];
    case 'calories': {
      const stepUsers = stepRecords.map((r) => r.UserId).filter(Boolean);
      const watchUsers = (watchRecords || [])
        .filter((r) => parseWatchKcalFromTopic(r.Topic) > 0)
        .map((r) => parseInt(r.UserId, 10))
        .filter((id) => Number.isFinite(id));
      return [...new Set([...stepUsers, ...watchUsers])];
    }
    default:
      return [];
  }
}

/**
 * Absorb Strict Mode / double-mount duplicate bootstraps on a warm lambda.
 */
const bootstrapResultCache = new Map();
const BOOTSTRAP_CACHE_TTL_MS = 20_000;

/**
 * Cache fully built+filtered detail rows so page flips avoid re-querying.
 * Key excludes page/limit; value is the post-search/sort list.
 */
const detailRowsCache = new Map();
const DETAIL_ROWS_CACHE_TTL_MS = 30_000;

function detailRowsCacheKey(input) {
  return [
    input.userId,
    input.role,
    input.teamScope,
    input.dateRange,
    input.startDate || '',
    input.endDate || '',
    input.activityType,
    input.search || '',
    input.sort || 'date',
    input.sortDir || 'desc',
  ].join('|');
}

function getCachedDetailRows(key) {
  const hit = detailRowsCache.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    detailRowsCache.delete(key);
    return null;
  }
  return hit.rows;
}

function setCachedDetailRows(key, rows) {
  detailRowsCache.set(key, {
    rows,
    expiresAt: Date.now() + DETAIL_ROWS_CACHE_TTL_MS,
  });
  // Bound cache size for warm lambdas with many coaches
  if (detailRowsCache.size > 40) {
    const oldest = detailRowsCache.keys().next().value;
    detailRowsCache.delete(oldest);
  }
}

function bootstrapCacheKey(input) {
  return [
    input.userId,
    input.role,
    input.teamScope,
    input.dateRange,
    input.startDate || '',
    input.endDate || '',
    input.detailActivity || 'education',
    input.includeRecords ? '1' : '0',
    input.page || 1,
    input.limit || ACTIVITY_REPORT_DEFAULT_PAGE_SIZE,
    input.search || '',
    input.sort || 'date',
    input.sortDir || 'desc',
    input.exportAll ? 'export' : 'page',
  ].join('|');
}

/**
 * Single round-trip bootstrap: team scope + summary + member summary + one detail tab.
 * Resolves hierarchy once and fetches all activity tables in parallel.
 */
export async function getActivityReportBootstrap(params) {
  const cacheKey = bootstrapCacheKey(params);
  const cached = bootstrapResultCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    const perf = createActivityReportPerf('bootstrap');
    perf.done({
      cache: 'hit',
      payloadBytes: approxJsonBytes(cached.value?.body),
      recordCount: Array.isArray(cached.value?.body?.records)
        ? cached.value.body.records.length
        : 0,
    });
    return cached.value;
  }

  const result = await getActivityReportBootstrapUncached(params);
  if (result?.httpStatus === 200) {
    bootstrapResultCache.set(cacheKey, {
      value: result,
      expiresAt: Date.now() + BOOTSTRAP_CACHE_TTL_MS,
    });
  }
  return result;
}

async function getActivityReportBootstrapUncached({
  userId,
  role,
  teamScope,
  dateRange,
  startDate: customStart,
  endDate: customEnd,
  detailActivity = 'education',
  includeRecords = true,
  page = 1,
  limit = ACTIVITY_REPORT_DEFAULT_PAGE_SIZE,
  search = '',
  sort = 'date',
  sortDir = 'desc',
  exportAll = false,
}) {
  const paginationOpts = { page, limit, search, sort, sortDir, exportAll };
  const perf = createActivityReportPerf('bootstrap');
  const [{ timezoneIana, startDate: startStr, endDate: endStr }, scope] = await Promise.all([
    resolveReportDateRange(userId, dateRange, customStart, customEnd),
    resolveActivityReportUserIds({ userId, role, teamScope }),
  ]);
  perf.mark('scope_and_dates');

  const { userIds, teamScope: resolvedScope, teamScopeCounts } = scope;
  const baseBody = {
    success: true,
    dateRange,
    startDate: startStr,
    endDate: endStr,
    teamScope: resolvedScope,
    teamScopeCounts,
    activityType: detailActivity,
  };

  if (userIds.length === 0) {
    const empty = {
      httpStatus: 200,
      body: {
        ...baseBody,
        summary: EMPTY_SUMMARY,
        members: [],
        stats: EMPTY_STATS,
        records: [],
        pagination: emptyPagination(page, limit),
      },
    };
    perf.done({
      userCount: 0,
      recordCount: 0,
      payloadBytes: approxJsonBytes(empty.body),
      cache: 'miss',
    });
    return empty;
  }

  // Activity tables in one wave. Summary beverage pills need AnalysisData for legacy
  // water rows whose ProcessedBy column was saved as manual_app.
  const [
    weightRecords,
    educationRecords,
    stepRecords,
    watchRecords,
    timeWindows,
    foodRecords,
  ] = await Promise.all([
    repo.fetchWeightRecords(userIds, startStr, endStr, timezoneIana),
    repo.fetchEducationRecords(userIds, startStr, endStr, timezoneIana),
    repo.fetchStepRecords(userIds, startStr, endStr, timezoneIana),
    repo.fetchWatchCalorieRecords(userIds, startStr, endStr, timezoneIana),
    repo.fetchTimeWindows(),
    repo.fetchFoodRecords(userIds, startStr, endStr, timezoneIana, {
      includeAnalysisData: true,
    }),
  ]);
  // Timezones only for users who actually logged — not the entire full-scope tree.
  const tzUserIds = collectTimezoneUserIds(
    weightRecords, educationRecords, foodRecords, stepRecords, watchRecords,
  );
  const timezoneByUserId = tzUserIds.length > 0
    ? await getUserTimezonesIanaMap(tzUserIds)
    : {};
  perf.mark('activity_tables');

  const summary = buildSummaryCounts({
    weightRecords, educationRecords, foodRecords, stepRecords, watchRecords, timeWindows, timezoneIana, timezoneByUserId,
  });
  perf.mark('summary_counts');

  let records = [];
  let pagination = emptyPagination(page, limit);
  if (includeRecords) {
    const detailUserIds = collectDetailRecordUserIds({
      activityType: detailActivity,
      weightRecords,
      educationRecords,
      foodRecords,
      stepRecords,
      watchRecords,
      timeWindows,
      timezoneIana,
      timezoneByUserId,
    });

    // Empty detail tab → skip member fetch + sponsor/ideal-coach chain walks.
    if (detailUserIds.length > 0) {
      const members = filterPublicAggregateUsers(
        await repo.fetchMemberDetails(detailUserIds),
        { viewerUserId: userId },
      );
      const paged = await buildPagedActivityRecords({
        activityType: detailActivity,
        members,
        viewerUserId: userId,
        timezoneIana,
        timezoneByUserId,
        weightRecords,
        educationRecords,
        foodRecords,
        stepRecords,
        watchRecords,
        timeWindows,
        paginationOpts,
      });
      records = paged.records;
      pagination = paged.pagination;
      setCachedDetailRows(detailRowsCacheKey({
        userId,
        role,
        teamScope: resolvedScope,
        dateRange,
        startDate: startStr,
        endDate: endStr,
        activityType: detailActivity,
        search,
        sort,
        sortDir,
      }), paged.preparedRows);
    }
    perf.mark('detail_enrichment');
  }

  const body = {
    ...baseBody,
    summary,
    members: [],
    stats: EMPTY_STATS,
    records,
    pagination,
  };
  perf.done({
    userCount: userIds.length,
    recordCount: records.length,
    totalRecords: pagination.totalRecords,
    foodRows: foodRecords.length,
    detailActivity,
    payloadBytes: approxJsonBytes(body),
    cache: 'miss',
  });
  return { httpStatus: 200, body };
}

/**
 * Get activity counts summary for all activity types
 */
export async function getActivitySummary({ userId, role, teamScope, dateRange, startDate: customStart, endDate: customEnd }) {
  const { timezoneIana, startDate: startStr, endDate: endStr } = await resolveReportDateRange(
    userId, dateRange, customStart, customEnd,
  );

  const { userIds, teamScope: resolvedScope, teamScopeCounts } = await resolveActivityReportUserIds({
    userId, role, teamScope,
  });
  
  if (userIds.length === 0) {
    return {
      httpStatus: 200,
      body: {
        success: true,
        dateRange,
        startDate: startStr,
        endDate: endStr,
        teamScope: resolvedScope,
        teamScopeCounts,
        summary: {
          weight: 0,
          education: 0,
          breakfast: 0,
          lunch: 0,
          dinner: 0,
          water: 0,
          calories: 0,
        },
      },
    };
  }
  
  const [weightRecords, educationRecords, stepRecords, watchRecords, foodRecords, timeWindows] = await Promise.all([
    repo.fetchWeightRecords(userIds, startStr, endStr, timezoneIana),
    repo.fetchEducationRecords(userIds, startStr, endStr, timezoneIana),
    repo.fetchStepRecords(userIds, startStr, endStr, timezoneIana),
    repo.fetchWatchCalorieRecords(userIds, startStr, endStr, timezoneIana),
    repo.fetchFoodRecords(userIds, startStr, endStr, timezoneIana, {
      includeAnalysisData: true,
    }),
    repo.fetchTimeWindows(),
  ]);
  const tzUserIds = collectTimezoneUserIds(
    weightRecords, educationRecords, foodRecords, stepRecords, watchRecords,
  );
  const timezoneByUserId = tzUserIds.length > 0
    ? await getUserTimezonesIanaMap(tzUserIds)
    : {};

  const counts = buildSummaryCounts({
    weightRecords, educationRecords, foodRecords, stepRecords, watchRecords, timeWindows, timezoneIana, timezoneByUserId,
  });
  
  return {
    httpStatus: 200,
    body: {
      success: true,
      dateRange,
      startDate: startStr,
      endDate: endStr,
      teamScope: resolvedScope,
      teamScopeCounts,
      summary: counts,
    },
  };
}

/**
 * Get per-member education attendance summary for all downline members.
 * Includes members with 0 attendance so coaches can spot who hasn't attended.
 */
export async function getActivityMemberSummary({ userId, role, teamScope, dateRange, startDate: customStart, endDate: customEnd }) {
  const { timezoneIana, startDate: startStr, endDate: endStr } = await resolveReportDateRange(
    userId, dateRange, customStart, customEnd,
  );

  const { userIds, teamScope: resolvedScope, teamScopeCounts } = await resolveActivityReportUserIds({
    userId, role, teamScope,
  });

  if (userIds.length === 0) {
    return {
      httpStatus: 200,
      body: {
        success: true,
        dateRange,
        startDate: startStr,
        endDate: endStr,
        teamScope: resolvedScope,
        teamScopeCounts,
        members: [],
        stats: { totalMembers: 0, attended: 0, notAttended: 0, topMember: null, avgAttendance: 0 },
      },
    };
  }

  // Fetch member details + sponsor / ideal coach (ADR-0007)
  const members = filterPublicAggregateUsers(
    await repo.fetchMemberDetails(userIds),
    { viewerUserId: userId },
  );
  const sponsorByUser = await resolveSponsorAndIdealCoachForMembers(
    members.map((m) => ({ userId: m.UserId, coachId: m.CoachId, role: m.Role })),
    { viewerUserId: userId },
  );

  // Build member info map (keyed by both numeric and string UserId)
  const memberMap = {};
  members.forEach(member => {
    const info = applySponsorFields({
      name: member.UserName || 'N/A',
      phone: member.PhoneNumber || 'N/A',
    }, sponsorByUser.get(String(member.UserId)));
    memberMap[member.UserId] = info;
    memberMap[String(member.UserId)] = info;
  });

  // Fetch education records ? count first log per member per day only
  const [educationRecords, timezoneByUserId] = await Promise.all([
    repo.fetchEducationRecords(userIds, startStr, endStr, timezoneIana),
    getUserTimezonesIanaMap(userIds),
  ]);
  const dedupedEducation = repo.dedupeFirstLogPerMemberPerDay(
    educationRecords,
    timezoneIana,
    { timezoneByUserId },
  );
  const countMap = {};
  dedupedEducation.forEach(record => {
    const key = String(record.UserId);
    countMap[key] = (countMap[key] || 0) + 1;
  });

  // Build member list with counts G?? include ALL downline members (even 0 attendance)
  const memberList = userIds.map(uid => {
    const info = memberMap[uid] || memberMap[String(uid)] || {};
    return {
      userId: uid,
      memberName: info.name || 'N/A',
      ...sponsorCoachRowFields(info),
      educationCount: countMap[String(uid)] || 0,
    };
  }).sort((a, b) => b.educationCount - a.educationCount);

  // Compute summary stats
  const attended = memberList.filter(m => m.educationCount > 0).length;
  const notAttended = memberList.length - attended;
  const totalCount = memberList.reduce((sum, m) => sum + m.educationCount, 0);
  const topMember = memberList[0]?.educationCount > 0 ? memberList[0] : null;
  const avgAttendance = memberList.length > 0
    ? Math.round((totalCount / memberList.length) * 10) / 10
    : 0;

  return {
    httpStatus: 200,
    body: {
      success: true,
      dateRange,
      startDate: startStr,
      endDate: endStr,
      teamScope: resolvedScope,
      teamScopeCounts,
      members: memberList,
      stats: {
        totalMembers: memberList.length,
        attended,
        notAttended,
        topMember: topMember ? { name: topMember.memberName, count: topMember.educationCount } : null,
        avgAttendance,
      },
    },
  };
}

/**
 * Get detailed activity records for a specific activity type
 */
export async function getActivityDetails({
  userId,
  role,
  teamScope,
  activityType,
  dateRange,
  startDate: customStart,
  endDate: customEnd,
  page = 1,
  limit = ACTIVITY_REPORT_DEFAULT_PAGE_SIZE,
  search = '',
  sort = 'date',
  sortDir = 'desc',
  exportAll = false,
}) {
  const paginationOpts = { page, limit, search, sort, sortDir, exportAll };
  const perf = createActivityReportPerf('details');
  const [{ timezoneIana, startDate: startStr, endDate: endStr }, scope] = await Promise.all([
    resolveReportDateRange(userId, dateRange, customStart, customEnd),
    resolveActivityReportUserIds({ userId, role, teamScope }),
  ]);
  perf.mark('scope_and_dates');

  const { userIds, teamScope: resolvedScope, teamScopeCounts } = scope;
  const rowsCacheKey = detailRowsCacheKey({
    userId,
    role,
    teamScope: resolvedScope,
    dateRange,
    startDate: startStr,
    endDate: endStr,
    activityType,
    search,
    sort,
    sortDir,
  });

  if (userIds.length === 0) {
    const empty = {
      httpStatus: 200,
      body: {
        success: true,
        activityType,
        dateRange,
        startDate: startStr,
        endDate: endStr,
        teamScope: resolvedScope,
        teamScopeCounts,
        records: [],
        pagination: emptyPagination(page, limit),
      },
    };
    perf.done({ userCount: 0, recordCount: 0, payloadBytes: approxJsonBytes(empty.body) });
    return empty;
  }

  const cachedPrepared = getCachedDetailRows(rowsCacheKey);
  if (cachedPrepared) {
    const paged = slicePreparedActivityReportRows(cachedPrepared, paginationOpts);
    // Prepared cache may omit sponsors (page-only enrich path) — attach for this page.
    const records = await attachSponsorsToRecords(paged.records, {
      viewerUserId: userId,
      membersById: new Map(),
    });
    const body = {
      success: true,
      activityType,
      dateRange,
      startDate: startStr,
      endDate: endStr,
      teamScope: resolvedScope,
      teamScopeCounts,
      records,
      pagination: paged.pagination,
    };
    perf.done({
      userCount: userIds.length,
      recordCount: records.length,
      totalRecords: paged.pagination.totalRecords,
      payloadBytes: approxJsonBytes(body),
      cache: 'rows-hit',
    });
    return { httpStatus: 200, body };
  }

  // Fetch only the activity table for this tab (+ time windows) before member enrichment.
  const needsFood = ['breakfast', 'lunch', 'dinner', 'water'].includes(activityType);
  const [weightRecords, educationRecords, foodRecords, stepRecords, watchRecords, timeWindows] = await Promise.all([
    activityType === 'weight' ? repo.fetchWeightRecords(userIds, startStr, endStr, timezoneIana) : Promise.resolve([]),
    activityType === 'education' ? repo.fetchEducationRecords(userIds, startStr, endStr, timezoneIana) : Promise.resolve([]),
    needsFood
      ? repo.fetchFoodRecords(userIds, startStr, endStr, timezoneIana, {
          includeAnalysisData: needsFoodAnalysisData(activityType),
        })
      : Promise.resolve([]),
    activityType === 'calories' ? repo.fetchStepRecords(userIds, startStr, endStr, timezoneIana) : Promise.resolve([]),
    activityType === 'calories' ? repo.fetchWatchCalorieRecords(userIds, startStr, endStr, timezoneIana) : Promise.resolve([]),
    repo.fetchTimeWindows(),
  ]);
  perf.mark('activity_table');

  // Timezones only for users appearing in fetched activity rows (smaller map).
  const tzUserIds = collectTimezoneUserIds(
    weightRecords, educationRecords, foodRecords, stepRecords, watchRecords,
  );
  const timezoneByUserId = tzUserIds.length > 0
    ? await getUserTimezonesIanaMap(tzUserIds)
    : {};
  perf.mark('timezones');

  const detailUserIds = collectDetailRecordUserIds({
    activityType,
    weightRecords,
    educationRecords,
    foodRecords,
    stepRecords,
    watchRecords,
    timeWindows,
    timezoneIana,
    timezoneByUserId,
  });

  if (detailUserIds.length === 0) {
    const empty = {
      httpStatus: 200,
      body: {
        success: true,
        activityType,
        dateRange,
        startDate: startStr,
        endDate: endStr,
        teamScope: resolvedScope,
        teamScopeCounts,
        records: [],
        pagination: emptyPagination(page, limit),
      },
    };
    setCachedDetailRows(rowsCacheKey, []);
    perf.done({
      userCount: userIds.length,
      recordCount: 0,
      detailUserCount: 0,
      payloadBytes: approxJsonBytes(empty.body),
    });
    return empty;
  }

  // Enrich only members who appear in this tab — not the full team.
  const members = filterPublicAggregateUsers(
    await repo.fetchMemberDetails(detailUserIds),
    { viewerUserId: userId },
  );
  perf.mark('member_fetch');

  const { records, pagination, preparedRows } = await buildPagedActivityRecords({
    activityType,
    members,
    viewerUserId: userId,
    timezoneIana,
    timezoneByUserId,
    weightRecords,
    educationRecords,
    foodRecords,
    stepRecords,
    watchRecords,
    timeWindows,
    paginationOpts,
  });
  setCachedDetailRows(rowsCacheKey, preparedRows);
  perf.mark('build_and_paginate');

  const body = {
    success: true,
    activityType,
    dateRange,
    startDate: startStr,
    endDate: endStr,
    teamScope: resolvedScope,
    teamScopeCounts,
    records,
    pagination,
  };
  perf.done({
    userCount: userIds.length,
    detailUserCount: detailUserIds.length,
    recordCount: records.length,
    totalRecords: pagination.totalRecords,
    payloadBytes: approxJsonBytes(body),
    cache: 'miss',
  });
  return { httpStatus: 200, body };
}
