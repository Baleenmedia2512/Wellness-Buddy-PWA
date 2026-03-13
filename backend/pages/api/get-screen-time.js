import { getSupabaseClient } from '../../utils/supabaseClient.js';

function toDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function shiftDate(dateKey, deltaDays) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + deltaDays);
  return toDateKey(date);
}

function sumDuration(rows) {
  return rows.reduce((acc, r) => acc + (Number(r.DurationSeconds) || 0), 0);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cache-Control, Pragma');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ success: false, message: 'Method not allowed' });
    return;
  }

  try {
    const { userId } = req.query;

    if (!userId) {
      res.status(400).json({ success: false, message: 'Missing required query param: userId' });
      return;
    }

    const supabase = getSupabaseClient();

    const todayKey = toDateKey();
    const yesterdayKey = shiftDate(todayKey, -1);
    const thirtyDaysAgoKey = shiftDate(todayKey, -29); // inclusive last 30 days

    // Fetch all sessions in the last 30 days in a single query
    const { data: rows, error } = await supabase
      .from('AppSessions')
      .select('StartTime, DurationSeconds')
      .eq('UserId', userId)
      .gte('StartTime', `${thirtyDaysAgoKey}T00:00:00`)
      .lte('StartTime', `${todayKey}T23:59:59`)
      .order('StartTime', { ascending: false });

    if (error) throw error;

    // Bucket rows by calendar date
    const byDate = {};

    for (const row of rows) {
      if (!row.StartTime) continue;
      const dayKey = toDateKey(new Date(row.StartTime));
      byDate[dayKey] = (byDate[dayKey] || 0) + (Number(row.DurationSeconds) || 0);
    }

    // Aggregate named windows
    const todaySeconds = byDate[todayKey] || 0;
    const yesterdaySeconds = byDate[yesterdayKey] || 0;

    let last7Seconds = 0;
    let last30Seconds = 0;

    for (let i = 0; i < 30; i++) {
      const key = shiftDate(todayKey, -i);
      const secs = byDate[key] || 0;
      last30Seconds += secs;
      if (i < 7) last7Seconds += secs;
    }

    // Build 30-day daily chart data (ordered oldest → newest)
    const dailyChart = [];
    for (let i = 29; i >= 0; i--) {
      const key = shiftDate(todayKey, -i);
      dailyChart.push({
        date: key,
        durationSeconds: byDate[key] || 0
      });
    }

    // Recent days list: last 7 days with data, newest first
    const recentDays = [];
    for (let i = 0; i < 30; i++) {
      const key = shiftDate(todayKey, -i);
      if (byDate[key] > 0) {
        recentDays.push({ date: key, durationSeconds: byDate[key] });
      }
      if (recentDays.length >= 7) break;
    }

    console.log(`[get-screen-time] ✅ userId=${userId} today=${todaySeconds}s rows=${rows.length}`);

    res.status(200).json({
      success: true,
      data: {
        todaySeconds,
        yesterdaySeconds,
        last7DaysSeconds: last7Seconds,
        last30DaysSeconds: last30Seconds,
        dailyChart,
        recentDays
      }
    });
  } catch (err) {
    console.error('[get-screen-time] ❌ Error:', err.message);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
}
