import mysql from 'mysql2/promise';

/**
 * Calculate BMR using Mifflin-St Jeor formula
 * Men: BMR = (10 × weight in kg) + (6.25 × height in cm) - (5 × age in years) + 5
 * Women: BMR = (10 × weight in kg) + (6.25 × height in cm) - (5 × age in years) - 161
 */
function calculateBMR(weight, height, age, gender) {
  if (!weight || !height || !age || !gender) {
    return null;
  }

  const weightNum = parseFloat(weight);
  const heightNum = parseFloat(height);
  const ageNum = parseInt(age, 10);

  if (isNaN(weightNum) || isNaN(heightNum) || isNaN(ageNum)) {
    return null;
  }

  // Base calculation: (10 × weight) + (6.25 × height) - (5 × age)
  const baseBMR = (10 * weightNum) + (6.25 * heightNum) - (5 * ageNum);

  // Apply gender-specific adjustment
  const genderLower = gender.toLowerCase();
  if (genderLower === 'male' || genderLower === 'm') {
    return Math.round(baseBMR + 5);
  } else if (genderLower === 'female' || genderLower === 'f') {
    return Math.round(baseBMR - 161);
  }

  // Default to male formula if gender is unknown
  return Math.round(baseBMR + 5);
}

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

  const { email, name, height, age, gender } = req.body;

  console.log('👤 [update-user-profile] Request received:', { email, name, height, age, gender });

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

    if (age !== undefined && age !== null) {
      updateFields.push('Age = ?');
      updateValues.push(parseInt(age, 10));
    }

    if (gender !== undefined && gender !== null) {
      updateFields.push('Gender = ?');
      updateValues.push(gender);
    }

    // Update team_table if there are fields to update
    if (updateFields.length > 0) {
      updateValues.push(email); // For WHERE clause
      const updateQuery = `UPDATE team_table SET ${updateFields.join(', ')} WHERE Email = ?`;
      
      console.log('📝 [update-user-profile] Updating team_table:', { updateFields });
      await connection.execute(updateQuery, updateValues);
      console.log('✅ [update-user-profile] team_table updated successfully');
    }

    // Get the latest weight record to calculate and update BMR
    const [weightRows] = await connection.execute(
      `SELECT Id, Weight FROM weight_records_table 
       WHERE UserId = ? AND (IsDeleted IS NULL OR IsDeleted = 0)
       ORDER BY CreatedAt DESC 
       LIMIT 1`,
      [userId]
    );

    let newBmr = null;
    let bmrUpdated = false;

    if (weightRows.length > 0) {
      const latestWeight = weightRows[0].Weight;
      const weightRecordId = weightRows[0].Id;

      // Get the updated user profile to calculate BMR
      const [updatedUserRows] = await connection.execute(
        `SELECT Height, Age, Gender FROM team_table WHERE UserId = ? LIMIT 1`,
        [userId]
      );

      if (updatedUserRows.length > 0) {
        const updatedUser = updatedUserRows[0];
        newBmr = calculateBMR(
          latestWeight,
          updatedUser.Height,
          updatedUser.Age,
          updatedUser.Gender
        );

        if (newBmr !== null) {
          // Update BMR in the latest weight record
          await connection.execute(
            `UPDATE weight_records_table SET Bmr = ? WHERE Id = ?`,
            [newBmr, weightRecordId]
          );
          bmrUpdated = true;
          console.log('✅ [update-user-profile] BMR updated:', { weightRecordId, newBmr });
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
        age: age ? parseInt(age, 10) : undefined,
        gender: gender || undefined,
        bmr: newBmr,
        bmrUpdated,
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
