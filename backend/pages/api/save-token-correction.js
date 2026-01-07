import { getPool } from '../../utils/dbPool.js';

/**
 * API: Save Token Correction
 * Saves original and corrected token costs to token_correction_table
 */
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

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
    // Use connection pool
    const pool = getPool();

    console.log('💾 [save-token-correction] Using connection pool');
    console.log('💾 [save-token-correction] Saving token correction for:', email);
    console.log('💾 [save-token-correction] Request data:', {
      originalInputCost,
      originalOutputCost,
      correctedInputCost,
      correctedOutputCost
    });

    // Get UserId from team_table
    const [userRows] = await pool.execute(
      'SELECT UserId FROM team_table WHERE Email = ? LIMIT 1',
      [email]
    );

    console.log('💾 [save-token-correction] User lookup result:', userRows);

    if (userRows.length === 0) {
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
    await pool.execute(
      `INSERT INTO token_correction_table 
       (UserId, InputTokenCost, OutputTokenCost, TotalTokenCost)
       VALUES (?, ?, ?, ?)`,
      [
        userId,
        correctedInputCost,
        correctedOutputCost,
        totalCost
      ]
    );

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
