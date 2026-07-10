// backend/pages/api/counselling/save-assessment.js
/**
 * API Endpoint: Save Wellness Counselling Assessment
 * POST /api/counselling/save-assessment
 * 
 * Saves a counselling assessment for a team member
 * Database table: wellness_counselling_assessments
 * Migration: backend/migrations/wellness_counselling_assessments.sql
 */

import { getSupabaseClient, getISTTimestamp } from '../../../utils/supabaseClient.js';
import logger from '../../../shared/lib/logger.js';

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
      counsellorId,
      healthProblems,
      eatingHabits,
      sleepData,
      medicationDetails,
      // Lead fields — name + phone only (for linking to future account).
      // Diet type and health data come from the counselling form sections
      // (eating_habits.dietType, health_problems) — no duplication needed.
      leadName,
      leadPhone,
    } = req.body;

    // Validation
    if (!counsellorId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: counsellorId'
      });
    }

    // Either an existing userId OR lead contact details must be provided
    if (!userId && !leadPhone) {
      return res.status(400).json({
        success: false,
        message: 'Either userId (for existing member) or leadPhone (for new lead) is required'
      });
    }

    // Ensure IDs are integers (nullable for lead mode)
    const userIdInt = userId ? parseInt(userId) : null;
    const counsellorIdInt = parseInt(counsellorId);

    if (userId && isNaN(userIdInt)) {
      return res.status(400).json({
        success: false,
        message: 'userId must be a valid integer'
      });
    }
    if (isNaN(counsellorIdInt)) {
      return res.status(400).json({
        success: false,
        message: 'counsellorId must be a valid integer'
      });
    }

    if (!healthProblems || healthProblems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one health problem must be selected'
      });
    }

    logger.debug('📋 Saving Counselling Assessment:', {
      userId: userIdInt,
      counsellorId: counsellorIdInt,
      healthProblemsCount: healthProblems?.length,
      isLead: !userIdInt,
    });

    // Get Supabase client
    const supabase = getSupabaseClient();
    const timestamp = getISTTimestamp();

    // Insert assessment into database (SERIAL auto-generates ID)
    const { data, error } = await supabase
      .from('wellness_counselling_assessments')
      .insert({
        user_id: userIdInt,
        counsellor_id: counsellorIdInt,
        health_problems: healthProblems,
        eating_habits: eatingHabits || null,
        sleep_data: sleepData || null,
        medication_details: medicationDetails || null,
        // Lead columns — name + phone only for identity linking
        lead_name: leadName || null,
        lead_phone: leadPhone || null,
        submitted_at: timestamp,
        created_at: timestamp,
        updated_at: timestamp,
        is_deleted: false
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Database error saving assessment:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to save assessment to database',
        error: error.message
      });
    }

    logger.debug('✅ Assessment saved successfully:', data.id);

    return res.status(200).json({
      success: true,
      message: 'Assessment saved successfully',
      data: {
        id: data.id,
        userId: data.user_id,
        submittedAt: data.submitted_at,
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
