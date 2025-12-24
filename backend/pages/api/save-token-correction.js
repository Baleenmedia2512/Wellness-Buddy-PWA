import mysql from 'mysql2/promise';

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

  let connection;

  try {
    // Create database connection
    connection = await mysql.createConnection({
      host: process.env.MYSQL_HOST,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
    });

    console.log('💾 [save-token-correction] Saving token correction for:', email);

    // Get UserId from team_table
    const [userRows] = await connection.execute(
      'SELECT UserId FROM team_table WHERE Email = ? LIMIT 1',
      [email]
    );

    if (userRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const userId = userRows[0].UserId;

    // Calculate totals
    const originalTotal = (parseFloat(originalInputCost) || 0) + (parseFloat(originalOutputCost) || 0);
    const correctedTotal = parseFloat(correctedInputCost) + parseFloat(correctedOutputCost);

    // Check if a record exists for this user
    const [existingRows] = await connection.execute(
      'SELECT ID, TimesCorrected FROM token_correction_table WHERE UserId = ? ORDER BY CreatedAt DESC LIMIT 1',
      [userId]
    );

    if (existingRows.length > 0) {
      // Update existing record
      const timesCorrected = (existingRows[0].TimesCorrected || 0) + 1;
      
      await connection.execute(
        `UPDATE token_correction_table 
         SET InputCost = ?,
             OutputCost = ?,
             TotalCost = ?,
             CorrectedInputCost = ?,
             CorrectedOutputCost = ?,
             CorrectedTotalCost = ?,
             TimesCorrected = ?,
             LastCorrected = NOW()
         WHERE ID = ?`,
        [
          originalInputCost || 0,
          originalOutputCost || 0,
          originalTotal,
          correctedInputCost,
          correctedOutputCost,
          correctedTotal,
          timesCorrected,
          existingRows[0].ID
        ]
      );

      console.log('✅ [save-token-correction] Updated existing record:', {
        userId,
        timesCorrected,
        correctedTotal
      });
    } else {
      // Insert new record
      await connection.execute(
        `INSERT INTO token_correction_table 
         (UserId, InputCost, OutputCost, TotalCost, CorrectedInputCost, CorrectedOutputCost, CorrectedTotalCost, TimesCorrected)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          userId,
          originalInputCost || 0,
          originalOutputCost || 0,
          originalTotal,
          correctedInputCost,
          correctedOutputCost,
          correctedTotal
        ]
      );

      console.log('✅ [save-token-correction] Inserted new record:', {
        userId,
        correctedTotal
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Token correction saved successfully',
      data: {
        userId,
        originalInputCost: originalInputCost || 0,
        originalOutputCost: originalOutputCost || 0,
        originalTotalCost: originalTotal,
        correctedInputCost,
        correctedOutputCost,
        correctedTotalCost: correctedTotal
      }
    });

  } catch (error) {
    console.error('❌ [save-token-correction] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to save token correction',
      error: error.message
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}
