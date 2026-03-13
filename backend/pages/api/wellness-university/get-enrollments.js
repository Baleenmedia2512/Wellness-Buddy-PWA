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
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

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

    // If not admin/developer, filter to show their own enrollment + their team's enrollments (multi-level)
    if (requestingUser.Role !== 'admin' && requestingUser.Role !== 'developer') {
      // Get all team members recursively (multi-level hierarchy)
      const teamUserIds = [requestingUser.UserId]; // Start with coach's own ID
      let currentLevelCoachIds = [requestingUser.UserId];
      let currentLevel = 1;
      const maxLevel = 10;

      while (currentLevelCoachIds.length > 0 && currentLevel <= maxLevel) {
        // Fetch members where CoachId OR CoCoachId matches current level coaches
        const { data: levelMembers, error: levelError } = await supabase
          .from('team_table')
          .select('"UserId", "Role", "CoachId", "CoCoachId"')
          .or(
            `CoachId.in.(${currentLevelCoachIds.join(",")}),CoCoachId.in.(${currentLevelCoachIds.join(",")})`,
          )
          .eq('"Status"', 'Active');

        if (levelError) {
          console.error('❌ [get-enrollments] Team lookup error:', levelError);
          break;
        }

        if (!levelMembers || levelMembers.length === 0) break;

        const nextLevelCoachIds = [];

        for (const member of levelMembers) {
          // Add member to team if not already included
          if (!teamUserIds.includes(member.UserId)) {
            teamUserIds.push(member.UserId);
          }

          // If member is a coach, add to next level for recursive fetch
          if (member.Role === 'coach' && !nextLevelCoachIds.includes(member.UserId)) {
            nextLevelCoachIds.push(member.UserId);
          }
        }

        currentLevelCoachIds = nextLevelCoachIds;
        currentLevel++;
      }

      console.log(`✅ [get-enrollments] Coach viewing: ${teamUserIds.length} total members (multi-level hierarchy)`);
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
      .select('"UserId", "UserName", "Email", "CoachId", "CoCoachId"')
      .in('"UserId"', userIds);

    if (usersError) {
      console.error('❌ [get-enrollments] Users lookup error:', usersError);
      throw new Error(usersError.message);
    }

    // Fetch coach names for CoachIds
    const coachIds = [...new Set(users.map((u) => u.CoachId).filter(Boolean))];
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
      const coach = coaches.find((c) => c.UserId === user?.CoachId);

      return {
        ...enrollment,
        UserName: user?.UserName || 'Unknown',
        Email: user?.Email || '',
        CoachName: coach?.UserName || '',
        CoachId: user?.CoachId || null,
        CoCoachId: user?.CoCoachId || null,
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
