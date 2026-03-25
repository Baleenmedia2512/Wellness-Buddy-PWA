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
import {
  parseDateRangeIST,
  formatDateIST,
  buildDateList,
  groupRecordsByDate,
  pickEarliestRecordPerActivity,
  computeAverageTime,
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

    // ── Input validation ────────────────────────────────────────────────────

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
    // All four queries run concurrently for maximum performance.
    // Date filtering happens in SQL to avoid pulling more rows than needed.

    const [twResult, weightResult, educationResult, foodResult] = await Promise.all([

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

      // Education logs – UserId is an integer in this table
      supabase
        .from('education_logs_table')
        .select('UserId, CreatedAt')
        .in('UserId', targetUserIds)
        .gte('CreatedAt', startStr)
        .lte('CreatedAt', endStr + 'T23:59:59')
        .or('IsDeleted.is.null,IsDeleted.eq.0'),

      // Food / nutrition records – UserID is stored as a string in this table
      supabase
        .from('food_nutrition_data_table')
        .select('UserID, CreatedAt')
        .in('UserID', targetUserIds.map(String))
        .gte('CreatedAt', startStr)
        .lte('CreatedAt', endStr + 'T23:59:59')
        .or('IsDeleted.is.null,IsDeleted.eq.0'),
    ]);

    if (twResult.error)        console.error('⚠️ [get-activity-time-report] time-windows error:',  twResult.error);
    if (weightResult.error)    console.error('⚠️ [get-activity-time-report] weight error:',         weightResult.error);
    if (educationResult.error) console.error('⚠️ [get-activity-time-report] education error:',      educationResult.error);
    if (foodResult.error)      console.error('⚠️ [get-activity-time-report] food error:',           foodResult.error);

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

    for (const r of (weightResult.data || [])) {
      const uid = r.UserId;
      if (!weightByUser.has(uid)) weightByUser.set(uid, []);
      weightByUser.get(uid).push(r);
    }

    for (const r of (educationResult.data || [])) {
      const uid = r.UserId;
      if (!educationByUser.has(uid)) educationByUser.set(uid, []);
      educationByUser.get(uid).push(r);
    }

    for (const r of (foodResult.data || [])) {
      // food_nutrition_data_table stores UserID as a string
      const uid = parseInt(r.UserID, 10);
      if (!foodByUser.has(uid)) foodByUser.set(uid, []);
      foodByUser.get(uid).push({ CreatedAt: r.CreatedAt });
    }

    // ── Build per-user, per-day activity report ─────────────────────────────

    const userInfoMap  = new Map(usersInfo.map((u) => [u.UserId, u]));
    const responseData = [];

    for (const uid of targetUserIds) {
      const info = userInfoMap.get(uid);

      // Group each activity's records by user-local date
      const weightDateMap    = groupRecordsByDate(weightByUser.get(uid)    || [], tzOffset);
      const educationDateMap = groupRecordsByDate(educationByUser.get(uid) || [], tzOffset);
      const foodDateMap      = groupRecordsByDate(foodByUser.get(uid)      || [], tzOffset);

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
          foodDateMap.get(date)      || [], windows.breakfast,
        );
        const l = pickEarliestRecordPerActivity(
          foodDateMap.get(date)      || [], windows.lunch,
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

        return {
          date,
          activities: {
            weight:    { time: w.timeHHMM, status: w.status },
            breakfast: { time: b.timeHHMM, status: b.status },
            lunch:     { time: l.timeHHMM, status: l.status },
            dinner:    { time: d.timeHHMM, status: d.status },
            education: { time: e.timeHHMM, status: e.status },
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
