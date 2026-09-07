/**
 * Cancel Upline Coach Approval Request
 * POST /api/upline/cancel-request
 *
 * Cancels pending approval request and clears pending TeamId claim.
 * Preserves CoachId / CoachTeamId for established members (e.g. inactive reactivation).
 */

import { getSupabaseClient } from '../../../utils/supabaseClient.js';
import { nowUtc } from '../../../shared/lib/datetime/index.js';
import { buildTeamTableClearOnCancelRequest } from '../../../utils/coachTeamSeats.js';

async function findUserForCancel(supabase, { email, userId }) {
  const uid = userId != null && String(userId).trim() !== ''
    ? Number(userId)
    : null;

  if (uid && Number.isFinite(uid)) {
    const { data, error } = await supabase
      .from('team_table')
      .select('UserId, TeamId, CoachId, CoachTeamId')
      .eq('UserId', uid)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  if (email) {
    const { data, error } = await supabase
      .from('team_table')
      .select('UserId, TeamId, CoachId, CoachTeamId')
      .eq('Email', String(email).trim())
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  return null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, authorization, X-App-Version, X-App-Version-Code, X-App-Platform');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({
      success: false,
      error: 'Method not allowed',
    });
    return;
  }

  const { email, userId } = req.body || {};
  const uid = userId != null && String(userId).trim() !== ''
    ? Number(userId)
    : null;

  if (!email && !(uid && Number.isFinite(uid))) {
    res.status(400).json({
      success: false,
      error: 'Email or userId is required',
    });
    return;
  }

  try {
    const supabase = getSupabaseClient();
    const user = await findUserForCancel(supabase, { email, userId: uid });

    if (!user?.UserId) {
      res.status(404).json({
        success: false,
        error: 'User not found',
      });
      return;
    }

    const processedAt = nowUtc();
    await supabase
      .from('approval_requests_table')
      .update({ Status: 'cancelled', ProcessedAt: processedAt })
      .eq('RequesterId', user.UserId)
      .eq('Status', 'pending');

    const clearPayload = buildTeamTableClearOnCancelRequest({ coachId: user.CoachId });
    await supabase
      .from('team_table')
      .update(clearPayload)
      .eq('UserId', user.UserId);

    res.status(200).json({
      success: true,
      message: 'Request cancelled successfully',
      redirectTo: '/setup',
    });
  } catch (error) {
    console.error('Cancel request error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel request',
    });
  }
}
