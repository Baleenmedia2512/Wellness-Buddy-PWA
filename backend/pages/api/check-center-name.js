import { getSupabaseClient } from '../../utils/supabaseClient.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

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

  const { name } = req.query;

  if (!name || name.trim().length < 2) {
    return res.status(200).json({ available: true });
  }

  try {
    const supabase = getSupabaseClient();

    const { data: existing, error } = await supabase
      .from('nutrition_centers_table')
      .select('id')
      .ilike('center_name', name.trim())
      .eq('is_deleted', false)
      .maybeSingle();

    if (error) {
      console.error('❌ [check-center-name] Error:', error);
      // On error, allow submission — backend will do final check
      return res.status(200).json({ available: true });
    }

    return res.status(200).json({ available: !existing });
  } catch (error) {
    console.error('❌ [check-center-name] Error:', error);
    return res.status(200).json({ available: true });
  }
}
