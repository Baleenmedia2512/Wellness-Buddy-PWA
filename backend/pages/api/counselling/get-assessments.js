// backend/pages/api/counselling/get-assessments.js
/**
 * API Endpoint: Get Wellness Counselling Assessments
 * GET /api/counselling/get-assessments?userId=xxx
 * 
 * Retrieves all counselling assessments for a user's team hierarchy
 */

export default async function handler(req, res) {
  // Set CORS headers for all responses
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Cache-Control, Pragma");
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
    });
  }

  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameter: userId'
      });
    }

    // TODO: Implement database fetch
    // Fetch all assessments for the coach's team members
    // 
    // const { Pool } = require('pg');
    // const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    // 
    // First, get all team members under this userId
    // Then fetch their assessments (only latest one per user)
    // 
    // const query = `
    //   SELECT DISTINCT ON (user_id)
    //     id,
    //     user_id,
    //     user_email,
    //     user_name,
    //     counsellor_id,
    //     counsellor_name,
    //     health_problems,
    //     eating_habits,
    //     sleep_data,
    //     medication_details,
    //     submitted_at
    //   FROM wellness_counselling_assessments
    //   WHERE user_id IN (
    //     SELECT user_id FROM team_hierarchy 
    //     WHERE coach_id = $1 OR co_coach_id = $1
    //   )
    //   OR user_id = $1
    //   ORDER BY user_id, submitted_at DESC
    // `;
    // 
    // const result = await pool.query(query, [userId]);

    // Mock response - return empty for now
    const mockAssessments = {};

    console.log('📋 Fetching counselling assessments for userId:', userId);

    return res.status(200).json({
      success: true,
      data: mockAssessments
    });

  } catch (error) {
    console.error('❌ Error fetching counselling assessments:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
}
