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
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { userId } = req.body || {};

  if (!userId) {
    return res.status(400).json({ success: false, error: 'Missing required field: userId' });
  }

  const parsedUserId = Number.parseInt(userId, 10);
  if (Number.isNaN(parsedUserId) || parsedUserId <= 0) {
    return res.status(400).json({ success: false, error: 'Invalid userId' });
  }

  try {
    const supabase = getSupabaseClient();

    const { error, count } = await supabase
      .from('screen_sessions_table')
      .delete({ count: 'exact' })
      .eq('UserId', parsedUserId);

    if (error) throw error;

    console.log(`[delete-screen-sessions] ✅ Deleted ${count} rows for userId=${parsedUserId}`);
    return res.status(200).json({ success: true, deletedCount: count });
  } catch (err) {
    console.error('[delete-screen-sessions] ❌ Error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}
