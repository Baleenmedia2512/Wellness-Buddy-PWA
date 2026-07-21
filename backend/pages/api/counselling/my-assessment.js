// backend/pages/api/counselling/my-assessment.js
/**
 * GET /api/counselling/my-assessment?userId=<id>
 *
 * Returns the most-recent counselling assessment for the requesting user.
 * Used by the profile page to pre-fill fields that the coach already
 * captured during the counselling session:
 *   • eating_habits.dietType  → profile dietType
 *   • eating_habits.wakeUpTime / meal times → informational
 *   • health_problems         → surfaced in profile health section (future)
 *   • sleep_data              → informational
 *
 * The flow is:
 *   Coach counsels lead → saves assessment (may be for a lead via lead_phone)
 *   Lead downloads app → registers with same mobile
 *   Profile page calls this endpoint → pre-fills from counselling data
 */
import { getSupabaseClient } from '../../../utils/supabaseClient.js';
import logger from '../../../shared/lib/logger.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { userId } = req.query;
  if (!userId) {
    return res.status(400).json({ success: false, message: 'userId is required' });
  }

  const userIdInt = parseInt(userId);
  if (isNaN(userIdInt)) {
    return res.status(400).json({ success: false, message: 'userId must be a valid integer' });
  }

  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('wellness_counselling_assessments')
      .select('id, health_problems, eating_habits, sleep_data, medication_details, submitted_at')
      .eq('user_id', userIdInt)
      .eq('is_deleted', false)
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      logger.error('❌ [my-assessment] DB error:', error);
      return res.status(500).json({ success: false, message: 'Database error' });
    }

    if (!data) {
      return res.status(200).json({ success: true, found: false, data: null });
    }

    logger.debug('✅ [my-assessment] Assessment found for user:', userIdInt);

    return res.status(200).json({
      success: true,
      found: true,
      data: {
        assessmentId: data.id,
        healthProblems: data.health_problems || [],
        eatingHabits: data.eating_habits || {},
        // Extracted top-level fields for easy profile pre-fill
        dietType: data.eating_habits?.dietType || null,
        waterIntake: data.eating_habits?.waterIntake || null,
        sleepData: data.sleep_data || {},
        medicationDetails: data.medication_details || null,
        submittedAt: data.submitted_at,
      },
    });
  } catch (err) {
    logger.error('❌ [my-assessment] Unexpected error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}
