/**
 * Get Wellness University Enrollments API
 * GET /api/wellness-university/get-enrollments
 *
 * Returns enrollments based on user role:
 * - Regular users: Only their own enrollment (with userOnly=true)
 * - Coaches: Their team's enrollments
 * - Admins: All enrollments
 */

import { getSupabaseClient } from '../../../utils/supabaseClient.js';

export default async function handler(req, res) {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(200).end();
    return;
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Only allow GET requests
  if (req.method !== 'GET') {
    res.status(405).json({
      success: false,
      message: 'Method not allowed',
    });
    return;
  }

  try {
    const { email, userOnly } = req.query;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
      });
    }

    console.log('📊 [get-enrollments] Request:', { email, userOnly });

    const supabase = getSupabaseClient();

    // Get requesting user info
    const { data: requestingUser, error: userError } = await supabase
      .from('team_table')
      .select('"UserId", "UserName", "Email", "Role"')
      .eq('"Email"', email)
      .maybeSingle();

    if (userError) {
      console.error('❌ [get-enrollments] User lookup error:', userError);
      throw new Error(userError.message);
    }

    if (!requestingUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    console.log('✅ [get-enrollments] User found:', {
      userId: requestingUser.UserId,
      role: requestingUser.Role,
    });

    // If userOnly is true, return only the user's own enrollment
    if (userOnly === 'true') {
      const { data: enrollment, error: enrollmentError } = await supabase
        .from('wellness_university_enrollments_table')
        .select('*')
        .eq('"UserId"', requestingUser.UserId)
        .order('"LastUpdated"', { ascending: false })
        .limit(1);

      if (enrollmentError) {
        console.error('❌ [get-enrollments] Query error:', enrollmentError);
        throw new Error(enrollmentError.message);
      }

      return res.status(200).json({
        success: true,
        enrollments: enrollment || [],
      });
    }

    // Build query based on user role
    let query = supabase
      .from('wellness_university_enrollments_table')
      .select(
        `
        "Id",
        "UserId",
        "EnrolledPrograms",
        "EnrollmentDate",
        "LastUpdated",
        "CreatedAt"
      `
      )
      .order('"LastUpdated"', { ascending: false });

    // If not admin/developer, filter to show their own enrollment + their team's enrollments
    if (requestingUser.Role !== 'admin' && requestingUser.Role !== 'developer') {
      // Get all users where this person is the coach
      const { data: teamMembers, error: teamError } = await supabase
        .from('team_table')
        .select('"UserId"')
        .eq('"UplineCoachId"', requestingUser.UserId);

      if (teamError) {
        console.error('❌ [get-enrollments] Team lookup error:', teamError);
        throw new Error(teamError.message);
      }

      // Include coach's own UserId + team members
      const teamUserIds = teamMembers ? teamMembers.map((m) => m.UserId) : [];
      teamUserIds.push(requestingUser.UserId); // Add coach's own ID

      console.log(`✅ [get-enrollments] Coach viewing: self + ${teamUserIds.length - 1} team members`);
      query = query.in('"UserId"', teamUserIds);
    }

    const { data: enrollments, error: queryError } = await query;

    if (queryError) {
      console.error('❌ [get-enrollments] Query error:', queryError);
      throw new Error(queryError.message);
    }

    // Fetch user details for each enrollment
    const userIds = enrollments.map((e) => e.UserId);
    const { data: users, error: usersError } = await supabase
      .from('team_table')
      .select('"UserId", "UserName", "Email", "UplineCoachId"')
      .in('"UserId"', userIds);

    if (usersError) {
      console.error('❌ [get-enrollments] Users lookup error:', usersError);
      throw new Error(usersError.message);
    }

    // Fetch coach names for UplineCoachIds
    const coachIds = [...new Set(users.map((u) => u.UplineCoachId).filter(Boolean))];
    let coaches = [];
    if (coachIds.length > 0) {
      const { data: coachData, error: coachError } = await supabase
        .from('team_table')
        .select('"UserId", "UserName"')
        .in('"UserId"', coachIds);

      if (!coachError) {
        coaches = coachData || [];
      }
    }

    // Merge user data with enrollments
    const enrichedEnrollments = enrollments.map((enrollment) => {
      const user = users.find((u) => u.UserId === enrollment.UserId);
      const coach = coaches.find((c) => c.UserId === user?.UplineCoachId);

      return {
        ...enrollment,
        UserName: user?.UserName || 'Unknown',
        Email: user?.Email || '',
        CoachName: coach?.UserName || '',
        CoachId: user?.UplineCoachId || null,
      };
    });

    console.log('✅ [get-enrollments] Returning enrollments:', enrichedEnrollments.length);

    return res.status(200).json({
      success: true,
      enrollments: enrichedEnrollments,
    });
  } catch (error) {
    console.error('❌ [get-enrollments] Server error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message,
    });
  }
}
