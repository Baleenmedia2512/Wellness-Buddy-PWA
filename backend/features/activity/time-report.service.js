import { getDualCoachingTeamHierarchy } from '../../utils/disciplineCalculationsSupabase.js';
import { isExemptedBeverageOnly, isExemptedFood } from '../../utils/foodTypeDetection.js';
import {
  parseDateRangeIST, formatDateIST, buildDateList,
  groupRecordsByDate, pickEarliestRecordPerActivity,
  computeAverageTime, convertISTToLocalDate, extractLocalDateString,
} from '../../utils/timeReportHelpers.js';
import { ValidationError } from '../../shared/lib/ValidationError.js';
import * as repo from './time-report.repository.js';

const DEFAULT_WINDOWS = {
  weight:    { start: '03:00:00', end: '06:30:00' },
  breakfast: { start: '05:30:00', end: '08:30:00' },
  lunch:     { start: '12:00:00', end: '16:00:00' },
  dinner:    { start: '17:30:00', end: '20:30:00' },
  education: { start: '05:00:00', end: '23:00:00' },
};
const DEFAULT_WATER_REQUIRED_ML = 2500;

async function resolveUsers(role, userIdInt) {
  if (role === 'admin') return repo.fetchAdminUsers();
  if (role === 'coach') {
    const hierarchy = await getDualCoachingTeamHierarchy(userIdInt, false);
    const seen = new Set();
    return (hierarchy || []).reduce((acc, m) => {
      if (!seen.has(m.UserId)) {
        seen.add(m.UserId);
        acc.push({ UserId: m.UserId, UserName: m.UserName, Email: m.Email, Role: m.Role, Bmr: m.Bmr ?? null });
      }
      return acc;
    }, []);
  }
  const me = await repo.fetchSelfUser(userIdInt);
  if (!me) return null;
  return [me];
}

function buildWindowMap(twData) {
  const windowMap = {};
  for (const tw of (twData || [])) {
    const key = String(tw.ActivityType || '').toLowerCase();
    windowMap[key] = { start: tw.WindowStartTime, end: tw.WindowEndTime };
  }
  return {
    weight:    windowMap.weight    || DEFAULT_WINDOWS.weight,
    breakfast: windowMap.breakfast || DEFAULT_WINDOWS.breakfast,
    lunch:     windowMap.lunch     || DEFAULT_WINDOWS.lunch,
    dinner:    windowMap.dinner    || DEFAULT_WINDOWS.dinner,
    education: windowMap.education || DEFAULT_WINDOWS.education,
  };
}

function indexRecords(results, usersInfo) {
  const [twR, wR, eR, fR, wfR, sR, bmrR] = results;
  const weightByUser = new Map(), educationByUser = new Map(), foodByUser = new Map();
  const waterFoodByUser = new Map(), stepByUser = new Map();
  const userBmrMap = {}, userBodyWeightMap = {};

  for (const r of (wR.data || [])) {
    if (!weightByUser.has(r.UserId)) weightByUser.set(r.UserId, []);
    weightByUser.get(r.UserId).push(r);
  }
  for (const r of (eR.data || [])) {
    if (r.Topic && String(r.Topic).startsWith('Calories Burned:')) continue;
    const uid = parseInt(r.UserId, 10);
    if (!educationByUser.has(uid)) educationByUser.set(uid, []);
    educationByUser.get(uid).push({ CreatedAt: r.CreatedAt });
  }
  for (const r of (fR.data || [])) {
    if (isExemptedBeverageOnly(r.AnalysisData)) continue;
    const uid = parseInt(r.UserID, 10);
    if (!foodByUser.has(uid)) foodByUser.set(uid, []);
    foodByUser.get(uid).push({ CreatedAt: r.CreatedAt, TotalCalories: r.TotalCalories, AnalysisData: r.AnalysisData });
  }
  for (const r of (wfR.data || [])) {
    if (!isExemptedBeverageOnly(r.AnalysisData)) continue;
    const uid = parseInt(r.UserID, 10);
    if (!waterFoodByUser.has(uid)) waterFoodByUser.set(uid, []);
    waterFoodByUser.get(uid).push(r);
  }
  for (const r of (sR.data || [])) {
    if (!stepByUser.has(r.UserId)) stepByUser.set(r.UserId, []);
    stepByUser.get(r.UserId).push(r);
  }
  for (const u of usersInfo) {
    const b = parseFloat(u.Bmr);
    userBmrMap[u.UserId] = (!isNaN(b) && b > 0) ? b : null;
  }
  for (const r of (bmrR.data || [])) {
    if (!(r.UserId in userBodyWeightMap)) {
      const w = parseFloat(r.Weight);
      userBodyWeightMap[r.UserId] = (!isNaN(w) && w > 0) ? w : null;
    }
  }
  return { twData: twR.data, weightByUser, educationByUser, foodByUser, waterFoodByUser, stepByUser, userBmrMap, userBodyWeightMap };
}

function buildWaterAndCalorieMaps(uid, indexed, tzOffset) {
  const { waterFoodByUser, foodByUser, stepByUser, userBmrMap, userBodyWeightMap } = indexed;
  const bodyWeight = userBodyWeightMap[uid] || null;
  const requiredWaterMl = bodyWeight ? Math.round((bodyWeight / 20) * 1000) : DEFAULT_WATER_REQUIRED_ML;
  const waterVolumeByDate = {}, waterLastTimeByDate = {};
  for (const r of (waterFoodByUser.get(uid) || [])) {
    const localDate = convertISTToLocalDate(r.CreatedAt, tzOffset);
    const dateStr = extractLocalDateString(localDate);
    if (!dateStr) continue;
    if (!waterVolumeByDate[dateStr]) waterVolumeByDate[dateStr] = 0;
    const hhmm = `${String(localDate.getHours()).padStart(2,'0')}:${String(localDate.getMinutes()).padStart(2,'0')}`;
    if (!waterLastTimeByDate[dateStr] || hhmm > waterLastTimeByDate[dateStr]) waterLastTimeByDate[dateStr] = hhmm;
    try {
      const analysisData = typeof r.AnalysisData === 'string' ? JSON.parse(r.AnalysisData) : r.AnalysisData;
      (analysisData?.foods || []).forEach((food) => {
        if (isExemptedFood(food.name)) {
          const ml = parseFloat(food.volume_ml) || parseFloat(food.weight_g) || parseFloat(food.estimatedWeight) || 0;
          waterVolumeByDate[dateStr] += ml;
        }
      });
    } catch (_) { /* skip */ }
  }
  const waterDoneSet = new Set(
    Object.entries(waterVolumeByDate).filter(([, ml]) => ml >= requiredWaterMl).map(([d]) => d)
  );

  const bmrTarget = userBmrMap[uid] || null;
  const calDoneSet = new Set();
  const calLastTimeByDate = {};
  const calBurnedByDate = {};
  for (const r of (stepByUser.get(uid) || [])) {
    if ((r.Steps || 0) > 0 || (r.CaloriesBurned || 0) > 0) {
      const localDate = convertISTToLocalDate(r.CreatedAt, tzOffset);
      const dateStr = extractLocalDateString(localDate);
      if (!dateStr) continue;
      const burned = parseFloat(r.CaloriesBurned) || 0;
      if ((calBurnedByDate[dateStr] || 0) < burned) calBurnedByDate[dateStr] = burned;
    }
  }
  if (bmrTarget && bmrTarget > 0) {
    const calConsumedByDate = {};
    for (const r of (foodByUser.get(uid) || [])) {
      if (isExemptedBeverageOnly(r.AnalysisData)) continue;
      const localDate = convertISTToLocalDate(r.CreatedAt, tzOffset);
      const dateStr = extractLocalDateString(localDate);
      if (!dateStr) continue;
      const cal = parseFloat(r.TotalCalories) || 0;
      calConsumedByDate[dateStr] = (calConsumedByDate[dateStr] || 0) + cal;
    }
    for (const dateStr of Object.keys(calConsumedByDate)) {
      const net = calConsumedByDate[dateStr] - (calBurnedByDate[dateStr] || 0);
      if (net <= bmrTarget) calDoneSet.add(dateStr);
    }
  }
  return { waterDoneSet, waterLastTimeByDate, waterVolumeByDate, calDoneSet, calLastTimeByDate, calBurnedByDate };
}

function buildUserReport(uid, info, dateList, windows, indexed, tzOffset) {
  const weightDateMap    = groupRecordsByDate(indexed.weightByUser.get(uid)    || [], tzOffset);
  const educationDateMap = groupRecordsByDate(indexed.educationByUser.get(uid) || [], tzOffset);
  const foodDateMap      = groupRecordsByDate(indexed.foodByUser.get(uid)      || [], tzOffset);
  const wcMaps = buildWaterAndCalorieMaps(uid, indexed, tzOffset);

  const collected = { weight: [], breakfast: [], lunch: [], dinner: [], education: [] };
  const lateCounts = { weight: 0, breakfast: 0, lunch: 0, dinner: 0, education: 0 };

  const dailyReports = dateList.map((date) => {
    const w = pickEarliestRecordPerActivity(weightDateMap.get(date)    || [], windows.weight);
    const b = pickEarliestRecordPerActivity(foodDateMap.get(date)      || [], windows.breakfast, windows.lunch.start);
    const l = pickEarliestRecordPerActivity(foodDateMap.get(date)      || [], windows.lunch, windows.dinner.start);
    const d = pickEarliestRecordPerActivity(foodDateMap.get(date)      || [], windows.dinner);
    const e = pickEarliestRecordPerActivity(educationDateMap.get(date) || [], windows.education);
    if (w.timeHHMM) { collected.weight.push(w.timeHHMM);    if (w.status === 'late') lateCounts.weight++; }
    if (b.timeHHMM) { collected.breakfast.push(b.timeHHMM); if (b.status === 'late') lateCounts.breakfast++; }
    if (l.timeHHMM) { collected.lunch.push(l.timeHHMM);     if (l.status === 'late') lateCounts.lunch++; }
    if (d.timeHHMM) { collected.dinner.push(d.timeHHMM);    if (d.status === 'late') lateCounts.dinner++; }
    if (e.timeHHMM) { collected.education.push(e.timeHHMM); if (e.status === 'late') lateCounts.education++; }

    const waterStatus = wcMaps.waterDoneSet.has(date) ? 'on-time' : 'missed';
    const calStatus   = wcMaps.calDoneSet.has(date)   ? 'on-time' : 'missed';
    return {
      date,
      activities: {
        weight:    { time: w.timeHHMM, status: w.status },
        breakfast: { time: b.timeHHMM, status: b.status },
        lunch:     { time: l.timeHHMM, status: l.status },
        dinner:    { time: d.timeHHMM, status: d.status },
        education: { time: e.timeHHMM, status: e.status },
        water:          { time: wcMaps.waterLastTimeByDate[date] || null, status: waterStatus, totalLiters: parseFloat(((wcMaps.waterVolumeByDate[date] || 0) / 1000).toFixed(2)) },
        caloriesBurned: { time: wcMaps.calLastTimeByDate[date] || null,   status: calStatus,   calories: Math.round(wcMaps.calBurnedByDate[date] || 0) },
      },
    };
  });

  const avg = (k) => computeAverageTime(collected[k]);
  const lateFlag = (k) => collected[k].length > 0 && (lateCounts[k] / collected[k].length) >= 0.5;
  return {
    userId: uid,
    name: info?.UserName || null,
    email: info?.Email || null,
    role: info?.Role || null,
    averageTimes: {
      weight: avg('weight'), breakfast: avg('breakfast'), lunch: avg('lunch'),
      dinner: avg('dinner'), education: avg('education'), water: null, caloriesBurned: null,
    },
    consistentlyLate: {
      weight: lateFlag('weight'), breakfast: lateFlag('breakfast'), lunch: lateFlag('lunch'),
      dinner: lateFlag('dinner'), education: lateFlag('education'), water: false, caloriesBurned: false,
    },
    days: dailyReports,
  };
}

export async function getTimeReport({ userId, role, dateRange, startDate, endDate, tzOffset }) {
  const dates = parseDateRangeIST(
    dateRange,
    dateRange === 'custom' ? startDate : undefined,
    dateRange === 'custom' ? endDate : undefined,
  );
  if (dateRange === 'custom' && dates.start > dates.end) {
    throw new ValidationError(400, 'startDate must be before or equal to endDate');
  }
  const startStr = formatDateIST(dates.start);
  const endStr   = formatDateIST(dates.end);

  const usersInfo = await resolveUsers(role, userId);
  if (usersInfo === null) {
    return { httpStatus: 404, body: { success: false, message: 'User not found or inactive' } };
  }
  const targetUserIds = usersInfo.map((u) => u.UserId);
  if (targetUserIds.length === 0) {
    return {
      httpStatus: 200,
      body: { success: true, dateRange, startDate: startStr, endDate: endStr, totalUsers: 0, data: [] },
    };
  }

  const results = await repo.fetchTimeReportData(targetUserIds, startStr, endStr);
  const windows = buildWindowMap(results[0].data);
  const dateList = buildDateList(dates.start, dates.end);
  const indexed = indexRecords(results, usersInfo);
  const userInfoMap = new Map(usersInfo.map((u) => [u.UserId, u]));

  const responseData = targetUserIds.map((uid) =>
    buildUserReport(uid, userInfoMap.get(uid), dateList, windows, indexed, tzOffset)
  );

  return {
    httpStatus: 200,
    body: {
      success: true, dateRange, startDate: startStr, endDate: endStr,
      timeWindows: windows, totalUsers: responseData.length, data: responseData,
    },
  };
}
