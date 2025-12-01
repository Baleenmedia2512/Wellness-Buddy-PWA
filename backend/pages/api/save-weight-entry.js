import mysql from 'mysql2/promise';

// Configure API body parser for large image uploads
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

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

  // Check if request body is too large or malformed
  if (!req.body) {
    return res.status(400).json({ 
      message: 'Request body is missing or too large. Maximum size is 10MB.' 
    });
  }

  const { 
    userId, 
    weightValue,
    unit = 'kg', // Default to kg if not provided
    bmi,
    bodyFat,
    muscleMass,
    bmr,
    imageBase64ToSave: WeightImageBase64,
  } = req.body;

  // Validate required fields
  if (!userId || !weightValue) {
    return res.status(400).json({ 
      message: 'Missing required fields: userId, weightValue' 
    });
  }

  // Validate weight value
  const weight = parseFloat(weightValue);
  if (isNaN(weight) || weight <= 0 || weight > 500) {
    return res.status(400).json({ 
      message: 'Invalid weight value. Must be between 0 and 500.' 
    });
  }

  // Validate unit
  if (unit !== 'kg' && unit !== 'lbs') {
    return res.status(400).json({ 
      message: 'Invalid unit. Must be "kg" or "lbs".' 
    });
  }

  try {
    // Database connection
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME
    });

    // Fetch user profile to calculate BMR
    const [userRows] = await connection.execute(
      `SELECT Height, Age, Gender FROM team_table WHERE UserId = ? LIMIT 1`,
      [userId]
    );

    let calculatedBmr = null;
    if (userRows.length > 0) {
      const userProfile = userRows[0];
      calculatedBmr = calculateBMR(
        weight,
        userProfile.Height,
        userProfile.Age,
        userProfile.Gender
      );
      console.log('📊 [save-weight-entry] BMR calculated:', { 
        weight, 
        height: userProfile.Height, 
        age: userProfile.Age, 
        gender: userProfile.Gender, 
        bmr: calculatedBmr 
      });
    } else {
      console.log('⚠️ [save-weight-entry] User profile not found, BMR not calculated');
    }

    // Insert weight entry into database
    const insertQuery = `
      INSERT INTO weight_records_table (
        UserId, Weight, Bmi, BodyFat, MuscleMass, Bmr, WeightImageBase64
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    // If ImageBase64 is empty string, store as null
    const imageBase64ToSave = (WeightImageBase64 && WeightImageBase64.trim() !== '') ? WeightImageBase64 : null;

    // Parse optional metrics and convert to null if not provided or invalid
    const bmiValue = bmi && !isNaN(parseFloat(bmi)) ? parseFloat(bmi) : null;
    const bodyFatValue = bodyFat && !isNaN(parseFloat(bodyFat)) ? parseFloat(bodyFat) : null;
    const muscleMassValue = muscleMass && !isNaN(parseFloat(muscleMass)) ? parseFloat(muscleMass) : null;
    // Use calculated BMR if available, otherwise use provided BMR
    const bmrValue = calculatedBmr || (bmr && !isNaN(parseFloat(bmr)) ? parseFloat(bmr) : null);

    const [result] = await connection.execute(insertQuery, [
      userId,
      weight,
      bmiValue,
      bodyFatValue,
      muscleMassValue,
      bmrValue,
      imageBase64ToSave,
    ]);

    await connection.end();

    res.status(200).json({
      success: true,
      id: result.insertId,
      message: 'Weight entry saved successfully',
      data: {
        userId,
        weightValue: weight,
        unit,
        bmr: bmrValue,
        imageBase64: imageBase64ToSave,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Database save error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save weight entry',
      error: error.message
    });
  }
}
