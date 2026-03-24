import { getSupabaseClient } from '../../utils/supabaseClient.js';

// Returns today's date as YYYY-MM-DD in IST (UTC+5:30)
function toISTDateString() {
  const istOffset = 5.5 * 60 * 60 * 1000;
  return new Date(Date.now() + istOffset).toISOString().split('T')[0];
}

// Shift a YYYY-MM-DD string by deltaDays
function shiftDateStr(dateStr, deltaDays) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + deltaDays);
  const yr = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const dy = String(date.getDate()).padStart(2, '0');
  return `${yr}-${mo}-${dy}`;
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
    const { userId, days, targetDate: rawTargetDate } = req.query;

    if (!userId) {
      res.status(400).json({ success: false, message: 'Missing required field: userId' });
      return;
    }

    const safeUserId = Number.parseInt(userId, 10);
    const safeDays = Math.min(Math.max(1, Number.parseInt(days, 10) || 7), 90);

    if (isNaN(safeUserId) || safeUserId <= 0) {
      res.status(400).json({ success: false, message: 'Invalid userId' });
      return;
    }

    // Use targetDate from client (device local date) to avoid IST/UTC mismatch
    const endDateStr = (rawTargetDate && /^\d{4}-\d{2}-\d{2}$/.test(rawTargetDate))
      ? rawTargetDate
      : toISTDateString();
    const startDateStr = shiftDateStr(endDateStr, -(safeDays - 1));

    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('screen_sessions_table')
      .select('*')
      .eq('UserId', safeUserId)
      .not('Date', 'is', null)
      .gte('Date', startDateStr)
      .lte('Date', endDateStr)
      .order('Date', { ascending: false });

    if (error) throw error;

    // Calculate summary stats
    const records = data || [];
    const totalSeconds = records.reduce((sum, r) => sum + (r.TotalScreenTimeSeconds || 0), 0);
    const avgSeconds = records.length > 0 ? Math.round(totalSeconds / records.length) : 0;

    res.status(200).json({
      success: true,
      data: records,
      summary: {
        totalDays: records.length,
        totalSeconds,
        averageSeconds: avgSeconds,
        requestedDays: safeDays
      }
    });
  } catch (error) {
    console.error('[get-screen-time] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch screen time',
      error: error.message
    });
  }
}
