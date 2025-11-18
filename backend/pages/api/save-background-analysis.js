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
 * API Handler: Save Nutrition Analysis
 * 
 * DUPLICATE PREVENTION:
 * - Checks for duplicate entries within a 5-second window
 * - Compares image base64 prefix (first 1000 chars) for exact matches
 * - Returns success with isDuplicate flag if duplicate detected
 * - Prevents same image from being saved multiple times simultaneously
 */
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

  const { userId, imagePath, analysisResult, timestamp, deviceInfo, ImageBase64 } = req.body;

  if (!userId || !imagePath || !analysisResult) {
    return res.status(400).json({ 
      message: 'Missing required fields: userId, imagePath, analysisResult' 
    });
  }

  try {
    // 🔒 DUPLICATE PREVENTION: Check if same image was recently saved (within 5 seconds)
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME
    });

    // Check for duplicate based on userId and recent timestamp (within 5 seconds)
    const [recentEntries] = await connection.execute(
      `SELECT ID, CreatedAt, ImageBase64, TotalCalories 
       FROM food_nutrition_data_table 
       WHERE UserID = ? 
       AND CreatedAt >= DATE_SUB(NOW(), INTERVAL 5 SECOND)
       AND IsDeleted = 0
       ORDER BY CreatedAt DESC
       LIMIT 5`,
      [userId]
    );

    // If there are recent entries, check if this is a duplicate
    if (recentEntries.length > 0 && ImageBase64) {
      for (const entry of recentEntries) {
        // Simple duplicate check: compare image base64 (first 1000 chars for performance)
        if (entry.ImageBase64) {
          const existingImagePrefix = entry.ImageBase64.substring(0, 1000);
          const newImagePrefix = ImageBase64.substring(0, 1000);
          
          if (existingImagePrefix === newImagePrefix) {
            console.log('⚠️ Duplicate image detected (same image within 5 seconds), skipping save');
            await connection.end();
            return res.status(200).json({
              success: true,
              id: entry.ID,
              isDuplicate: true,
              message: 'This image was already saved recently',
              data: {
                userId,
                timestamp: new Date().toISOString()
              }
            });
          }
        }
      }
    }

    // Parse analysis result to extract nutrition values
    let totalCalories = null, totalProtein = null, totalCarbs = null, totalFat = null, totalFiber = null;
    let confidenceScore = null;
    let processedBy = 'manual_app'; // Default for manual saves (matches DB enum)
    
    // Function to convert confidence string to numeric value
    const convertConfidenceToNumeric = (confidence) => {
      if (typeof confidence === 'number') return confidence;
      if (typeof confidence === 'string') {
        switch (confidence.toLowerCase()) {
          case 'high': return 0.90;
          case 'medium': return 0.70;
          case 'low': return 0.50;
          case 'very_high': return 0.95;
          case 'very_low': return 0.30;
          default: return 0.70; // Default to medium confidence
        }
      }
      return null;
    };
    
    try {
      const analysis = typeof analysisResult === 'string' ? JSON.parse(analysisResult) : analysisResult;
      
      // Check if this is from background service (has foods array with total)
      if (analysis.foods && analysis.foods.length > 0 && analysis.total) {
        // This is the standard format (both background service and manual save now use this)
        totalCalories = analysis.total.calories || null;
        totalProtein = analysis.total.protein || null;
        totalCarbs = analysis.total.carbs || null;
        totalFat = analysis.total.fat || null;
        totalFiber = analysis.total.fiber || null;
        confidenceScore = convertConfidenceToNumeric(analysis.confidence);
        // Determine source based on deviceInfo - only actual Android Background Service should be background_service
        processedBy = (deviceInfo && deviceInfo.includes('Android Background Service')) ? 'background_service' : 'manual_app';
      } else if (analysis.nutrition) {
        // Legacy manual save format - use nutrition object (keeping for backwards compatibility)
        totalCalories = analysis.nutrition.calories || null;
        totalProtein = analysis.nutrition.protein || null;
        totalCarbs = analysis.nutrition.carbs || null;
        totalFat = analysis.nutrition.fat || null;
        totalFiber = analysis.nutrition.fiber || null;
        confidenceScore = convertConfidenceToNumeric(analysis.confidence);
        processedBy = 'manual_app';
      } else if (analysis.foods && analysis.foods.length > 0) {
        // Fallback: extract from first food item (legacy format)
        const firstFood = analysis.foods[0];
        if (firstFood.nutrition) {
          totalCalories = firstFood.nutrition.calories || null;
          totalProtein = firstFood.nutrition.protein || null;
          totalCarbs = firstFood.nutrition.carbs || null;
          totalFat = firstFood.nutrition.fat || null;
          totalFiber = firstFood.nutrition.fiber || null;
        }
        confidenceScore = convertConfidenceToNumeric(firstFood.confidence || analysis.confidence);
        processedBy = 'background_service';
      }
    } catch (parseError) {
      console.warn('Could not parse nutrition data:', parseError);
    }

    // Connection already created above for duplicate check

    // Insert into the new table structure, now including ImageBase64
    const insertQuery = `
      INSERT INTO food_nutrition_data_table (
        UserID, ImagePath, AnalysisData, ConfidenceScore, 
        TotalCalories, TotalProtein, TotalCarbs, TotalFat, TotalFiber,
        ProcessedBy, DeviceInfo, ImageBase64
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const analysisDataJson = typeof analysisResult === 'string' ? analysisResult : JSON.stringify(analysisResult);

    // If ImageBase64 is empty string, store as null
    const imageBase64ToSave = (ImageBase64 && ImageBase64.trim() !== '') ? ImageBase64 : null;

    const [result] = await connection.execute(insertQuery, [
      userId,
      imagePath,
      analysisDataJson,
      confidenceScore,
      totalCalories,
      totalProtein,
      totalCarbs,
      totalFat,
      totalFiber,
      processedBy,
      deviceInfo || (processedBy === 'background_service' ? 'Android Background Service' : 'Wellness Buddy Web App'),
      imageBase64ToSave
    ]);

    await connection.end();

    res.status(200).json({
      success: true,
      id: result.insertId,
      message: 'Analysis saved successfully',
      data: {
        userId,
        imagePath: imagePath.substring(imagePath.lastIndexOf('/') + 1),
        nutrition: {
          calories: totalCalories,
          protein: totalProtein,
          carbs: totalCarbs,
          fat: totalFat,
          fiber: totalFiber
        },
        confidence: confidenceScore,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Database save error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save analysis',
      error: error.message
    });
  }
}
