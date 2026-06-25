/**
 * Update Wellness University Enrollment API
 * POST /api/wellness-university/update-enrollment
 *
 * Allows users to update their enrolled programs
 */


import { getSupabaseClient, getISTTimestamp } from '../../../utils/supabaseClient.js';
import logger from '../../../shared/lib/logger.js';

export default async function handler(req, res) {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(200).end();
    return;
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Only allow POST requests
  if (req.method !== 'POST') {
    res.status(405).json({
      success: false,
      message: 'Method not allowed',
    });
    return;
  }

  try {
    const { email, programs } = req.body;

    // Validation
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
      });
    }

    if (!programs || !Array.isArray(programs) || programs.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please select at least one program',
      });
    }

    logger.debug('✏️ [update-enrollment] Update request:', { email, programCount: programs.length });

    const supabase = getSupabaseClient();

    // Get user info from team_table
    const { data: user, error: userError } = await supabase
      .from('team_table')
      .select('"UserId", "UserName", "Email"')
      .eq('"Email"', email)
      .maybeSingle();

    if (userError) {
      console.error('❌ [update-enrollment] User lookup error:', userError);
      throw new Error(userError.message);
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    logger.debug('✅ [update-enrollment] User found:', { userId: user.UserId, userName: user.UserName });

    // Update enrollment record — preserve existing per-program dates, add new ones
    const updateTime = getISTTimestamp();

    // Fetch existing record to get current program dates
    const { data: existing } = await supabase
      .from('wellness_university_enrollments_table')
      .select('"EnrolledPrograms"')
      .eq('"UserId"', user.UserId)
      .maybeSingle();

    // Parse existing stored data (may be array, map object, or JSON string)
    let existingMap = {};
    if (existing?.EnrolledPrograms) {
      try {
        // Supabase may return JSONB as already-parsed object, or as a JSON string
        const parsed = typeof existing.EnrolledPrograms === 'string'
          ? JSON.parse(existing.EnrolledPrograms)
          : existing.EnrolledPrograms;
        if (Array.isArray(parsed)) {
          // Legacy array format — convert to map using updateTime as placeholder
          parsed.forEach((p) => { existingMap[p] = updateTime; });
        } else if (parsed && typeof parsed === 'object') {
          existingMap = parsed;
        }
      } catch (e) {
        console.warn('⚠️ [update-enrollment] Failed to parse existing EnrolledPrograms:', e.message);
      }
    }

    // Build new map: keep existing dates for old programs, add updateTime for new programs
    const newMap = {};
    programs.forEach((p) => {
      newMap[p] = existingMap[p] || updateTime;
    });

    const programsJson = JSON.stringify(newMap);

    // Update or insert based on whether record exists
    let enrollment;
    if (existing) {
      // Update existing record
      const { data: updatedEnrollment, error: updateError } = await supabase
        .from('wellness_university_enrollments_table')
        .update({
          EnrolledPrograms: programsJson,
          LastUpdated: updateTime,
        })
        .eq('UserId', user.UserId)
        .select()
        .single();

      if (updateError) {
        console.error('❌ [update-enrollment] Update error:', updateError);
        throw new Error(updateError.message);
      }

      enrollment = updatedEnrollment;
    } else {
      // Insert new record
      const { data: newEnrollment, error: insertError } = await supabase
        .from('wellness_university_enrollments_table')
        .insert({
          UserId: user.UserId,
          EnrolledPrograms: programsJson,
          EnrollmentDate: updateTime,
          LastUpdated: updateTime,
          CreatedAt: updateTime,
        })
        .select()
        .single();

      if (insertError) {
        console.error('❌ [update-enrollment] Insert error:', insertError);
        throw new Error(insertError.message);
      }

      enrollment = newEnrollment;
    }

    if (!enrollment) {
      throw new Error('No enrollment record returned after save');
    }

    logger.debug('✅ [update-enrollment] Enrollment upserted successfully:', { enrollmentId: enrollment.Id });

    return res.status(200).json({
      success: true,
      message: 'Enrollment updated successfully',
      enrollment: {
        id: enrollment.Id,
        programs: Object.keys(newMap),
      },
    });
  } catch (error) {
    console.error('❌ [update-enrollment] Server error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message,
    });
  }
}
