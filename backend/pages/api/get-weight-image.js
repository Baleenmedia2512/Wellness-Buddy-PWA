import { getSupabaseClient } from '../../utils/supabaseClient.js';

/**
 * Returns only the WeightImageBase64 for a single weight record.
 * Designed to be called lazily per card so the list endpoint can stay tiny.
 */
export default async function handler(req, res) {
  // Allow long browser caching since image bytes for a record never change
  res.setHeader('Cache-Control', 'private, max-age=3600');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ message: 'Method not allowed' });
    return;
  }

  const { userId, id } = req.query;

  if (!userId || !id) {
    res.status(400).json({ message: 'Missing required fields: userId, id' });
    return;
  }

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('weight_records_table')
      .select('ID, WeightImageBase64')
      .eq('UserId', userId)
      .eq('ID', id)
      .or('IsDeleted.is.null,IsDeleted.eq.0')
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      res.status(404).json({ success: false, message: 'Not found' });
      return;
    }

    res.status(200).json({
      success: true,
      id: data.ID,
      image: data.WeightImageBase64 || null,
    });
  } catch (err) {
    console.error('❌ get-weight-image error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve weight image',
      error: err.message,
    });
  }
}
