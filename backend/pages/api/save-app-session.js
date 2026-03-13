import { getSupabaseClient, getISTTimestamp } from '../../utils/supabaseClient.js';

function toDateKey(iso) {
  // Extract YYYY-MM-DD from any ISO timestamp
  return iso ? iso.slice(0, 10) : new Date().toISOString().slice(0, 10);
}

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
    const { userId, startTime, endTime, durationSeconds } = req.body || {};

    if (!userId || !startTime || !endTime || durationSeconds === undefined) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: userId, startTime, endTime, durationSeconds'
      });
      return;
    }

    const safeDuration = Math.max(0, Math.round(Number(durationSeconds)));

    // Guard: ignore sessions shorter than 2 seconds (accidental taps / flicker)
    if (safeDuration < 2) {
      res.status(200).json({ success: true, skipped: true, reason: 'duration_too_short' });
      return;
    }

    const supabase = getSupabaseClient();
    const now = getISTTimestamp();
    const activityDate = toDateKey(startTime);
    const dayStart = `${activityDate}T00:00:00`;
    const dayEnd = `${activityDate}T23:59:59`;

    // Look up existing row for this user on this date
    console.log(`[save-app-session] 🔍 Looking up existing row for userId=${userId} date=${activityDate}`);
    const { data: existing, error: lookupError } = await supabase
      .from('screen_sessions_table')
      .select('Id, DurationSeconds')
      .eq('UserId', userId)
      .gte('CreatedAt', dayStart)
      .lte('CreatedAt', dayEnd)
      .limit(1)
      .maybeSingle();

    if (lookupError) throw lookupError;

    let data, error;

    if (existing) {
      // Accumulate: add new duration to existing total
      const newTotal = existing.DurationSeconds + safeDuration;
      console.log(`[save-app-session] ♻️ Updating Id=${existing.Id}: ${existing.DurationSeconds}s + ${safeDuration}s = ${newTotal}s`);
      ({ data, error } = await supabase
        .from('screen_sessions_table')
        .update({ DurationSeconds: newTotal, EndTime: endTime })
        .eq('Id', existing.Id)
        .select('Id, DurationSeconds')
        .single());
    } else {
      // First session of the day — insert new row
      console.log(`[save-app-session] ➕ Inserting new daily row for userId=${userId} duration=${safeDuration}s`);
      ({ data, error } = await supabase
        .from('screen_sessions_table')
        .insert({
          UserId: userId,
          StartTime: startTime,
          EndTime: endTime,
          DurationSeconds: safeDuration,
          CreatedAt: now
        })
        .select('Id, DurationSeconds')
        .single());
    }

    if (error) throw error;

    console.log(`[save-app-session] ✅ userId=${userId} daily total=${data.DurationSeconds}s`);
    res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('[save-app-session] ❌ Error:', err.message);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
}
