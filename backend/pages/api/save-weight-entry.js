import mysql from 'mysql2/promise';

/**
 * API Endpoint: Save Weight Entry
 * POST /api/save-weight-entry
 * 
 * Saves a weight measurement with optional photo and OCR data
 */
export default async function handler(req, res) {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      message: 'Method not allowed' 
    });
  }

  try {
    const {
      userId,
      weightValue,
      weightUnit = 'kg',
      imageBase64,
      imagePath,
      ocrConfidence,
      ocrRawText,
      deviceInfo,
      notes
    } = req.body;

    // Validation
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    if (!weightValue || isNaN(weightValue)) {
      return res.status(400).json({
        success: false,
        message: 'Valid weight value is required'
      });
    }

    // Validate weight range
    const weight = parseFloat(weightValue);
    if (weightUnit === 'kg' && (weight < 20 || weight > 300)) {
      return res.status(400).json({
        success: false,
        message: 'Weight must be between 20-300 kg'
      });
    }

    if (weightUnit === 'lbs' && (weight < 44 || weight > 660)) {
      return res.status(400).json({
        success: false,
        message: 'Weight must be between 44-660 lbs'
      });
    }

    console.log('💾 Saving weight entry:', {
      userId,
      weightValue,
      weightUnit,
      ocrConfidence,
      hasImage: !!imageBase64
    });

    // Connect to database
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME
    });

    // Insert weight entry
    const [result] = await connection.execute(
      `INSERT INTO weight_entries_table 
        (UserID, WeightValue, WeightUnit, ImagePath, ImageBase64, 
         OCRConfidence, OCRRawText, DeviceInfo, Notes, CreatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        userId,
        weight,
        weightUnit,
        imagePath || null,
        imageBase64 || null,
        ocrConfidence || null,
        ocrRawText || null,
        deviceInfo || null,
        notes || null
      ]
    );

    await connection.end();

    console.log('✅ Weight entry saved successfully:', result.insertId);

    res.status(200).json({
      success: true,
      message: 'Weight entry saved successfully',
      entryId: result.insertId,
      data: {
        id: result.insertId,
        userId,
        weightValue: weight,
        weightUnit,
        createdAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Error saving weight entry:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save weight entry',
      error: error.message
    });
  }
}
