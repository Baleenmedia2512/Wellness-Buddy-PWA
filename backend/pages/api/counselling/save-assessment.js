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
    } = req.body;

    // Validation
    if (!userId || !counsellorId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: userId, counsellorId'
      });
    }

    // Ensure IDs are integers
    const userIdInt = parseInt(userId);
    const counsellorIdInt = parseInt(counsellorId);

    if (isNaN(userIdInt) || isNaN(counsellorIdInt)) {
      return res.status(400).json({
        success: false,
        message: 'userId and counsellorId must be valid integers'
      });
    }

    if (!healthProblems || healthProblems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one health problem must be selected'
      });
    }

    console.log('📋 Saving Counselling Assessment:', {
      userId: userIdInt,
      counsellorId: counsellorIdInt,
      healthProblemsCount: healthProblems?.length,
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

    console.log('✅ Assessment saved successfully:', data.id);

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
