// backend/pages/api/counselling/hierarchical-assessments.js
/**
 * API Endpoint: Get Hierarchical Wellness Counselling Assessments
 * GET /api/counselling/hierarchical-assessments?userId=xxx
 * 
 * Uses dual coaching hierarchy to fetch all team members and their assessments
 * Returns nested hierarchy with counselling status
 */

import { getSupabaseClient } from '../../../utils/supabaseClient.js';
import { getDualCoachingTeamHierarchy } from '../../../utils/disciplineCalculationsSupabase.js';
import { buildHierarchyWithMetricCounts } from '../../../utils/hierarchyHelpers.js';

export default async function handler(req, res) {
  // Prevent caching
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
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

    const userIdInt = parseInt(userId);
    if (isNaN(userIdInt)) {
      return res.status(400).json({
        success: false,
        message: 'userId must be a valid integer'
      });
    }

    console.log('📋 [hierarchical-assessments] Fetching counselling data for userId:', userIdInt);

    const supabase = getSupabaseClient();

    // Step 1: Get team hierarchy using dual-coaching model
    const teamHierarchy = await getDualCoachingTeamHierarchy(userIdInt, false);
    
    if (!teamHierarchy || teamHierarchy.length === 0) {
      console.log('⚠️ [hierarchical-assessments] No team members found');
      return res.status(200).json({
        success: true,
        data: null,
        assessments: {},
        message: 'No team members found'
      });
    }

    console.log('👥 [hierarchical-assessments] Team hierarchy has', teamHierarchy.length, 'members');

    // Step 2: Get all user IDs from hierarchy
    const allUserIds = teamHierarchy.map(m => m.UserId);

    // Step 3: Fetch ALL counselling assessments for the team
    const { data: assessments, error } = await supabase
      .from('wellness_counselling_assessments')
      .select(`
        *,
        user:team_table!fk_user(UserId, UserName, Email),
        counsellor:team_table!fk_counsellor(UserId, UserName, Email)
      `)
      .in('user_id', allUserIds)
      .eq('is_deleted', false)
      .order('submitted_at', { ascending: false });

    if (error) {
      console.error('❌ [hierarchical-assessments] Database error fetching assessments:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch assessments from database',
        error: error.message
      });
    }

    // Step 4: Create a map of userId -> latest assessment
    const assessmentMap = {};
    
    if (assessments && assessments.length > 0) {
      for (const assessment of assessments) {
        const uid = assessment.user_id;
        // Only store the first (latest) assessment per user
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

    console.log(`✅ [hierarchical-assessments] Found ${Object.keys(assessmentMap).length} assessments`);

    // Step 5: Create a Map for use with buildHierarchyWithMetricCounts
    const assessmentDataMap = new Map();
    Object.keys(assessmentMap).forEach(userId => {
      assessmentDataMap.set(parseInt(userId), assessmentMap[userId]);
    });

    // Step 6: Transform function - adds metrics to each node
    const transformAssessmentFn = (userId, map, data) => {
      return {
        hasCounselling: !!data,
        counsellingDate: data?.submittedAt || null,
        counsellorName: data?.counsellorName || null,
        assessmentId: data?.id || null,
      };
    };

    // Step 7: Condition function - checks if someone has been counselled
    const counselledConditionFn = (child) => child.metrics?.hasCounselling === true;

    // Step 8: Build nested hierarchy with metric counts
    const hierarchy = buildHierarchyWithMetricCounts(
      teamHierarchy,
      assessmentDataMap,
      transformAssessmentFn,
      counselledConditionFn
    );

    if (!hierarchy) {
      console.warn('⚠️ [hierarchical-assessments] Failed to build hierarchy');
      return res.status(200).json({
        success: true,
        data: null,
        assessments: assessmentMap,
        totalMembers: teamHierarchy.length,
        totalAssessments: Object.keys(assessmentMap).length,
        message: 'Could not build hierarchy structure'
      });
    }

    console.log('✅ [hierarchical-assessments] Built hierarchy successfully');

    return res.status(200).json({
      success: true,
      data: hierarchy,
      assessments: assessmentMap,
      totalMembers: teamHierarchy.length,
      totalAssessments: Object.keys(assessmentMap).length
    });

  } catch (error) {
    console.error('❌ [hierarchical-assessments] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
}
