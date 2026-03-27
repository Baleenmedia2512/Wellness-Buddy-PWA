/**
 * Update Wellness University Enrollment API
 * POST /api/wellness-university/update-enrollment
 *
 * Allows users to update their enrolled programs
 */


import { getSupabaseClient, getISTTimestamp } from '../../../utils/supabaseClient.js';

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

    console.log('✏️ [update-enrollment] Update request:', { email, programCount: programs.length });

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

    console.log('✅ [update-enrollment] User found:', { userId: user.UserId, userName: user.UserName });

    // Update enrollment record
    const programsJson = JSON.stringify(programs);
    const updateTime = getISTTimestamp();

    const { data: updatedEnrollment, error: updateError } = await supabase
      .from('wellness_university_enrollments_table')
      .update({
        EnrolledPrograms: programsJson,
        LastUpdated: updateTime,
      })
      .eq('"UserId"', user.UserId)
      .select()
      .single();

    if (updateError) {
      console.error('❌ [update-enrollment] Update error:', updateError);
      throw new Error(updateError.message);
    }

    console.log('✅ [update-enrollment] Enrollment updated successfully:', { enrollmentId: updatedEnrollment.Id });

    return res.status(200).json({
      success: true,
      message: 'Enrollment updated successfully',
      enrollment: {
        id: updatedEnrollment.Id,
        programs: programs,
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
