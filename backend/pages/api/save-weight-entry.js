import { getPool } from '../../utils/dbPool.js';
import { cache, cacheKeys } from '../../utils/cache.js';

// Configure API body parser for large image uploads
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

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
  // Check 
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
    const pool = getPool();

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
    // Use provided BMR (manually entered)
    const bmrValue = bmr && !isNaN(parseFloat(bmr)) ? parseFloat(bmr) : null;

    const [result] = await pool.execute(insertQuery, [
      userId,
      weight,
      bmiValue,
      bodyFatValue,
      muscleMassValue,
      bmrValue,
      imageBase64ToSave,
    ]);
    
    // Get user email to clear profile cache
    const [user] = await pool.execute(
      'SELECT Email FROM team_table WHERE UserId = ?',
      [userId]
    );
    if (user.length > 0 && user[0].Email) {
      cache.delete(cacheKeys.userProfile(user[0].Email));
      console.log('🗑️ [save-weight-entry] Cache cleared for user:', user[0].Email);
    }
    
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
