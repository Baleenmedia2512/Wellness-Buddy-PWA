/**
 * get-active-coach.js — Returns the active coach for a user
 * Handles inactive coaches by walking up the hierarchy
 * 
 * @module backend/pages/api/user/get-active-coach
 */

import { getSupabaseClient } from '../../../utils/supabaseClient.js';
import { resolveActiveCoach } from '../../../utils/hierarchyHelpers.js';
import { applyCors, methodNotAllowed } from '../../../shared/lib/handler.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  
  if (req.method !== 'GET') {
    return methodNotAllowed(res);
  }

  try {
    const { userId: userIdQuery, email: emailQuery } = req.query;

    if (!userIdQuery && !emailQuery) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'MISSING_IDENTIFIER',
          message: 'userId or email is required',
        },
      });
    }

    const supabase = getSupabaseClient();

    // Get user's basic info
    let userQuery = supabase
      .from('team_table')
      .select('UserId, UserName, CoachId, Status');

    if (userIdQuery) {
      userQuery = userQuery.eq('UserId', userIdQuery);
    } else {
      userQuery = userQuery.eq('Email', String(emailQuery).trim());
    }

    const { data: user, error: userError } = await userQuery.single();

    if (userError || !user) {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    // If user has no coach, return null
    if (!user.CoachId) {
      return res.status(200).json({
        ok: true,
        data: {
          userId: user.UserId,
          userName: user.UserName,
          coachId: null,
          coachName: null,
          originalCoachId: null,
          originalCoachName: null,
          coachStatus: null,
          isOriginalCoach: true,
          message: 'User has no coach (top-level)',
        },
      });
    }

    const { data: originalCoachRow } = await supabase
      .from('team_table')
      .select('UserId, UserName, Status')
      .eq('UserId', user.CoachId)
      .single();

    const originalCoachName = originalCoachRow?.UserName || null;

    // Resolve the active coach
    const {
      coachId,
      coachName,
      isOriginalCoach,
    } = await resolveActiveCoach(user.UserId, supabase);

    // Get coach status for additional info
    let coachStatus = 'Active';
    if (!isOriginalCoach) {
      const { data: originalCoach } = await supabase
        .from('team_table')
        .select('Status, UserName')
        .eq('UserId', user.CoachId)
        .single();
      coachStatus = originalCoach?.Status || 'Unknown';
    }

    return res.status(200).json({
      ok: true,
      data: {
        userId: user.UserId,
        userName: user.UserName,
        coachId,
        coachName,
        originalCoachId: user.CoachId,
        originalCoachName,
        coachStatus,
        isOriginalCoach,
        message: !isOriginalCoach
          ? `Your original coach is inactive. You are now managed by ${coachName}.`
          : null,
      },
    });
  } catch (err) {
    console.error('[get-active-coach] Error:', err);
    return res.status(500).json({
      ok: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to get active coach',
      },
    });
  }
}
