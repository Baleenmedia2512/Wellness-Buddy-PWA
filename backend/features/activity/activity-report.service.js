/**
 * Activity Report Service
 * Orchestrates activity report generation for downline members
 */
import { ValidationError } from '../../shared/lib/ValidationError.js';
import * as repo from './activity-report.repository.js';
import { resolveActivityReportUserIds } from './domain/activity-report.scope.js';
import { getUserTimezoneIana } from '../user/domain/userTimezone.js';
import {
  parseRelativeDateRangeYmd,
  normalizeStoredTimestampToUtcIso,
  timestampToCalendarYmd,
  timeOfDayInTimezone,
} from '../../shared/lib/datetime/index.js';
import { resolveFoodTimestamp } from '../../shared/lib/datetime/foodTimestamp.js';
import { resolveSponsorAndIdealCoachForMembers } from '../../utils/sponsorCoachResolution.js';

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
 * Resolve date range for activity reports using the requesting user's timezone.
 */
async function resolveReportDateRange(userId, dateRange, customStart, customEnd) {
  const timezoneIana = await getUserTimezoneIana(userId);
  return {
    timezoneIana,
    ...parseRelativeDateRangeYmd(dateRange, customStart, customEnd, timezoneIana),
  };
}

/**
 * Extract date and time from a stored timestamp in the requester's timezone.
 */
function extractDateTime(timestamp, timezoneIana, { food = false } = {}) {
  if (food) {
    const { calendarYmd, timeOfDay } = resolveFoodTimestamp(timestamp, timezoneIana);
    return { date: calendarYmd, time: timeOfDay };
  }
  const utcIso = normalizeStoredTimestampToUtcIso(timestamp, timezoneIana);
  return {
    date: timestampToCalendarYmd(utcIso, timezoneIana),
    time: timeOfDayInTimezone(utcIso, timezoneIana),
  };
}

function buildSummaryCounts({ weightRecords, educationRecords, foodRecords, stepRecords, timeWindows, timezoneIana }) {
  return {
    weight: new Set(weightRecords.map((r) => r.UserId)).size,
    education: new Set(educationRecords.map((r) => parseInt(r.UserId, 10))).size,
    breakfast: new Set(repo.filterFoodByMealTime(foodRecords, 'breakfast', timeWindows, timezoneIana).map((r) => parseInt(r.UserID, 10))).size,
    lunch: new Set(repo.filterFoodByMealTime(foodRecords, 'lunch', timeWindows, timezoneIana).map((r) => parseInt(r.UserID, 10))).size,
    dinner: new Set(repo.filterFoodByMealTime(foodRecords, 'dinner', timeWindows, timezoneIana).map((r) => parseInt(r.UserID, 10))).size,
    water: new Set(repo.filterWaterRecords(foodRecords).map((r) => parseInt(r.UserID, 10))).size,
    calories: new Set(stepRecords.filter((r) => (r.Steps || 0) > 0 || (r.CaloriesBurned || 0) > 0).map((r) => r.UserId)).size,
  };
}

function buildMemberSummaryList(userIds, memberMap, educationRecords, timezoneIana) {
  const dedupedEducation = repo.dedupeFirstLogPerMemberPerDay(educationRecords, timezoneIana);
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

async function buildDetailRecordsFromBundle({
  activityType,
  memberMap,
  timezoneIana,
  weightRecords,
  educationRecords,
  foodRecords,
  stepRecords,
  timeWindows,
}) {
  switch (activityType) {
    case 'weight': {
      const dedupedWeight = repo.dedupeFirstLogPerMemberPerDay(weightRecords, timezoneIana);
      const centerIds = [...new Set(
        dedupedWeight.filter((r) => !r.CenterName && r.NutritionCenterId).map((r) => r.NutritionCenterId),
      )];
      const centerMap = centerIds.length > 0 ? await repo.fetchNutritionCenters(centerIds) : {};
      return dedupedWeight.map((record) => {
        const member = memberMap[record.UserId] || {};
        const { date, time } = extractDateTime(record.CreatedAt, timezoneIana);
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
      const dedupedEducation = repo.dedupeFirstLogPerMemberPerDay(educationRecords, timezoneIana);
      const centerIds = [...new Set(
        dedupedEducation.filter((r) => !r.center_name && r.nutrition_center_id).map((r) => r.nutrition_center_id),
      )];
      const centerMap = centerIds.length > 0 ? await repo.fetchNutritionCenters(centerIds) : {};
      return dedupedEducation.map((record) => {
        const uidKey = String(record.UserId);
        const member = memberMap[uidKey] || {};
        const { date, time } = extractDateTime(record.CreatedAt, timezoneIana);
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
      const mealRecords = repo.filterFoodByMealTime(foodRecords, activityType, timeWindows, timezoneIana);
      const dedupedMeals = repo.dedupeFirstLogPerMemberPerDay(mealRecords, timezoneIana, { foodTimestamp: true });
      const centerIds = [...new Set(
        dedupedMeals.filter((r) => !r.CenterName && r.NutritionCenterId).map((r) => r.NutritionCenterId),
      )];
      const centerMap = centerIds.length > 0 ? await repo.fetchNutritionCenters(centerIds) : {};
      return dedupedMeals.map((record) => {
        const memberUserId = parseInt(record.UserID, 10);
        const member = memberMap[memberUserId] || {};
        const { date, time } = extractDateTime(record.CreatedAt, timezoneIana, { food: true });
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
        const { date, time } = extractDateTime(record.CreatedAt, timezoneIana, { food: true });
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
    case 'calories':
      return stepRecords.map((record) => {
        const member = memberMap[record.UserId] || {};
        const { date, time } = extractDateTime(record.CreatedAt, timezoneIana);
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
 * Single round-trip bootstrap: team scope + summary + member summary + one detail tab.
 * Resolves hierarchy once and fetches all activity tables in parallel.
 */
export async function getActivityReportBootstrap({
  userId,
  role,
  teamScope,
  dateRange,
  startDate: customStart,
  endDate: customEnd,
  detailActivity = 'education',
  includeRecords = true,
}) {
  const [{ timezoneIana, startDate: startStr, endDate: endStr }, scope] = await Promise.all([
    resolveReportDateRange(userId, dateRange, customStart, customEnd),
    resolveActivityReportUserIds({ userId, role, teamScope }),
  ]);

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
    return {
      httpStatus: 200,
      body: {
        ...baseBody,
        summary: EMPTY_SUMMARY,
        members: [],
        stats: EMPTY_STATS,
        records: [],
      },
    };
  }

  const activityFetches = [
    repo.fetchWeightRecords(userIds, startStr, endStr, timezoneIana),
    repo.fetchEducationRecords(userIds, startStr, endStr, timezoneIana),
    repo.fetchStepRecords(userIds, startStr, endStr, timezoneIana),
    repo.fetchTimeWindows(),
  ];
  if (includeRecords) {
    activityFetches.unshift(repo.fetchMemberDetails(userIds));
  }

  const fetchResults = await Promise.all(activityFetches);
  const members = includeRecords ? fetchResults[0] : [];
  const weightRecords = fetchResults[includeRecords ? 1 : 0];
  const educationRecords = fetchResults[includeRecords ? 2 : 1];
  const stepRecords = fetchResults[includeRecords ? 3 : 2];
  const timeWindows = fetchResults[includeRecords ? 4 : 3];

  // Food rows carry large AnalysisData JSON ? fetch after lighter tables to reduce parallel DB load.
  const foodRecords = await repo.fetchFoodRecords(userIds, startStr, endStr, timezoneIana);

  const summary = buildSummaryCounts({
    weightRecords, educationRecords, foodRecords, stepRecords, timeWindows, timezoneIana,
  });

  let records = [];
  if (includeRecords) {
    const sponsorByUser = await resolveSponsorAndIdealCoachForMembers(
      members.map((m) => ({ userId: m.UserId, coachId: m.CoachId })),
    );
    const detailMemberMap = buildDetailMemberMap(members, sponsorByUser);
    records = await buildDetailRecordsFromBundle({
      activityType: detailActivity,
      memberMap: detailMemberMap,
      timezoneIana,
      weightRecords,
      educationRecords,
      foodRecords,
      stepRecords,
      timeWindows,
    });
  }

  return {
    httpStatus: 200,
    body: {
      ...baseBody,
      summary,
      members: [],
      stats: EMPTY_STATS,
      records,
    },
  };
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
  
  const [weightRecords, educationRecords, stepRecords] = await Promise.all([
    repo.fetchWeightRecords(userIds, startStr, endStr, timezoneIana),
    repo.fetchEducationRecords(userIds, startStr, endStr, timezoneIana),
    repo.fetchStepRecords(userIds, startStr, endStr, timezoneIana),
  ]);
  const foodRecords = await repo.fetchFoodRecords(userIds, startStr, endStr, timezoneIana);
  
  // Get time windows for meal filtering
  const timeWindows = await repo.fetchTimeWindows();
  
  // Count unique members per activity type
  const counts = {
    weight: new Set(weightRecords.map(r => r.UserId)).size,
    education: new Set(educationRecords.map(r => parseInt(r.UserId, 10))).size,
    breakfast: new Set(repo.filterFoodByMealTime(foodRecords, 'breakfast', timeWindows, timezoneIana).map(r => parseInt(r.UserID, 10))).size,
    lunch: new Set(repo.filterFoodByMealTime(foodRecords, 'lunch', timeWindows, timezoneIana).map(r => parseInt(r.UserID, 10))).size,
    dinner: new Set(repo.filterFoodByMealTime(foodRecords, 'dinner', timeWindows, timezoneIana).map(r => parseInt(r.UserID, 10))).size,
    water: new Set(repo.filterWaterRecords(foodRecords).map(r => parseInt(r.UserID, 10))).size,
    calories: new Set(stepRecords.filter(r => (r.Steps || 0) > 0 || (r.CaloriesBurned || 0) > 0).map(r => r.UserId)).size,
  };
  
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
  const members = await repo.fetchMemberDetails(userIds);
  const sponsorByUser = await resolveSponsorAndIdealCoachForMembers(
    members.map((m) => ({ userId: m.UserId, coachId: m.CoachId })),
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
  const educationRecords = await repo.fetchEducationRecords(userIds, startStr, endStr, timezoneIana);
  const dedupedEducation = repo.dedupeFirstLogPerMemberPerDay(educationRecords, timezoneIana);
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
export async function getActivityDetails({ userId, role, teamScope, activityType, dateRange, startDate: customStart, endDate: customEnd }) {
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
        activityType,
        dateRange,
        startDate: startStr,
        endDate: endStr,
        teamScope: resolvedScope,
        teamScopeCounts,
        records: [],
      },
    };
  }
  
  // Fetch member details + sponsor / ideal coach (ADR-0007)
  const members = await repo.fetchMemberDetails(userIds);
  const sponsorByUser = await resolveSponsorAndIdealCoachForMembers(
    members.map((m) => ({ userId: m.UserId, coachId: m.CoachId })),
  );

  // Build member info map ? keyed by both numeric and string UserId
  const memberMap = {};
  members.forEach(member => {
    const info = applySponsorFields({
      name: member.UserName || 'N/A',
      phone: member.PhoneNumber || 'N/A',
      email: member.Email || '',
      city: 'N/A',
      village: 'N/A',
      role: member.Role || 'member',
    }, sponsorByUser.get(String(member.UserId)));
    memberMap[member.UserId] = info;
    memberMap[String(member.UserId)] = info;
  });
  
  let records = [];
  
  // Fetch activity-specific records
  switch (activityType) {
    case 'weight':
      {
        const weightRecords = await repo.fetchWeightRecords(userIds, startStr, endStr, timezoneIana);
        const dedupedWeight = repo.dedupeFirstLogPerMemberPerDay(weightRecords, timezoneIana);

        const centerIds = [...new Set(
          dedupedWeight
            .filter(r => !r.CenterName && r.NutritionCenterId)
            .map(r => r.NutritionCenterId)
        )];
        const centerMap = centerIds.length > 0 ? await repo.fetchNutritionCenters(centerIds) : {};

        records = dedupedWeight.map(record => {
          const member = memberMap[record.UserId] || {};
          const { date, time } = extractDateTime(record.CreatedAt, timezoneIana);
          const clubName = record.CenterName || centerMap[record.NutritionCenterId] || 'N/A';
          return {
            userId: record.UserId,
            memberName: member.name,
            city: record.City || member.city || 'N/A',
            village: record.Village || member.village || 'N/A',
            phone: member.phone,
            ...sponsorCoachRowFields(member),
            date,
            time,
           clubName: record.CenterName || 'N/A',
            weight: record.Weight || 'N/A',
          };
        });
      }
      break;
      
    case 'education':
      {
        const educationRecords = await repo.fetchEducationRecords(userIds, startStr, endStr, timezoneIana);
        const dedupedEducation = repo.dedupeFirstLogPerMemberPerDay(educationRecords, timezoneIana);

        // Fetch nutrition center names for records that don't have center_name stored
        const centerIds = [...new Set(
          dedupedEducation
            .filter(r => !r.center_name && r.nutrition_center_id)
            .map(r => r.nutrition_center_id)
        )];
        const centerMap = centerIds.length > 0 ? await repo.fetchNutritionCenters(centerIds) : {};

        records = dedupedEducation.map(record => {
          // UserId in education_logs_table is stored as string
          const uidKey = String(record.UserId);
          const member = memberMap[uidKey] || {};
          const { date, time } = extractDateTime(record.CreatedAt, timezoneIana);
          // Prefer the stored center_name; fall back to looked-up center name
          const clubName = record.center_name || centerMap[record.nutrition_center_id] || 'N/A';

          return {
            userId: uidKey,
            memberName: member.name || 'N/A',
            city: record.City || member.city || 'N/A',
            village: record.Village || member.village || 'N/A',
            phone: member.phone || 'N/A',
            ...sponsorCoachRowFields(member),
            date,
            time,
            clubName,
            attendanceType: record.attendance_type || 'N/A',
            topic: record.Topic || 'N/A',
          };
        });
      }
      break;
      
    case 'breakfast':
    case 'lunch':
    case 'dinner':
      {
        const foodRecords = await repo.fetchFoodRecords(userIds, startStr, endStr, timezoneIana);
        const timeWindows = await repo.fetchTimeWindows();
        const mealRecords = repo.filterFoodByMealTime(foodRecords, activityType, timeWindows, timezoneIana);
        // One row per member per day ? first meal log only (matches summary counts)
        const dedupedMeals = repo.dedupeFirstLogPerMemberPerDay(mealRecords, timezoneIana, { foodTimestamp: true });

        const centerIds = [...new Set(
          dedupedMeals
            .filter(r => !r.CenterName && r.NutritionCenterId)
            .map(r => r.NutritionCenterId)
        )];
        const centerMap = centerIds.length > 0 ? await repo.fetchNutritionCenters(centerIds) : {};

        records = dedupedMeals.map(record => {
          const memberUserId = parseInt(record.UserID, 10);
          const member = memberMap[memberUserId] || {};
          const { date, time } = extractDateTime(record.CreatedAt, timezoneIana, { food: true });
          const clubName = record.CenterName || centerMap[record.NutritionCenterId] || 'N/A';

          return {
            userId: memberUserId,
            memberName: member.name,
            city: record.City || member.city || 'N/A',
            village: record.Village || member.village || 'N/A',
            phone: member.phone,
            ...sponsorCoachRowFields(member),
            date,
            time,
            clubName,
            calories: record.TotalCalories || 0,
            mealType: activityType,
          };
        });
      }
      break;
      
    case 'water':
      {
        const foodRecords = await repo.fetchFoodRecords(userIds, startStr, endStr, timezoneIana);
        const waterRecords = repo.filterWaterRecords(foodRecords);

        const centerIds = [...new Set(
          waterRecords
            .filter(r => !r.CenterName && r.NutritionCenterId)
            .map(r => r.NutritionCenterId)
        )];
        const centerMap = centerIds.length > 0 ? await repo.fetchNutritionCenters(centerIds) : {};

        records = waterRecords.map(record => {
          const memberUserId = parseInt(record.UserID, 10);
          const member = memberMap[memberUserId] || {};
          const { date, time } = extractDateTime(record.CreatedAt, timezoneIana, { food: true });
          const volumeLiters = repo.calculateWaterVolume(record);
          const clubName = record.CenterName || centerMap[record.NutritionCenterId] || 'N/A';

          return {
            userId: memberUserId,
            memberName: member.name,
            city: record.City || member.city || 'N/A',
            village: record.Village || member.village || 'N/A',
            phone: member.phone,
            ...sponsorCoachRowFields(member),
            date,
            time,
            clubName,
            waterLiters: volumeLiters,
          };
        });
      }
      break;
      
    case 'calories':
      {
        const stepRecords = await repo.fetchStepRecords(userIds, startStr, endStr, timezoneIana);
        
        records = stepRecords.map(record => {
          const member = memberMap[record.UserId] || {};
          const { date, time } = extractDateTime(record.CreatedAt, timezoneIana);
          
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
      }
      break;
      
    default:
      throw new ValidationError(400, `Invalid activityType: ${activityType}`);
  }
  
  return {
    httpStatus: 200,
    body: {
      success: true,
      activityType,
      dateRange,
      startDate: startStr,
      endDate: endStr,
      teamScope: resolvedScope,
      teamScopeCounts,
      records,
    },
  };
}
