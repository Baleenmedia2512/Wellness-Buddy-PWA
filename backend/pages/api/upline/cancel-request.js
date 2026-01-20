/**
 * Cancel Upline Coach Approval Request
 * POST /api/upline/cancel-request
 * 
 * Cancels pending approval request, clears TeamId, updates status to 'cancelled'
 */

import { getSupabaseClient, getISTTimestamp } from '../../../utils/supabaseClient.js';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ 
      success: false, 
      error: 'Method not allowed' 
    });
    return;
  }

  const { email } = req.body;

  if (!email) {
    res.status(400).json({ 
      success: false, 
      error: 'Email is required' 
    });
    return;
  }

  try {
    const supabase = getSupabaseClient();
    
    // Get user ID
    const { data: userRows, error: userError } = await supabase
      .from('team_table')
      .select('UserId, TeamId')
      .eq('Email', email);

    if (userError) throw userError;

    if (!userRows || userRows.length === 0) {
      res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
      return;
    }

    const userId = userRows[0].UserId;

    // Update approval request status to 'cancelled'
    const processedAt = getISTTimestamp();
    await supabase
      .from('approval_requests_table')
      .update({ Status: 'cancelled', ProcessedAt: processedAt })
      .eq('RequesterId', userId)
      .eq('Status', 'pending');

    // Clear TeamId and UplineCoachId from team_table
    await supabase
      .from('team_table')
      .update({ TeamId: null, UplineCoachId: null })
      .eq('UserId', userId);

    res.status(200).json({
      success: true,
      message: 'Request cancelled successfully',
      redirectTo: '/setup'
    });
    return;

  } catch (error) {
    console.error('Cancel request error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to cancel request' 
    });
    return;
  }
}
