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
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ 
      success: false, 
      message: 'Method not allowed' 
    });
    return;
  }

  try {
    const { email, timeRange, startDate, endDate } = req.query;

    if (!email) {
      res.status(400).json({
        success: false,
        message: 'Email parameter is required'
      });
      return;
    }

    // Use Supabase client
    const supabase = getSupabaseClient();

    console.log('📖 [get-token-correction] Using Supabase REST API');
    console.log('📖 [get-token-correction] Fetching correction for email:', email);

    // First, get UserId from team_table
    const { data: userRows, error: userError } = await supabase
      .from('team_table')
      .select('"UserId"')
      .eq('"Email"', email)
      .limit(1);

    if (userError) {
      console.error('❌ [get-token-correction] Error fetching user:', userError);
      throw userError;
    }

    if (!userRows || userRows.length === 0) {
      console.log('📖 [get-token-correction] User not found with email:', email);
      res.status(200).json({
        success: true,
        data: null,
        latestUsageTimestamp: null,
        message: 'User not found'
      });
      return;
    }

    const userId = userRows[0].UserId;
    console.log('📖 [get-token-correction] Found UserId:', userId);
    console.log('📖 [get-token-correction] Looking for time range:', timeRange || 'all');

    // Get the correction record for this user and time range
    let query = supabase
      .from('token_correction_table')
      .select('"InputTokenCost", "OutputTokenCost", "TotalTokenCost", "CreatedAt", "TimeRange", "StartDate", "EndDate"')
      .eq('"UserId"', userId);

    // Filter by time range if provided
    if (timeRange) {
      query = query.eq('"TimeRange"', timeRange);
    }

    const { data: correctionRows, error: correctionError } = await query
      .order('"CreatedAt"', { ascending: false })
      .limit(1);

    if (correctionError) {
      console.error('❌ [get-token-correction] Error fetching correction:', correctionError);
      throw correctionError;
    }

    // Get the latest usage timestamp from ai_token_usage_table for this user
    const { data: usageRows, error: usageError } = await supabase
      .from('ai_token_usage_table')
      .select('"CreatedAt"')
      .eq('"Email"', email)
      .order('"CreatedAt"', { ascending: false })
      .limit(1);

    if (usageError) {
      console.error('❌ [get-token-correction] Error fetching usage:', usageError);
      throw usageError;
    }

    const latestUsageTimestamp = (usageRows && usageRows.length > 0) ? usageRows[0].CreatedAt : null;

    if (!correctionRows || correctionRows.length === 0) {
      console.log('📖 [get-token-correction] No correction record found');
      res.status(200).json({
        success: true,
        data: null,
        latestUsageTimestamp,
        message: 'No correction record found'
      });
      return;
    }

    const correction = {
      inputCost: correctionRows[0].InputTokenCost,
      outputCost: correctionRows[0].OutputTokenCost,
      totalCost: correctionRows[0].TotalTokenCost,
      correctionTimestamp: correctionRows[0].CreatedAt
    };
    console.log('📖 [get-token-correction] Found correction:', correction);
    console.log('📖 [get-token-correction] Latest usage timestamp:', latestUsageTimestamp);

    res.status(200).json({
      success: true,
      data: correction,
      latestUsageTimestamp
    });
    return;

  } catch (error) {
    console.error('❌ [get-token-correction] Error:', error);
    console.error('❌ [get-token-correction] Error details:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      message: 'Database error',
      error: error.code === 'ETIMEDOUT' ? 'Database connection timeout. Please try again.' : error.message
    });
    return;
  }
}