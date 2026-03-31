import { getSupabaseClient, getISTTimestamp } from '../../utils/supabaseClient.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cache-Control, Pragma');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, message: 'Method not allowed' });
    return;
  }

  try {
    const { userId, date, totalScreenTimeSeconds } = req.body || {};

    if (!userId || totalScreenTimeSeconds === undefined || totalScreenTimeSeconds === null) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: userId, totalScreenTimeSeconds'
      });
      return;
    }

    const safeUserId = Number.parseInt(userId, 10);
    const safeSeconds = Math.max(0, Number.parseInt(totalScreenTimeSeconds, 10) || 0);
    // Use client-provided date (device local timezone). Fall back to IST if missing.
    const istDate = new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().split('T')[0];
    const safeDate = (date && /^\d{4}-\d{2}-\d{2}$/.test(String(date)))
      ? String(date)
      : istDate;

    if (isNaN(safeUserId) || safeUserId <= 0) {
      res.status(400).json({ success: false, message: 'Invalid userId' });
      return;
    }

    const supabase = getSupabaseClient();
    const now = getISTTimestamp();

    // Atomic upsert on (UserId, Date) — prevents duplicate rows from concurrent calls
    const { data: upserted, error: upsertError } = await supabase
      .from('screen_sessions_table')
      .upsert(
        {
          UserId: safeUserId,
          Date: safeDate,
          TotalScreenTimeSeconds: safeSeconds,
          CreatedAt: now
        },
        { onConflict: 'UserId,Date', ignoreDuplicates: false }
      )
      .select('*')
      .single();

    if (upsertError) throw upsertError;
    const savedRow = upserted;

    res.status(200).json({
      success: true,
      message: 'Screen time saved successfully',
      data: savedRow
    });
  } catch (error) {
    console.error('[save-screen-time] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save screen time',
      error: error.message
    });
  }
}
