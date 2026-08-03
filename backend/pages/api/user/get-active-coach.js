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
    const { userId: userIdQuery, email: emailQuery, phone: phoneQuery } = req.query;

    if (!userIdQuery && !emailQuery && !phoneQuery) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'MISSING_IDENTIFIER',
          message: 'userId, email, or phone is required',
        },
      });
    }

    const supabase = getSupabaseClient();

    let user = null;

    if (userIdQuery) {
      const { data, error: userError } = await supabase
        .from('team_table')
        .select('UserId, UserName, CoachId, Status')
        .eq('UserId', userIdQuery)
        .single();
      if (!userError && data) user = data;
    }

    if (!user && emailQuery) {
      const { data, error: userError } = await supabase
        .from('team_table')
        .select('UserId, UserName, CoachId, Status')
        .ilike('Email', String(emailQuery).trim())
        .limit(1);
      if (!userError && data?.[0]) user = data[0];
    }

    if (!user && phoneQuery) {
      const normalized = String(phoneQuery).trim();
      const { data, error: userError } = await supabase
        .from('team_table')
        .select('UserId, UserName, CoachId, Status')
        .eq('PhoneNumber', normalized)
        .limit(1);
      if (!userError && data?.[0]) user = data[0];
      if (!user) {
        const digits = normalized.replace(/\D/g, '');
        if (digits.length >= 10) {
          const { data: bySuffix, error: suffixErr } = await supabase
            .from('team_table')
            .select('UserId, UserName, CoachId, Status')
            .ilike('PhoneNumber', `%${digits.slice(-10)}`)
            .limit(1);
          if (!suffixErr && bySuffix?.[0]) user = bySuffix[0];
        }
      }
    }

    if (!user) {
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
    const originalCoachStatus = originalCoachRow?.Status || null;
    const directCoachIsActive = originalCoachStatus === 'Active';

    // Resolve upline when the direct coach is inactive
    const {
      coachId: resolvedCoachId,
      coachName: resolvedCoachName,
      isOriginalCoach,
    } = await resolveActiveCoach(user.UserId, supabase);

    // Inactive-account contact rule: show/contact direct coach unless they are
    // inactive — then fall back to the nearest active upline coach.
    const contactCoachId = directCoachIsActive ? user.CoachId : resolvedCoachId;
    const contactCoachName = directCoachIsActive ? originalCoachName : resolvedCoachName;

    return res.status(200).json({
      ok: true,
      data: {
        userId: user.UserId,
        userName: user.UserName,
        coachId: resolvedCoachId,
        coachName: resolvedCoachName,
        contactCoachId,
        contactCoachName,
        originalCoachId: user.CoachId,
        originalCoachName,
        originalCoachStatus,
        coachStatus: originalCoachStatus,
        isOriginalCoach: directCoachIsActive,
        message: !directCoachIsActive && contactCoachName
          ? `Your original coach is inactive. You are now managed by ${contactCoachName}.`
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
