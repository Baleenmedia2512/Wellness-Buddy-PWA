/**
 * GET /api/get-activity-time-report
 *
 * Returns the exact time each user performed their tracked daily activities
 * (weight, breakfast, lunch, dinner, education) and whether those times were
 * on-time, late, or missed relative to the configured time windows.
 *
 * ⚠️  INDEPENDENT MODULE — does NOT modify or share code with:
 *      /api/coach/discipline-report  or  /api/admin/all-members-discipline
 *
 * Query parameters
 * ─────────────────────────────────────────────────────────────────────────────
 *  userId             {number}   Required. The requesting user's ID.
 *  role               {string}   "member" | "coach" | "admin"  (default: "member")
 *  dateRange          {string}   "today" | "yesterday" | "last7days" | "last30days" | "custom"
 *  startDate          {string}   YYYY-MM-DD  (required only when dateRange = "custom")
 *  endDate            {string}   YYYY-MM-DD  (required only when dateRange = "custom")
 *  userTimezoneOffset {number}   JS-style offset in minutes.
 *                                Positive = west of UTC,  negative = east of UTC.
 *                                Examples: IST (UTC+5:30) → -330 | EST (UTC-5) → +300
 *                                Default: 0 (UTC) — caller should always pass this.
 *
 * Role-based access
 * ─────────────────────────────────────────────────────────────────────────────
 *  member → only their own data
 *  coach  → their own data + full recursive downline (dual-coach model)
 *  admin  → all active users system-wide
 *
 * Response shape (per user per day)
 * ─────────────────────────────────────────────────────────────────────────────
 * {
 *   userId, name, email, role,
 *   averageTimes:    { weight, breakfast, lunch, dinner, education },  // "HH:mm" | null
 *   consistentlyLate:{ weight, breakfast, lunch, dinner, education },  // boolean
 *   days: [
 *     {
 *       date: "YYYY-MM-DD",
 *       activities: {
 *         weight:    { time: "HH:mm" | null, status: "on-time"|"late"|"missed" },
 *         breakfast: { ... },
 *         lunch:     { ... },
 *         dinner:    { ... },
 *         education: { ... },
 *       }
 *     },
 *     ...
 *   ]
 * }
 */

import { getSupabaseClient }               from '../../utils/supabaseClient.js';
import { getDualCoachingTeamHierarchy }    from '../../utils/disciplineCalculationsSupabase.js';
import { isExemptedBeverageOnly }          from '../../utils/foodTypeDetection.js';
import { isExemptedBeverageOnly, isExemptedFood } from '../../utils/foodTypeDetection.js';
import {
  parseDateRangeIST,
  formatDateIST,
  buildDateList,
  groupRecordsByDate,
  pickEarliestRecordPerActivity,
  computeAverageTime,
  convertISTToLocalDate,
  extractLocalDateString,
} from '../../utils/timeReportHelpers.js';

// ─── Default time-window fallbacks (used when DB has no active window) ────────
const DEFAULT_WINDOWS = {
  weight:    { start: '03:00:00', end: '06:30:00' },
  breakfast: { start: '05:30:00', end: '08:30:00' },
  lunch:     { start: '12:00:00', end: '16:00:00' },
  dinner:    { start: '17:30:00', end: '20:30:00' },
  education: { start: '05:00:00', end: '23:00:00' },
};

// ─── Handler ─────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, cache-control, pragma');
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const {
      userId,
      role = 'member',
      dateRange,
      startDate,
      endDate,
      userTimezoneOffset,
    } = req.query;

    // ── Input validation ─────────────────────────────────────────────────..see 

    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required' });
    }

    const userIdInt = parseInt(userId, 10);
    if (isNaN(userIdInt)) {
      return res.status(400).json({ success: false, message: 'userId must be a valid number' });
    }

    if (!dateRange) {
      return res.status(400).json({ success: false, message: 'dateRange is required' });
    }

    const VALID_RANGES = new Set(['today', 'yesterday', 'last7days', 'last30days', 'custom']);
    if (!VALID_RANGES.has(dateRange)) {
      return res.status(400).json({
        success: false,
        message: 'dateRange must be one of: today, yesterday, last7days, last30days, custom',
      });
    }

    if (dateRange === 'custom' && (!startDate || !endDate)) {
      return res.status(400).json({
        success: false,
        message: 'startDate and endDate are required when dateRange is "custom"',
      });
    }

    const normalizedRole = String(role).toLowerCase();
    const VALID_ROLES = new Set(['member', 'coach', 'admin']);
    if (!VALID_ROLES.has(normalizedRole)) {
      return res.status(400).json({
        success: false,
        message: 'role must be one of: member, coach, admin',
      });
    }

    // userTimezoneOffset: default to 0 (UTC) when not supplied
    const tzOffset = userTimezoneOffset !== undefined
      ? parseInt(userTimezoneOffset, 10)
      : 0;

    // ── Date range ──────────────────────────────────────────────────────────

    const dates = parseDateRangeIST(
      dateRange,
      dateRange === 'custom' ? startDate : undefined,
      dateRange === 'custom' ? endDate   : undefined,
    );

    if (dateRange === 'custom' && dates.start > dates.end) {
      return res.status(400).json({
        success: false,
        message: 'startDate must be before or equal to endDate',
      });
    }

    const startStr = formatDateIST(dates.start);
    const endStr   = formatDateIST(dates.end);

    const supabase = getSupabaseClient();

    // ── Determine target users based on role ────────────────────────────────

    let usersInfo    = [];
    let targetUserIds = [];

    if (normalizedRole === 'admin') {
      // Admin: every active user in the system
      const { data: allUsers, error: allErr } = await supabase
        .from('team_table')
        .select('UserId, UserName, Email, Role')
        .eq('Status', 'Active');

      if (allErr) throw allErr;
      usersInfo = allUsers || [];

    } else if (normalizedRole === 'coach') {
      // Coach: self + full recursive downline (dual-coaching model)
      const hierarchy = await getDualCoachingTeamHierarchy(userIdInt, false);
      const seen = new Set();
      usersInfo = (hierarchy || []).reduce((acc, m) => {
        if (!seen.has(m.UserId)) {
          seen.add(m.UserId);
          acc.push({
            UserId:   m.UserId,
            UserName: m.UserName,
            Email:    m.Email,
            Role:     m.Role,
          });
        }
        return acc;
      }, []);

    } else {
      // Member: only themselves
      const { data: me, error: meErr } = await supabase
        .from('team_table')
        .select('UserId, UserName, Email, Role')
        .eq('UserId', userIdInt)
        .eq('Status', 'Active')
        .maybeSingle();

      if (meErr || !me) {
        return res.status(404).json({ success: false, message: 'User not found or inactive' });
      }
      usersInfo = [me];
    }

    targetUserIds = usersInfo.map((u) => u.UserId);

    if (targetUserIds.length === 0) {
      return res.status(200).json({
        success:    true,
        dateRange,
        startDate:  startStr,
        endDate:    endStr,
        totalUsers: 0,
        data:       [],
      });
    }

    // ── Parallel data fetch ─────────────────────────────────────────────────
    // All queries run concurrently for maximum performance.
    // Date filtering happens in SQL to avoid pulling more rows than needed.

    const [twResult, weightResult, educationResult, foodResult, waterFoodResult, stepResult, bmrResult] = await Promise.all([

      // Active time windows (EffectiveToDate IS NULL means currently in effect)
      supabase
        .from('activity_time_windows_table')
        .select('ActivityType, WindowStartTime, WindowEndTime')
        .is('EffectiveToDate', null),

      // Weight records – UserId is an integer in this table
      supabase
        .from('weight_records_table')
        .select('UserId, CreatedAt')
        .in('UserId', targetUserIds)
        .gte('CreatedAt', startStr)
        .lte('CreatedAt', endStr + 'T23:59:59')
        .or('IsDeleted.is.null,IsDeleted.eq.0'),

      // Education logs – UserId is stored as STRING in this table  ⚠️
      supabase
        .from('education_logs_table')
        .select('"UserId", "CreatedAt"')
        .in('"UserId"', targetUserIds.map(String))
        .gte('"CreatedAt"', startStr)
        .lte('"CreatedAt"', endStr + 'T23:59:59')
        .or('"IsDeleted".is.null,"IsDeleted".eq.0'),

      // Food / nutrition records for meal timing (UserID is stored as a string)
      supabase
        .from('food_nutrition_data_table')
        .select('UserID, CreatedAt, TotalCalories, AnalysisData')
        .in('UserID', targetUserIds.map(String))
        .gte('CreatedAt', startStr)
        .lte('CreatedAt', endStr + 'T23:59:59')
        .or('IsDeleted.is.null,IsDeleted.eq.0'),

      // Water food records (beverage-only) – need AnalysisData to detect water
      supabase
        .from('food_nutrition_data_table')
        .select('UserID, CreatedAt, AnalysisData')
        .in('UserID', targetUserIds.map(String))
        .gte('CreatedAt', startStr)
        .lte('CreatedAt', endStr + 'T23:59:59')
        .or('IsDeleted.is.null,IsDeleted.eq.0'),

      // Step activity – for calories burned per day
      supabase
        .from('daily_step_activity')
        .select('UserId, CreatedAt, CaloriesBurned, Steps')
        .in('UserId', targetUserIds)
        .gte('CreatedAt', startStr)
        .lte('CreatedAt', endStr + 'T23:59:59'),

      // Latest weight per user (for BMR + water requirement) – wider range: any recorded weight
      supabase
        .from('weight_records_table')
        .select('UserId, Weight, Bmr, CreatedAt')
        .in('UserId', targetUserIds)
        .order('CreatedAt', { ascending: false }),
    ]);

    if (twResult.error)          console.error('⚠️ [get-activity-time-report] time-windows error:',   twResult.error);
    if (weightResult.error)      console.error('⚠️ [get-activity-time-report] weight error:',           weightResult.error);
    if (educationResult.error)   console.error('⚠️ [get-activity-time-report] education error:',        educationResult.error);
    if (foodResult.error)        console.error('⚠️ [get-activity-time-report] food error:',             foodResult.error);
    if (waterFoodResult.error)   console.error('⚠️ [get-activity-time-report] water-food error:',       waterFoodResult.error);
    if (stepResult.error)        console.error('⚠️ [get-activity-time-report] step error:',             stepResult.error);
    if (bmrResult.error)         console.error('⚠️ [get-activity-time-report] bmr error:',              bmrResult.error);

    console.log(`✅ [get-activity-time-report] Fetched data: ${weightResult.data?.length || 0} weight, ${educationResult.data?.length || 0} education, ${foodResult.data?.length || 0} food, ${stepResult.data?.length || 0} steps records`);

    // ── Build resolved time-window map (DB values override defaults) ────────

    const windowMap = {};
    for (const tw of (twResult.data || [])) {
      const key = String(tw.ActivityType || '').toLowerCase();
      windowMap[key] = {
        start: tw.WindowStartTime,
        end:   tw.WindowEndTime,
      };
    }

    const windows = {
      weight:    windowMap.weight    || DEFAULT_WINDOWS.weight,
      breakfast: windowMap.breakfast || DEFAULT_WINDOWS.breakfast,
      lunch:     windowMap.lunch     || DEFAULT_WINDOWS.lunch,
      dinner:    windowMap.dinner    || DEFAULT_WINDOWS.dinner,
      education: windowMap.education || DEFAULT_WINDOWS.education,
    };

    const dateList = buildDateList(dates.start, dates.end);

    // ── Index raw records by userId ─────────────────────────────────────────

    const weightByUser    = new Map();
    const educationByUser = new Map();
    const foodByUser      = new Map();
    // Water: only beverage-only records
    const waterFoodByUser = new Map();
    // Steps / calories burned
    const stepByUser      = new Map();
    // Latest BMR and body weight per user
    const userBmrMap      = {};
    const userBodyWeightMap = {};

    for (const r of (weightResult.data || [])) {
      const uid = r.UserId;
      if (!weightByUser.has(uid)) weightByUser.set(uid, []);
      weightByUser.get(uid).push(r);
    }

    for (const r of (educationResult.data || [])) {
      const uid = parseInt(r.UserId, 10); // Convert string to number
      if (!educationByUser.has(uid)) educationByUser.set(uid, []);
      educationByUser.get(uid).push({ CreatedAt: r.CreatedAt });
    }

    for (const r of (foodResult.data || [])) {
      // food_nutrition_data_table stores UserID as a string
      // Skip water-only / beverage-only entries (e.g. water, coffee, tea)
      if (isExemptedBeverageOnly(r.AnalysisData)) continue;
      const uid = parseInt(r.UserID, 10);
      if (!foodByUser.has(uid)) foodByUser.set(uid, []);
      // Store record for meal-timing; also carry AnalysisData to filter beverages from calorie sum
      foodByUser.get(uid).push({ CreatedAt: r.CreatedAt, TotalCalories: r.TotalCalories, AnalysisData: r.AnalysisData });
    }

    // Filter water records from beverage-only food entries
    for (const r of (waterFoodResult.data || [])) {
      if (!isExemptedBeverageOnly(r.AnalysisData)) continue;
      const uid = parseInt(r.UserID, 10);
      if (!waterFoodByUser.has(uid)) waterFoodByUser.set(uid, []);
      waterFoodByUser.get(uid).push(r);
    }

    for (const r of (stepResult.data || [])) {
      const uid = r.UserId;
      if (!stepByUser.has(uid)) stepByUser.set(uid, []);
      stepByUser.get(uid).push(r);
    }

    // Build latest BMR and body weight maps (bmrResult is ordered desc by CreatedAt)
    for (const r of (bmrResult.data || [])) {
      const uid = r.UserId;
      if (!(uid in userBmrMap)) {
        const b = parseFloat(r.Bmr);
        userBmrMap[uid] = (!isNaN(b) && b > 0) ? b : null;
      }
      if (!(uid in userBodyWeightMap)) {
        const w = parseFloat(r.Weight);
        userBodyWeightMap[uid] = (!isNaN(w) && w > 0) ? w : null;
      }
    }

    console.log(`🔍 [get-activity-time-report] BMR map:`, JSON.stringify(userBmrMap));
    console.log(`🔍 [get-activity-time-report] BodyWeight map:`, JSON.stringify(userBodyWeightMap));
    console.log(`🔍 [get-activity-time-report] targetUserIds:`, targetUserIds);
    console.log(`🔍 [get-activity-time-report] stepByUser keys:`, [...stepByUser.keys()]);
    console.log(`🔍 [get-activity-time-report] foodByUser keys:`, [...foodByUser.keys()]);

    const DEFAULT_WATER_REQUIRED_ML = 2500;

    // ── Build per-user, per-day activity report ─────────────────────────────

    const userInfoMap  = new Map(usersInfo.map((u) => [u.UserId, u]));
    const responseData = [];

    for (const uid of targetUserIds) {
      const info = userInfoMap.get(uid);

      // Group each activity's records by user-local date
      const weightDateMap    = groupRecordsByDate(weightByUser.get(uid)    || [], tzOffset);
      const educationDateMap = groupRecordsByDate(educationByUser.get(uid) || [], tzOffset);
      const foodDateMap      = groupRecordsByDate(foodByUser.get(uid)      || [], tzOffset);

      // ── Pre-compute water achieved dates ──────────────────────────────────
      const userBodyWeight   = userBodyWeightMap[uid] || null;
      const requiredWaterMl  = userBodyWeight
        ? Math.round((userBodyWeight / 20) * 1000)
        : DEFAULT_WATER_REQUIRED_ML;
      const waterVolumeByDate = {};
      for (const r of (waterFoodByUser.get(uid) || [])) {
        // Use timezone-aware date key so it matches dateList entries
        const localDate = convertISTToLocalDate(r.CreatedAt, tzOffset);
        const dateStr   = extractLocalDateString(localDate);
        if (!dateStr) continue;
        if (!waterVolumeByDate[dateStr]) waterVolumeByDate[dateStr] = 0;
        try {
          const analysisData = typeof r.AnalysisData === 'string'
            ? JSON.parse(r.AnalysisData)
            : r.AnalysisData;
          (analysisData?.foods || []).forEach((food) => {
            if (isExemptedFood(food.name)) {
              const ml = parseFloat(food.volume_ml) || parseFloat(food.weight_g) || parseFloat(food.estimatedWeight) || 0;
              waterVolumeByDate[dateStr] += ml;
            }
          });
        } catch (e) { /* skip malformed */ }
      }
      const waterDoneSet = new Set(
        Object.entries(waterVolumeByDate)
          .filter(([, ml]) => ml >= requiredWaterMl)
          .map(([d]) => d)
      );

      // ── Pre-compute calories-disciplined dates ────────────────────────────
      const userBmrTarget   = userBmrMap[uid] || null;
      const calDoneSet      = new Set();

      console.log(`🔍 [CAL] uid=${uid} bmrTarget=${userBmrTarget} foodRecords=${(foodByUser.get(uid) || []).length} stepRecords=${(stepByUser.get(uid) || []).length}`);

      if (userBmrTarget && userBmrTarget > 0) {
        // Sum calories consumed per date from NON-beverage food records only
        const calConsumedByDate = {};
        for (const r of (foodByUser.get(uid) || [])) {
          // Skip beverage-only records (water, tea, coffee, afresh)
          if (isExemptedBeverageOnly(r.AnalysisData)) continue;
          // Use timezone-aware date key
          const localDate = convertISTToLocalDate(r.CreatedAt, tzOffset);
          const dateStr   = extractLocalDateString(localDate);
          if (!dateStr) continue;
          const cal = parseFloat(r.TotalCalories) || 0;
          calConsumedByDate[dateStr] = (calConsumedByDate[dateStr] || 0) + cal;
        }
        // Max calories burned per date from step activity (cumulative tracker)
        const calBurnedByDate = {};
        for (const r of (stepByUser.get(uid) || [])) {
          if ((r.Steps || 0) > 0 || (r.CaloriesBurned || 0) > 0) {
            const localDate = convertISTToLocalDate(r.CreatedAt, tzOffset);
            const dateStr   = extractLocalDateString(localDate);
            if (!dateStr) continue;
            const burned = parseFloat(r.CaloriesBurned) || 0;
            if ((calBurnedByDate[dateStr] || 0) < burned) {
              calBurnedByDate[dateStr] = burned;
            }
          }
        }
        // A day is disciplined if net calories (consumed - burned) <= BMR target
        for (const dateStr of Object.keys(calConsumedByDate)) {
          const net = calConsumedByDate[dateStr] - (calBurnedByDate[dateStr] || 0);
          console.log(`🔍 [CAL] uid=${uid} date=${dateStr} consumed=${calConsumedByDate[dateStr]} burned=${calBurnedByDate[dateStr]||0} net=${net} bmr=${userBmrTarget} pass=${net <= userBmrTarget}`);
          if (net <= userBmrTarget) calDoneSet.add(dateStr);
        }
      }
      console.log(`🔍 [CAL] uid=${uid} calDoneSet=`, [...calDoneSet], `dateList=`, dateList);

      // Accumulators for bonus stats
      const collectedTimes = {
        weight: [], breakfast: [], lunch: [], dinner: [], education: [],
      };
      const lateCounts = {
        weight: 0, breakfast: 0, lunch: 0, dinner: 0, education: 0,
      };

      // Build daily breakdown
      const dailyReports = dateList.map((date) => {
        const w = pickEarliestRecordPerActivity(
          weightDateMap.get(date)    || [], windows.weight,
        );
        const b = pickEarliestRecordPerActivity(
          foodDateMap.get(date)      || [], windows.breakfast, windows.lunch.start,
        );
        const l = pickEarliestRecordPerActivity(
          foodDateMap.get(date)      || [], windows.lunch, windows.dinner.start,
        );
        const d = pickEarliestRecordPerActivity(
          foodDateMap.get(date)      || [], windows.dinner,
        );
        const e = pickEarliestRecordPerActivity(
          educationDateMap.get(date) || [], windows.education,
        );

        // Accumulate times and late counts for averages / consistently-late flag
        if (w.timeHHMM) { collectedTimes.weight.push(w.timeHHMM);       if (w.status === 'late') lateCounts.weight++; }
        if (b.timeHHMM) { collectedTimes.breakfast.push(b.timeHHMM);    if (b.status === 'late') lateCounts.breakfast++; }
        if (l.timeHHMM) { collectedTimes.lunch.push(l.timeHHMM);        if (l.status === 'late') lateCounts.lunch++; }
        if (d.timeHHMM) { collectedTimes.dinner.push(d.timeHHMM);       if (d.status === 'late') lateCounts.dinner++; }
        if (e.timeHHMM) { collectedTimes.education.push(e.timeHHMM);    if (e.status === 'late') lateCounts.education++; }

        // Water and calories: done/missed only (no time window, no "late" state)
        const waterStatus = waterDoneSet.has(date) ? 'on-time' : 'missed';
        const calStatus   = calDoneSet.has(date)   ? 'on-time' : 'missed';

        return {
          date,
          activities: {
            weight:          { time: w.timeHHMM, status: w.status },
            breakfast:       { time: b.timeHHMM, status: b.status },
            lunch:           { time: l.timeHHMM, status: l.status },
            dinner:          { time: d.timeHHMM, status: d.status },
            education:       { time: e.timeHHMM, status: e.status },
            water:           { time: null,        status: waterStatus },
            caloriesBurned:  { time: null,        status: calStatus  },
          },
        };
      });

      // Bonus: average logged time per activity
      const averageTimes = {
        weight:    computeAverageTime(collectedTimes.weight),
        breakfast: computeAverageTime(collectedTimes.breakfast),
        lunch:     computeAverageTime(collectedTimes.lunch),
        dinner:    computeAverageTime(collectedTimes.dinner),
        education: computeAverageTime(collectedTimes.education),
        water:     null,
        caloriesBurned: null,
      };

      // Bonus: "consistently late" flag — ≥50 % of submitted days are late
      const isConsistentlyLate = (key) => {
        const total = collectedTimes[key].length;
        return total > 0 && (lateCounts[key] / total) >= 0.5;
      };

      const consistentlyLate = {
        weight:    isConsistentlyLate('weight'),
        breakfast: isConsistentlyLate('breakfast'),
        lunch:     isConsistentlyLate('lunch'),
        dinner:    isConsistentlyLate('dinner'),
        education: isConsistentlyLate('education'),
        water:     false,
        caloriesBurned: false,
      };

      responseData.push({
        userId: uid,
        name:   info?.UserName || null,
        email:  info?.Email    || null,
        role:   info?.Role     || null,
        averageTimes,
        consistentlyLate,
        days: dailyReports,
      });
    }

    return res.status(200).json({
      success:    true,
      dateRange,
      startDate:  startStr,
      endDate:    endStr,
      timeWindows: windows,
      totalUsers: responseData.length,
      data:       responseData,
    });

  } catch (error) {
    console.error('❌ [get-activity-time-report] Unhandled error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate time report',
      error:   error.message,
    });
  }
}
