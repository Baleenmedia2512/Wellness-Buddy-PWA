// GET /api/get-education-log-image?logId=123&userId=456
// Returns the full ImageBase64 for a single education log entry.
// Kept separate from get-education-logs to avoid bloating the list payload.
import { getSupabaseClient } from '../../utils/supabaseClient.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ message: 'Method not allowed' });
    return;
  }

  const { logId, userId } = req.query;

  if (!logId || !userId) {
    res.status(400).json({ success: false, message: 'logId and userId are required' });
    return;
  }

  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('education_logs_table')
      .select('"ImageBase64"')
      .eq('"Id"', logId)
      .eq('"UserId"', userId)
      .single();

    if (error || !data) {
      res.status(404).json({ success: false, message: 'Log not found' });
      return;
    }

    res.status(200).json({
      success: true,
      imageBase64: data.ImageBase64 || null,
    });
  } catch (err) {
    console.error('❌ get-education-log-image error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}
