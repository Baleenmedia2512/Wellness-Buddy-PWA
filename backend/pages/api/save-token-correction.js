import { getSupabaseClient } from '../../utils/supabaseClient.js';

/**
 * API: Save Token Correction
 * Saves original and corrected token costs to token_correction_table
 */
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, cache-control, pragma');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      message: 'Method not allowed' 
    });
  }

  const { 
    email,
    originalInputCost,
    originalOutputCost,
    correctedInputCost,
    correctedOutputCost
  } = req.body;

  if (!email || correctedInputCost === undefined || correctedOutputCost === undefined) {
    return res.status(400).json({ 
      success: false, 
      message: 'Missing required fields: email, correctedInputCost, correctedOutputCost' 
    });
  }

  try {
    // Use Supabase client
    const supabase = getSupabaseClient();

    console.log('💾 [save-token-correction] Using Supabase REST API');
    console.log('💾 [save-token-correction] Saving token correction for:', email);
    console.log('💾 [save-token-correction] Request data:', {
      originalInputCost,
      originalOutputCost,
      correctedInputCost,
      correctedOutputCost
    });

    // Get UserId from team_table
    const { data: userRows, error: userError } = await supabase
      .from('team_table')
      .select('"UserId"')
      .eq('"Email"', email)
      .limit(1);

    if (userError) throw userError;

    console.log('💾 [save-token-correction] User lookup result:', userRows);

    if (!userRows || userRows.length === 0) {
      console.log('❌ [save-token-correction] User not found in team_table');
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const userId = userRows[0].UserId;
    console.log('💾 [save-token-correction] Found UserId:', userId);

    // Calculate total cost
    const totalCost = parseFloat(correctedInputCost) + parseFloat(correctedOutputCost);

    console.log('💾 [save-token-correction] Calculated values:', {
      userId,
      inputTokenCost: correctedInputCost,
      outputTokenCost: correctedOutputCost,
      totalTokenCost: totalCost
    });

    // Always insert a new record (no update - track all changes)
    const { error: insertError } = await supabase
      .from('token_correction_table')
      .insert({
        "UserId": userId,
        "InputTokenCost": correctedInputCost,
        "OutputTokenCost": correctedOutputCost,
        "TotalTokenCost": totalCost
      });

    if (insertError) throw insertError;

    console.log('✅ [save-token-correction] Inserted new record:', {
      userId,
      totalCost
    });

    return res.status(200).json({
      success: true,
      message: 'Token correction saved successfully',
      data: {
        userId,
        inputTokenCost: correctedInputCost,
        outputTokenCost: correctedOutputCost,
        totalTokenCost: totalCost
      }
    });

  } catch (error) {
    console.error('❌ [save-token-correction] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to save token correction',
      error: error.code === 'ETIMEDOUT' ? 'Database connection timeout. Please try again.' : error.message
    });
  }
}
