// backend/pages/api/counselling/get-assessments.js
/**
 * API Endpoint: Get Wellness Counselling Assessments
 * GET /api/counselling/get-assessments?userId=xxx
 * 
 * Retrieves all counselling assessments (latest per user)
 * Returns a map of userId -> assessment data
 * Database table: wellness_counselling_assessments
 */

import { getSupabaseClient } from '../../../utils/supabaseClient.js';
import logger from '../../../shared/lib/logger.js';

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

    // Ensure userId is integer
    const userIdInt = parseInt(userId);
    if (isNaN(userIdInt)) {
      return res.status(400).json({
        success: false,
        message: 'userId must be a valid integer'
      });
    }

    logger.debug('📋 Fetching counselling assessments for userId:', userIdInt);

    // Get Supabase client
    const supabase = getSupabaseClient();

    // Fetch ALL assessments with user and counsellor details via join
    // Join with team_table to get current names and emails
    // Note: Constraint names might be fk_user/fk_counsellor depending on your DB
    const { data: assessments, error } = await supabase
      .from('wellness_counselling_assessments')
      .select(`
        *,
        user:team_table!fk_user(UserId, UserName, Email),
        counsellor:team_table!fk_counsellor(UserId, UserName, Email)
      `)
      .eq('is_deleted', false)
      .order('submitted_at', { ascending: false });

    if (error) {
      console.error('❌ Database error fetching assessments:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch assessments from database',
        error: error.message
      });
    }

    // Create a map of userId -> latest assessment
    const assessmentMap = {};
    
    if (assessments && assessments.length > 0) {
      // Since we ordered by submitted_at DESC, the first occurrence
      // of each user_id is their most recent assessment
      for (const assessment of assessments) {
        const uid = assessment.user_id;
        if (!assessmentMap[uid]) {
          assessmentMap[uid] = {
            id: assessment.id,
            userId: assessment.user_id,
            userEmail: assessment.user?.Email || 'Unknown',
            userName: assessment.user?.UserName || 'Unknown',
            counsellorId: assessment.counsellor_id,
            counsellorEmail: assessment.counsellor?.Email || 'Unknown',
            counsellorName: assessment.counsellor?.UserName || 'Unknown',
            healthProblems: assessment.health_problems,
            eatingHabits: assessment.eating_habits,
            sleepData: assessment.sleep_data,
            medicationDetails: assessment.medication_details,
            submittedAt: assessment.submitted_at,
          };
        }
      }
    }

    logger.debug(`✅ Found ${Object.keys(assessmentMap).length} assessments`);

    return res.status(200).json({
      success: true,
      data: assessmentMap,
      count: Object.keys(assessmentMap).length
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
