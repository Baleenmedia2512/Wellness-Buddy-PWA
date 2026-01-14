import { getSupabaseClient } from '../../utils/supabaseClient.js';

/**
 * API: Get Latest Token Costs
 * Fetches the most recent input and output token costs from ai_token_usage_table
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

  const { email } = req.query;

  if (!email) {
    return res.status(400).json({ 
      success: false, 
      message: 'Email is required' 
    });
  }

  try {
    // Use Supabase client
    const supabase = getSupabaseClient();

    console.log('📊 [get-latest-token-costs] Using Supabase REST API');
    console.log('📊 [get-latest-token-costs] Fetching latest token costs for:', email);

    // First, get the UserId from team_table
    const { data: userRows, error: userError } = await supabase
      .from('team_table')
      .select('"UserId"')
      .eq('"Email"', email)
      .limit(1);

    if (userError) throw userError;

    let userId = null;
    if (userRows && userRows.length > 0) {
      userId = userRows[0].UserId;
      console.log('📊 [get-latest-token-costs] Found UserId:', userId);
    }

    // Get the latest original record from ai_token_usage_table
    const { data: originalRows, error: originalError } = await supabase
      .from('ai_token_usage_table')
      .select('"InputTokenCost", "OutputTokenCost", "TotalTokenCost", "CreatedAt"')
      .eq('"Email"', email)
      .order('"CreatedAt"', { ascending: false })
      .limit(1);

    if (originalError) throw originalError;

    console.log('📊 [get-latest-token-costs] Original token usage query result:', originalRows);

    if (!originalRows || originalRows.length === 0) {
      console.log('⚠️ [get-latest-token-costs] No token usage records found');
      return res.status(404).json({
        success: false,
        message: 'No token usage records found'
      });
    }

    const latestOriginalRecord = originalRows[0];
    const latestOriginalTimestamp = new Date(latestOriginalRecord.CreatedAt);

    // Check for corrected costs in token_correction_table
    let correctedRecord = null;

    if (userId) {
      const { data: correctionRows, error: correctionError } = await supabase
        .from('token_correction_table')
        .select('"InputTokenCost", "OutputTokenCost", "TotalTokenCost", "CreatedAt"')
        .eq('"UserId"', userId)
        .order('"CreatedAt"', { ascending: false })
        .limit(1);

      if (correctionError) throw correctionError;

      if (correctionRows && correctionRows.length > 0) {
        correctedRecord = correctionRows[0];
        console.log('📊 [get-latest-token-costs] Found corrected costs:', correctedRecord);
      }
    }

    // Compare timestamps: use corrected costs ONLY if correction was made AFTER the latest original record
    if (correctedRecord) {
      const correctionTimestamp = new Date(correctedRecord.CreatedAt);
      
      console.log('📊 [get-latest-token-costs] Comparing timestamps:', {
        originalTimestamp: latestOriginalTimestamp,
        correctionTimestamp: correctionTimestamp
      });

      if (correctionTimestamp > latestOriginalTimestamp) {
        // Correction is newer than latest original - return corrected costs
        console.log('✅ [get-latest-token-costs] Returning corrected costs (correction is newer):', {
          inputCost: correctedRecord.InputTokenCost,
          outputCost: correctedRecord.OutputTokenCost,
          totalCost: correctedRecord.TotalTokenCost,
          createdAt: correctedRecord.CreatedAt
        });

        return res.status(200).json({
          success: true,
          data: {
            inputTokenCost: correctedRecord.InputTokenCost,
            outputTokenCost: correctedRecord.OutputTokenCost,
            totalTokenCost: correctedRecord.TotalTokenCost,
            createdAt: correctedRecord.CreatedAt,
            isCorrected: true
          }
        });
      } else {
        console.log('📊 [get-latest-token-costs] Original record is newer than correction - returning original costs');
      }
    }

    // Return original costs (either no correction exists or original is newer)
    console.log('✅ [get-latest-token-costs] Returning original costs:', {
      inputCost: latestOriginalRecord.InputTokenCost,
      outputCost: latestOriginalRecord.OutputTokenCost,
      totalCost: latestOriginalRecord.TotalTokenCost,
      createdAt: latestOriginalRecord.CreatedAt
    });

    return res.status(200).json({
      success: true,
      data: {
        inputTokenCost: latestOriginalRecord.InputTokenCost,
        outputTokenCost: latestOriginalRecord.OutputTokenCost,
        totalTokenCost: latestOriginalRecord.TotalTokenCost,
        createdAt: latestOriginalRecord.CreatedAt,
        isCorrected: false
      }
    });

  } catch (error) {
    console.error('❌ [get-latest-token-costs] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch latest token costs',
      error: error.code === 'ETIMEDOUT' ? 'Database connection timeout. Please try again.' : error.message
    });
  }
}
