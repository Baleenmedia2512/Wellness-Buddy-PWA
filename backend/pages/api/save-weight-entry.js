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
 * API Handler: Save Weight Entry
 * 
 * DUPLICATE PREVENTION:
 * - Checks for duplicate entries within a 5-second window
 * - Compares weight values (within 0.5 kg/lbs difference)
 * - Compares image base64 prefix (first 1000 chars) if images present
 * - Returns success with isDuplicate flag if duplicate detected
 * - Prevents same weight measurement from being saved multiple times
 */
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

    // 🔒 DUPLICATE PREVENTION: Check if same weight was recently saved (within 5 seconds)
    const [recentEntries] = await connection.execute(
      `SELECT ID, CreatedAt, WeightImageBase64, Weight 
       FROM weight_records_table 
       WHERE UserId = ? 
       AND CreatedAt >= DATE_SUB(NOW(), INTERVAL 5 SECOND)
       AND IsDeleted = 0
       ORDER BY CreatedAt DESC
       LIMIT 5`,
      [userId]
    );

    // If there are recent entries, check if this is a duplicate
    if (recentEntries.length > 0) {
      for (const entry of recentEntries) {
        // Check if weight values are very close (within 0.5 kg/lbs)
        const weightDiff = Math.abs(parseFloat(entry.Weight) - weight);
        
        // If weight is nearly identical within 5 seconds, likely a duplicate
        if (weightDiff < 0.5) {
          // Also check image similarity if both have images
          if (entry.WeightImageBase64 && imageBase64ToSave) {
            const existingImagePrefix = entry.WeightImageBase64.substring(0, 1000);
            const newImagePrefix = imageBase64ToSave.substring(0, 1000);
            
            if (existingImagePrefix === newImagePrefix) {
              console.log('⚠️ Duplicate weight entry detected (same weight and image within 5 seconds), skipping save');
              await connection.end();
              return res.status(200).json({
                success: true,
                id: entry.ID,
                isDuplicate: true,
                message: 'This weight entry was already saved recently',
                data: {
                  userId,
                  weightValue: weight,
                  unit,
                  timestamp: new Date().toISOString()
                }
              });
            }
          } else if (!entry.WeightImageBase64 && !imageBase64ToSave) {
            // Both have no images, just weight values are close - likely duplicate
            console.log('⚠️ Duplicate weight entry detected (same weight within 5 seconds), skipping save');
            await connection.end();
            return res.status(200).json({
              success: true,
              id: entry.ID,
              isDuplicate: true,
              message: 'This weight entry was already saved recently',
              data: {
                userId,
                weightValue: weight,
                unit,
                timestamp: new Date().toISOString()
              }
            });
          }
        }
      }
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
    const bmrValue = bmr && !isNaN(parseFloat(bmr)) ? parseFloat(bmr) : null;

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
