import { getPool } from '../../utils/dbPool.js';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, aiDetected, userCorrected } = req.body;

    // Validate input
    if (!userId || !aiDetected || !userCorrected) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['userId', 'aiDetected', 'userCorrected']
      });
    }

    // Database connection
    const pool = getPool();

    // Check if the same correction already exists for this user
    const [existingCorrections] = await pool.execute(
      `SELECT Id, TimesCorrected FROM food_corrections_table 
       WHERE UserId = ? AND AiDetected = ? AND UserCorrected = ?`,
      [userId, aiDetected, userCorrected]
    );

    if (existingCorrections.length > 0) {
      // Update existing correction (increment times_corrected)
      const correctionId = existingCorrections[0].Id;
      const newCount = existingCorrections[0].TimesCorrected + 1;

      await pool.execute(
        `UPDATE food_corrections_table 
         SET TimesCorrected = ?, LastCorrected = CURRENT_TIMESTAMP 
         WHERE Id = ?`,
        [newCount, correctionId]
      );
return res.status(200).json({
        success: true,
        message: 'Correction updated',
        data: {
          id: correctionId,
          times_corrected: newCount,
          action: 'updated'
        }
      });
    } else {
      // Insert new correction
      const [result] = await pool.execute(
        `INSERT INTO food_corrections_table (UserId, AiDetected, UserCorrected, TimesCorrected) 
         VALUES (?, ?, ?, 1)`,
        [userId, aiDetected, userCorrected]
      );
return res.status(201).json({
        success: true,
        message: 'Correction saved',
        data: {
          id: result.insertId,
          times_corrected: 1,
          action: 'created'
        }
      });
    }
  } catch (error) {
    console.error('Error saving food correction:', error);
    return res.status(500).json({ 
      error: 'Failed to save correction',
      details: error.message 
    });
  }
}
