import mysql from 'mysql2/promise';

// Configure API body parser for large image uploads
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req, res) {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
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

    // Insert weight entry into database
    const insertQuery = `
      INSERT INTO weight_records_table (
        UserId, Weight, Bmi, BodyFat, MuscleMass, Bmr, WeightImageBase64, 
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    // If ImageBase64 is empty string, store as null
    const imageBase64ToSave = (WeightImageBase64 && WeightImageBase64.trim() !== '') ? WeightImageBase64 : null;

    const [result] = await connection.execute(insertQuery, [
      userId,
      weight,
      null, // Bmi
      null, // BodyFat
      null, // MuscleMass
      null, // Bmr  
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
        imageBase64: imageBase64ToSave``,
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
