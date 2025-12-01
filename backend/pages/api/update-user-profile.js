import mysql from 'mysql2/promise';

export default async function handler(req, res) {
  // Set CORS headers for all requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { email, name, height, bmr } = req.body;

  console.log('👤 [update-user-profile] Request received:', { email, name, height, bmr });

  // Validate required field
  if (!email) {
    console.log('❌ [update-user-profile] Missing required field: email');
    return res.status(400).json({
      success: false,
      message: 'Missing required field: email',
    });
  }

  let connection;

  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
    });

    console.log('📊 [update-user-profile] Database connection established');

    // First, get the user to verify they exist and get their UserId
    const [userRows] = await connection.execute(
      `SELECT UserId FROM team_table WHERE Email = ? LIMIT 1`,
      [email]
    );

    if (userRows.length === 0) {
      console.log('❌ [update-user-profile] User not found:', email);
      await connection.end();
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const userId = userRows[0].UserId;
    console.log('✅ [update-user-profile] User found:', { userId });

    // Build dynamic UPDATE query for team_table
    const updateFields = [];
    const updateValues = [];

    if (name !== undefined && name !== null) {
      updateFields.push('UserName = ?');
      updateValues.push(name);
    }

    if (height !== undefined && height !== null) {
      updateFields.push('Height = ?');
      updateValues.push(parseFloat(height));
    }

    // Update team_table if there are fields to update
    if (updateFields.length > 0) {
      updateValues.push(email); // For WHERE clause
      const updateQuery = `UPDATE team_table SET ${updateFields.join(', ')} WHERE Email = ?`;
      
      console.log('📝 [update-user-profile] Updating team_table:', { updateFields });
      await connection.execute(updateQuery, updateValues);
      console.log('✅ [update-user-profile] team_table updated successfully');
    }

    // Update BMR in the latest weight record if provided
    let savedBmr = null;
    if (bmr !== undefined && bmr !== null) {
      const bmrValue = parseFloat(bmr);
      if (!isNaN(bmrValue) && bmrValue >= 1100 && bmrValue <= 2200) {
        // Check if user has any weight records
        const [weightRecords] = await connection.execute(
          `SELECT ID FROM weight_records_table WHERE UserId = ? ORDER BY CreatedAt DESC LIMIT 1`,
          [userId]
        );

        if (weightRecords.length > 0) {
          // Update the latest weight record with BMR
          await connection.execute(
            `UPDATE weight_records_table SET Bmr = ? WHERE ID = ?`,
            [bmrValue, weightRecords[0].ID]
          );
          console.log('✅ [update-user-profile] BMR updated in latest weight record:', bmrValue);
          savedBmr = bmrValue;
        } else {
          // No weight records exist - BMR will be saved with next weight entry
          console.log('⚠️ [update-user-profile] No weight records found, BMR will be saved with next weight entry');
          // Return the BMR value so frontend knows it was received (but not saved yet)
          savedBmr = bmrValue;
        }
      }
    }

    await connection.end();

    console.log('✅ [update-user-profile] Profile updated successfully');

    const responseData = {
      success: true,
      message: 'User profile updated successfully',
      data: {
        email,
        name: name || undefined,
        height: height ? parseFloat(height) : undefined,
        bmr: savedBmr || undefined,
      },
    };

    console.log('📦 [update-user-profile] Response:', JSON.stringify(responseData, null, 2));

    res.status(200).json(responseData);
  } catch (error) {
    console.error('❌ [update-user-profile] Database error:', error);
    
    if (connection) {
      try {
        await connection.end();
      } catch (closeError) {
        console.error('❌ [update-user-profile] Error closing connection:', closeError);
      }
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update user profile',
      error: error.message,
    });
  }
}
