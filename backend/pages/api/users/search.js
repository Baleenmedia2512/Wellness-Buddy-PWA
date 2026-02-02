/**
 * Search Coaches
 * GET /api/users/search?q={query}
 * 
 * Search for coaches by name or email
 * Only returns users with Role='admin' (coaches)
 * Used in upline coach selection
 */

import { getSupabaseClient } from '../../../utils/supabaseClient.js';

export default async function handler(req, res) {
  // Prevent browser/service worker caching of dynamic data
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  
  // Handle CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, authorization, cache-control, pragma');
    res.status(200).end();
    return;
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, authorization, cache-control, pragma');

  // Only allow GET requests
  if (req.method !== 'GET') {
    res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
    return;
  }

  try {
    // Get search query and current user email from URL params
    const { q, email: currentUserEmail } = req.query;

    if (!q || q.trim().length < 2) {
      res.status(400).json({
        success: false,
        error: 'Search query must be at least 2 characters'
      });
      return;
    }

    const searchQuery = q.trim();

    // Helper function to mask email like nam*****xyz@gmail.com
    const maskEmail = (email) => {
      if (!email) return '';
      const [localPart, domain] = email.split('@');
      if (localPart.length <= 6) {
        // Short email: show first 2 and last 1
        const visible = localPart.substring(0, 2);
        const last = localPart.substring(localPart.length - 1);
        return `${visible}***${last}@${domain}`;
      }
      // Longer email: show first 3 and last 3
      const start = localPart.substring(0, 3);
      const end = localPart.substring(localPart.length - 3);
      return `${start}*****${end}@${domain}`;
    };

    // Connect to Supabase
    const supabase = getSupabaseClient();

    // Search for coaches by name or email, excluding current user
    const { data: coaches, error } = await supabase
      .from('team_table')
      .select('UserId, UserName, Email, CoachName, TeamId')
      .eq('Status', 'Active')
      .neq('Email', currentUserEmail || '')
      .or(`UserName.ilike.%${searchQuery}%,Email.ilike.%${searchQuery}%`)
      // .or(`"UserName".ilike.%${searchQuery}%,"Email".ilike.%${searchQuery}%`)
      .order('UserName', { ascending: true })
      .limit(20);

    if (error) throw error;

    // Format results with masked email
    const results = (coaches || []).map(coach => ({
      userId: coach.UserId,
      userName: coach.UserName,
      email: maskEmail(coach.Email),
      displayName: coach.CoachName || coach.UserName,
      teamId: coach.TeamId,
      hasTeamId: !!coach.TeamId
    }));

    res.status(200).json({
      success: true,
      query: searchQuery,
      count: results.length,
      coaches: results,
      message: results.length === 0 ? 'No coaches found matching your search' : undefined
    });
    return;

  } catch (error) {
    console.error('Error searching coaches:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to search coaches',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
    return;
  }
}
