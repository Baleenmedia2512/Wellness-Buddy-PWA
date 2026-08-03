// backend/pages/api/counselling/lead-by-phone.js
/**
 * API Endpoint: Look up counselling lead by phone number
 * GET /api/counselling/lead-by-phone?phone=<phone>
 *
 * Used during profile setup / first login to pre-populate the member's
 * profile with details captured during a counselling session for a lead
 * who was not yet registered in the app at the time of assessment.
 *
 * Only returns leads where user_id IS NULL (i.e. not yet linked to an account).
 * The most-recent assessment for that phone is returned.
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

  const { phone } = req.query;
  if (!phone || phone.trim() === '') {
    return res.status(400).json({ success: false, message: 'phone is required' });
  }

  // Normalise: strip all non-digit characters except leading + for comparison
  const normalised = phone.trim().replace(/[\s\-()]/g, '');

  try {
    const supabase = getSupabaseClient();

    // Look for unlinked lead assessments with a matching phone number.
    // We strip formatting server-side by searching for the last 10 digits
    // (works for +91 XXXXXXXXXX and 0XXXXXXXXXX formats used in India).
    const last10 = normalised.slice(-10);

    const { data, error } = await supabase
      .from('wellness_counselling_assessments')
      .select('id, lead_name, lead_phone, health_problems, eating_habits, sleep_data, submitted_at')
      .is('user_id', null)
      .eq('is_deleted', false)
      .ilike('lead_phone', `%${last10}`)
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      logger.error('❌ [lead-by-phone] DB error:', error);
      return res.status(500).json({ success: false, message: 'Database error' });
    }

    if (!data) {
      return res.status(200).json({ success: true, found: false, data: null });
    }

    logger.debug('✅ [lead-by-phone] Lead found:', { id: data.id, phone: normalised });

    return res.status(200).json({
      success: true,
      found: true,
      data: {
        assessmentId: data.id,
        // Identity fields (captured in LeadDetailsSection)
        name: data.lead_name || null,
        phone: data.lead_phone || null,
        // Counselling form fields — these flow INTO the profile
        dietType: data.eating_habits?.dietType || null,
        healthProblems: data.health_problems || [],
        eatingHabits: data.eating_habits || {},
        sleepData: data.sleep_data || {},
        submittedAt: data.submitted_at,
      },
    });
  } catch (err) {
    logger.error('❌ [lead-by-phone] Unexpected error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}
