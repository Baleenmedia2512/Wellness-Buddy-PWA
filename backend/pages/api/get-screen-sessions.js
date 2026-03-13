import { getSupabaseClient } from '../../utils/supabaseClient.js';

function toDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { userId, days = '7' } = req.query;

  if (!userId) {
    return res.status(400).json({ success: false, error: 'Missing required query param: userId' });
  }

  const parsedUserId = Number.parseInt(userId, 10);
  const parsedDays = Math.min(Math.max(Number.parseInt(days, 10) || 7, 1), 90);

  if (Number.isNaN(parsedUserId) || parsedUserId <= 0) {
    return res.status(400).json({ success: false, error: 'Invalid userId' });
  }

  try {
    const supabase = getSupabaseClient();
    const todayKey = toDateKey();
    const rangeStart = `${todayKey}T23:59:59`;

    // Calculate the start of the date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (parsedDays - 1));
    const rangeFrom = `${toDateKey(startDate)}T00:00:00`;

    console.log(`[get-screen-sessions] 🔍 Fetching ${parsedDays} days of sessions for userId=${parsedUserId}`);

    const { data: rows, error } = await supabase
      .from('screen_sessions_table')
      .select('Id, UserId, StartTime, EndTime, DurationSeconds, CreatedAt')
      .eq('UserId', parsedUserId)
      .gte('StartTime', rangeFrom)
      .lte('StartTime', rangeStart)
      .order('StartTime', { ascending: false });

    if (error) throw error;

    // Build daily totals
    const dailyMap = new Map();
    for (let i = 0; i < parsedDays; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = toDateKey(d);
      dailyMap.set(key, { date: key, totalDurationSeconds: 0, sessionCount: 0 });
    }

    for (const row of rows) {
      const dateKey = toDateKey(new Date(row.StartTime));
      if (dailyMap.has(dateKey)) {
        dailyMap.get(dateKey).totalDurationSeconds += row.DurationSeconds;
        dailyMap.get(dateKey).sessionCount += 1;
      }
    }

    const trend = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    const todayEntry = dailyMap.get(todayKey);

    console.log(`[get-screen-sessions] ✅ Found ${rows.length} sessions across ${parsedDays} days`);

    return res.status(200).json({
      success: true,
      today: {
        date: todayKey,
        totalDurationSeconds: todayEntry?.totalDurationSeconds ?? 0,
        sessionCount: todayEntry?.sessionCount ?? 0
      },
      trend,
      sessions: rows
    });
  } catch (err) {
    console.error('[get-screen-sessions] ❌ Error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}
