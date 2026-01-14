import { getSupabaseClient } from '../../utils/supabaseClient.js';

export default async function handler(req, res) {
  // Prevent browser/service worker caching of dynamic data
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, cache-control, pragma');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId } = req.query;

    // Validate input
    if (!userId) {
      return res.status(400).json({ 
        error: 'Missing required parameter: userId'
      });
    }

    const supabase = getSupabaseClient();

    // Fetch user's corrections ordered by frequency
    const { data: corrections, error } = await supabase
      .from('food_corrections_table')
      .select('"Id", "AiDetected", "UserCorrected", "TimesCorrected", "CreatedAt", "LastCorrected"')
      .eq('"UserId"', userId)
      .order('"TimesCorrected"', { ascending: false })
      .order('"LastCorrected"', { ascending: false });

    if (error) throw error;

    // Transform to match expected format
    const transformedCorrections = (corrections || []).map(c => ({
      id: c.Id,
      ai_detected: c.AiDetected,
      user_corrected: c.UserCorrected,
      times_corrected: c.TimesCorrected,
      created_at: c.CreatedAt,
      last_corrected: c.LastCorrected
    }));

    return res.status(200).json({
      success: true,
      data: transformedCorrections,
      count: transformedCorrections.length
    });
  } catch (error) {
    console.error('Error fetching food corrections:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch corrections',
      details: error.message 
    });
  }
}
