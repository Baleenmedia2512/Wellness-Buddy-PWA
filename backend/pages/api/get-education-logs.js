import { getSupabaseClient } from '../../utils/supabaseClient.js';

export default async function handler(req, res) {
  // Prevent browser/service worker caching of dynamic data
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  
  // CORS handling
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, cache-control, pragma');
    return res.status(200).end();
  }

  // Only accept GET
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // Get userId from query params
  const { userId } = req.query;

  // Validation
  if (!userId) {
    return res.status(400).json({
      success: false,
      message: 'userId is required'
    });
  }

  
  try {
    // Database connection
    const supabase = getSupabaseClient();

    // Fetch education logs (exclude soft-deleted)
    const { data: logs, error } = await supabase
      .from('education_logs_table')
      .select('"Id", "Platform", "Topic", "CreatedAt", "Confidence", "ImageBase64"')
      .eq('"UserId"', userId)
      .or('"IsDeleted".is.null,"IsDeleted".eq.0')
      .order('"CreatedAt"', { ascending: false })
      .limit(100);

    if (error) throw error;

    return res.status(200).json({
      success: true,
      count: logs?.length || 0,
      logs: logs || []
    });

  } catch (error) {

    console.error('❌ Fetch education logs error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch education logs',
      error: error.message
    });
  }
}
