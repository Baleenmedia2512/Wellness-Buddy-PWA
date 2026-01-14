import { getSupabaseClient } from '../../utils/supabaseClient.js';

/**
 * API: Get Token Correction
 * Gets the latest token correction from token_correction_table
 * Also returns the latest usage timestamp to compare
 */
export default async function handler(req, res) {
  // Prevent browser/service worker caching of dynamic data
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, cache-control, pragma');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ 
      success: false, 
      message: 'Method not allowed' 
    });
  }

  try {
    // Use Supabase client
    const supabase = getSupabaseClient();

    console.log('📖 [get-token-correction] Using Supabase REST API');

    // Get the latest correction record (most recent by CreatedAt)
    const { data: correctionRows, error: correctionError } = await supabase
      .from('token_correction_table')
      .select('"InputTokenCost", "OutputTokenCost", "TotalTokenCost", "CreatedAt"')
      .order('"CreatedAt"', { ascending: false })
      .limit(1);

    if (correctionError) throw correctionError;

    // Get the latest usage timestamp from ai_token_usage_table
    const { data: usageRows, error: usageError } = await supabase
      .from('ai_token_usage_table')
      .select('"CreatedAt"')
      .order('"CreatedAt"', { ascending: false })
      .limit(1);

    if (usageError) throw usageError;

    const latestUsageTimestamp = (usageRows && usageRows.length > 0) ? usageRows[0].CreatedAt : null;

    if (!correctionRows || correctionRows.length === 0) {
      console.log('📖 [get-token-correction] No correction record found');
      return res.status(200).json({
        success: true,
        data: null,
        latestUsageTimestamp,
        message: 'No correction record found'
      });
    }

    const correction = {
      inputCost: correctionRows[0].InputTokenCost,
      outputCost: correctionRows[0].OutputTokenCost,
      totalCost: correctionRows[0].TotalTokenCost,
      correctionTimestamp: correctionRows[0].CreatedAt
    };
    console.log('📖 [get-token-correction] Found correction:', correction);
    console.log('📖 [get-token-correction] Latest usage timestamp:', latestUsageTimestamp);

    return res.status(200).json({
      success: true,
      data: correction,
      latestUsageTimestamp
    });

  } catch (error) {
    console.error('❌ [get-token-correction] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Database error',
      error: error.code === 'ETIMEDOUT' ? 'Database connection timeout. Please try again.' : error.message
    });
  }
}
