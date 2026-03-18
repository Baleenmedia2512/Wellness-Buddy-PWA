import { getSupabaseClient } from '../../utils/supabaseClient.js';

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
    const { userId, days } = req.query;

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

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (safeDays - 1));
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('screen_sessions_table')
      .select('*')
      .eq('UserId', safeUserId)
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
