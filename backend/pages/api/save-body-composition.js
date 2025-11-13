/**
 * API Endpoint: Save Body Composition Entry
 * POST /api/save-body-composition
 * 
 * Saves comprehensive body composition metrics to database
 */

import mysql from 'mysql2/promise';

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      message: 'Method not allowed. Use POST.' 
    });
  }

  try {
    const {
      userId,
      // Basic Metrics
      weight,
      weightUnit = 'kg',
      bmi,
      // Body Fat Metrics
      bodyFatPercentage,
      subcutaneousFat,
      visceralFat,
      // Muscle Metrics
      muscleRate,
      skeletalMuscle,
      muscleMass,
      // Composition Metrics
      fatFreeBodyWeight,
      boneMass,
      protein,
      bodyWater,
      // Metabolic Metrics
      bmr,
      bodyAge,
      // Status Indicators
      weightStatus,
      bodyFatStatus,
      muscleStatus,
      visceralFatStatus,
      // Image and Notes
      imageBase64,
      imagePath,
      notes,
      // OCR Data
      ocrConfidence,
      ocrRawText,
      // Measurement Context
      measurementTime,
      measurementCondition
    } = req.body;

    // Validation
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'User ID is required' 
      });
    }

    if (!weight || isNaN(weight)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Valid weight is required' 
      });
    }

    // Weight range validation
    const weightNum = parseFloat(weight);
    if (weightNum < 20 || weightNum > 300) {
      return res.status(400).json({ 
        success: false, 
        message: 'Weight must be between 20 and 300 kg' 
      });
    }

    // Create database connection
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'wellness_buddy'
    });

    // Insert body composition entry
    const [result] = await connection.execute(
      `INSERT INTO body_composition_entries (
        UserID, Weight, WeightUnit, BMI,
        BodyFatPercentage, SubcutaneousFat, VisceralFat,
        MuscleRate, SkeletalMuscle, MuscleMass,
        FatFreeBodyWeight, BoneMass, Protein, BodyWater,
        BMR, BodyAge,
        WeightStatus, BodyFatStatus, MuscleStatus, VisceralFatStatus,
        ImageBase64, ImagePath, Notes,
        OCRConfidence, OCRRawText,
        MeasurementTime, MeasurementCondition
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        weightNum,
        weightUnit,
        bmi || null,
        bodyFatPercentage || null,
        subcutaneousFat || null,
        visceralFat || null,
        muscleRate || null,
        skeletalMuscle || null,
        muscleMass || null,
        fatFreeBodyWeight || null,
        boneMass || null,
        protein || null,
        bodyWater || null,
        bmr || null,
        bodyAge || null,
        weightStatus || null,
        bodyFatStatus || null,
        muscleStatus || null,
        visceralFatStatus || null,
        imageBase64 || null,
        imagePath || null,
        notes || null,
        ocrConfidence || null,
        ocrRawText || null,
        measurementTime || null,
        measurementCondition || null
      ]
    );

    await connection.end();

    console.log('✅ Body composition saved:', result.insertId);

    return res.status(200).json({
      success: true,
      message: 'Body composition saved successfully',
      data: {
        id: result.insertId,
        userId,
        weight: weightNum,
        weightUnit,
        bmi,
        createdAt: new Date()
      }
    });

  } catch (error) {
    console.error('❌ Error saving body composition:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to save body composition',
      error: error.message
    });
  }
}
