/**
 * Check if a user should get team UI (search / Mine-Direct-Full).
 * GET /api/team/has-members?userId=123
 *
 * True when:
 * - any team_table row has CoachId = userId (own downline), OR
 * - user is Sponsor / Co-Sponsor on an active coach_teams row
 *   (shared-team lead — may have 0 own members but still sees partner roster UI)
 *
 * Used by Diary search, Programs enrollment search, Activity Report scope.
 */

import { getSupabaseClient } from '../../../utils/supabaseClient.js';
import { resolveLeadSeatForUser } from '../../../utils/coachTeamSeats.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, cache-control, pragma');
    res.status(200).end();
    return;
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, cache-control, pragma');

  if (req.method !== 'GET') {
    res.status(405).json({ success: false, message: 'Method not allowed' });
    return;
  }

  try {
    const userId = parseInt(req.query.userId, 10);
    if (!userId || Number.isNaN(userId)) {
      res.status(400).json({
        success: false,
        message: 'Valid userId is required',
      });
      return;
    }

    const supabase = getSupabaseClient();
    const { count, error } = await supabase
      .from('team_table')
      .select('UserId', { count: 'exact', head: true })
      .eq('CoachId', userId);

    if (error) {
      console.error('[has-members] Query error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to check team membership',
      });
      return;
    }

    const hasOwnDownline = (count ?? 0) > 0;
    let isSharedLead = false;
    if (!hasOwnDownline) {
      const seat = await resolveLeadSeatForUser(supabase, userId);
      isSharedLead = seat.seat === 'sponsor' || seat.seat === 'co-sponsor';
    }

    res.status(200).json({
      success: true,
      hasTeamMembers: hasOwnDownline || isSharedLead,
    });
  } catch (err) {
    console.error('[has-members] Server error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
}
