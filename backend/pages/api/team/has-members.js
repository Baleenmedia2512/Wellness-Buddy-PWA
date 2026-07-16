/**
 * Check if a user is a coach by team_table linkage.
 * GET /api/team/has-members?userId=123
 *
 * Returns true when any row in team_table has CoachId equal to the given userId.
 * Used by the frontend to grant coach capabilities (e.g. enrollment member search)
 * without relying on the Role column.
 */

import { getSupabaseClient } from '../../../utils/supabaseClient.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

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

    res.status(200).json({
      success: true,
      hasTeamMembers: (count ?? 0) > 0,
    });
  } catch (err) {
    console.error('[has-members] Server error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
}
