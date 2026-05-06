/**
 * Wellness University Enrollment API
 * POST /api/wellness-university/enroll
 *
 * Allows users to enroll in Wellness University programs
 * Stores enrollment with IST timezone
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

    console.log('🎓 [enroll] Enrollment request:', { email, programCount: programs.length });

    const supabase = getSupabaseClient();

    // Get user info from team_table
    const { data: user, error: userError } = await supabase
      .from('team_table')
      .select('"UserId", "UserName", "Email", "CoachId"')
      .eq('"Email"', email)
      .maybeSingle();

    if (userError) {
      console.error('❌ [enroll] User lookup error:', userError);
      throw new Error(userError.message);
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found. Please complete your profile first.',
      });
    }

    console.log('✅ [enroll] User found:', { userId: user.UserId, userName: user.UserName });

    // Check if user is already enrolled
    const { data: existingEnrollment, error: checkError } = await supabase
      .from('wellness_university_enrollments_table')
      .select('"Id"')
      .eq('"UserId"', user.UserId)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('❌ [enroll] Check enrollment error:', checkError);
      throw new Error(checkError.message);
    }

    if (existingEnrollment) {
      return res.status(400).json({
        success: false,
        message: 'You are already enrolled in Wellness University',
      });
    }

    // Create enrollment record — store as map: { programName: isoDate }
    const enrollmentDate = getISTTimestamp();
    const programsMap = {};
    programs.forEach((p) => { programsMap[p] = enrollmentDate; });
    const programsJson = JSON.stringify(programsMap);

    const { data: newEnrollment, error: insertError } = await supabase
      .from('wellness_university_enrollments_table')
      .insert({
        UserId: user.UserId,
        EnrolledPrograms: programsJson,
        EnrollmentDate: enrollmentDate,
        LastUpdated: enrollmentDate,
        CreatedAt: enrollmentDate,
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ [enroll] Insert error:', insertError);
      throw new Error(insertError.message);
    }

    console.log('✅ [enroll] Enrollment created successfully:', { enrollmentId: newEnrollment.Id });

    // TODO: Send notification to coach (optional)
    if (user.CoachId) {
      console.log('📧 [enroll] Coach notification needed for coach:', user.CoachId);
      // You can add email notification here similar to upline/request.js
    }

    return res.status(200).json({
      success: true,
      message: 'Enrollment successful',
      enrollment: {
        id: newEnrollment.Id,
        programs: Object.keys(programsMap),
        enrollmentDate: enrollmentDate,
      },
    });
  } catch (error) {
    console.error('❌ [enroll] Server error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message,
    });
  }
}
