import { getSupabaseClient, getISTTimestamp } from '../../utils/supabaseClient.js';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { userId, aiDetected, userCorrected } = req.body;

    // Validate input
    if (!userId || !aiDetected || !userCorrected) {
      res.status(400).json({ 
        error: 'Missing required fields',
        required: ['userId', 'aiDetected', 'userCorrected']
      });
      return;
    }

    // Database connection
    const supabase = getSupabaseClient();

    // Check if the same correction already exists for this user
    const { data: existingCorrections, error: selectError } = await supabase
      .from('food_corrections_table')
      .select('"Id", "TimesCorrected"')
      .eq('"UserId"', userId)
      .eq('"AiDetected"', aiDetected)
      .eq('"UserCorrected"', userCorrected);

    if (selectError) throw selectError;

    if (existingCorrections && existingCorrections.length > 0) {
      // Update existing correction (increment times_corrected)
      const correctionId = existingCorrections[0].Id;
      const newCount = existingCorrections[0].TimesCorrected + 1;
      const currentTime = getISTTimestamp();

      const { error: updateError } = await supabase
        .from('food_corrections_table')
        .update({ 
          "TimesCorrected": newCount,
          "LastCorrected": currentTime
        })
        .eq('"Id"', correctionId);

      if (updateError) throw updateError;
res.status(200).json({
        success: true,
        message: 'Correction updated',
        data: {
          id: correctionId,
          times_corrected: newCount,
          action: 'updated'
        }
      });
      return;
    } else {
      // Insert new correction
      const currentTime = getISTTimestamp();
      const { data: insertedData, error: insertError } = await supabase
        .from('food_corrections_table')
        .insert({
          "UserId": userId,
          "AiDetected": aiDetected,
          "UserCorrected": userCorrected,
          "TimesCorrected": 1,
          "CreatedAt": currentTime,
          "UpdatedAt": currentTime
        })
        .select()
        .single();

      if (insertError) throw insertError;

      const result = { insertId: insertedData?.Id };
res.status(201).json({
        success: true,
        message: 'Correction saved',
        data: {
          id: result.insertId,
          times_corrected: 1,
          action: 'created'
        }
      });
      return;
    }
  } catch (error) {
    console.error('Error saving food correction:', error);
    res.status(500).json({ 
      error: 'Failed to save correction',
      details: error.message 
    });
    return;
  }
}
