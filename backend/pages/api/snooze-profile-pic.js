import { getSupabaseClient } from '../../utils/supabaseClient.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method not allowed' });
    return;
  }

  const { userId } = req.body;

  if (!userId) {
    res.status(400).json({ success: false, message: 'Missing required field: userId' });
    return;
  }

  try {
    const supabase = getSupabaseClient();

    // Fetch existing snooze data to preserve max and increment count
    const { data: row, error: fetchError } = await supabase
      .from('team_table')
      .select('profile_pic_snooze')
      .eq('UserId', userId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!row) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    const existing = row.profile_pic_snooze || {};
    const currentCount = existing.count ?? 0;
    const currentMax = existing.max ?? 5;

    const newSnooze = {
      until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      count: currentCount + 1,
      max: currentMax,
    };

    const { error: updateError } = await supabase
      .from('team_table')
      .update({ profile_pic_snooze: newSnooze })
      .eq('UserId', userId);

    if (updateError) throw updateError;

    console.log(`✅ [snooze-profile-pic] Snoozed for UserId ${userId}, count=${newSnooze.count}, until=${newSnooze.until}`);

    res.status(200).json({ success: true, snooze: newSnooze });
  } catch (error) {
    console.error('❌ [snooze-profile-pic] Error:', error);
    res.status(500).json({ success: false, message: 'Failed to save snooze', error: error.message });
  }
}
