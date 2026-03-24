// backend/pages/api/counselling/save-assessment.js
/**
 * API Endpoint: Save Wellness Counselling Assessment
 * POST /api/counselling/save-assessment
 * 
 * Saves a counselling assessment for a team member
 */

// TODO: Add database table structure
// CREATE TABLE wellness_counselling_assessments (
//   id SERIAL PRIMARY KEY,
//   user_id VARCHAR(255) NOT NULL,
//   user_email VARCHAR(255) NOT NULL,
//   user_name VARCHAR(255),
//   counsellor_id VARCHAR(255) NOT NULL,
//   counsellor_name VARCHAR(255) NOT NULL,
//   health_problems JSONB,
//   eating_habits JSONB,
//   sleep_data JSONB,
//   medication_details TEXT,
//   submitted_at TIMESTAMP DEFAULT NOW(),
//   created_at TIMESTAMP DEFAULT NOW(),
//   updated_at TIMESTAMP DEFAULT NOW()
// );

export default async function handler(req, res) {
  // Set CORS headers for all responses
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Cache-Control, Pragma");
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
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
      userEmail,
      userName,
      counsellorId,
      counsellorName,
      healthProblems,
      eatingHabits,
      sleepData,
      medicationDetails,
    } = req.body;

    // Validation
    if (!userId || !userEmail || !counsellorId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: userId, userEmail, counsellorId'
      });
    }

    if (!healthProblems || healthProblems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one health problem must be selected'
      });
    }

    // TODO: Implement database save
    // const { Pool } = require('pg');
    // const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    // 
    // const query = `
    //   INSERT INTO wellness_counselling_assessments 
    //   (user_id, user_email, user_name, counsellor_id, counsellor_name, 
    //    health_problems, eating_habits, sleep_data, medication_details)
    //   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    //   RETURNING id, submitted_at
    // `;
    // 
    // const values = [
    //   userId,
    //   userEmail,
    //   userName,
    //   counsellorId,
    //   counsellorName,
    //   JSON.stringify(healthProblems),
    //   JSON.stringify(eatingHabits),
    //   JSON.stringify(sleepData),
    //   medicationDetails
    // ];
    // 
    // const result = await pool.query(query, values);

    console.log('📋 Counselling Assessment Saved:', {
      userId,
      userEmail,
      userName,
      counsellorName,
      healthProblems,
    });

    return res.status(200).json({
      success: true,
      message: 'Assessment saved successfully',
      data: {
        id: 'mock-id-' + Date.now(),
        userId,
        submittedAt: new Date().toISOString(),
      }
    });

  } catch (error) {
    console.error('❌ Error saving counselling assessment:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
}
