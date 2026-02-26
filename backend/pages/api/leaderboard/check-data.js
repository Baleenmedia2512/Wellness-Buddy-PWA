/* LEADERBOARD FUNCTIONALITY COMMENTED OUT
import { getSupabaseClient } from '../../../utils/supabaseClient.js';

/**
 * Check Leaderboard Data Status
 * Shows what data exists and what's missing for leaderboard to work
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ success: false, message: 'Method not allowed' });
    return;
  }

  try {
    const supabase = getSupabaseClient();

    // Get active users
    const { data: activeUsers, error: usersError } = await supabase
      .from('team_table')
      .select('UserId, UserName, Email, CoachName, Status')
      .ilike('Status', 'Active');

    if (usersError) throw usersError;

    // Calculate today and yesterday dates
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);
    
    const yesterdayStart = new Date(now);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    yesterdayStart.setHours(0, 0, 0, 0);
    const yesterdayEnd = new Date(now);
    yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);
    yesterdayEnd.setHours(23, 59, 59, 999);

    // Check weight records for each user
    const userStatus = [];
    
    for (const user of activeUsers || []) {
      // Check today's records
      const { data: todayRecords } = await supabase
        .from('weight_records_table')
        .select('Weight, CreatedAt')
        .eq('UserId', user.UserId)
        .gte('CreatedAt', todayStart.toISOString())
        .lte('CreatedAt', todayEnd.toISOString());

      // Check yesterday's records
      const { data: yesterdayRecords } = await supabase
        .from('weight_records_table')
        .select('Weight, CreatedAt')
        .eq('UserId', user.UserId)
        .gte('CreatedAt', yesterdayStart.toISOString())
        .lte('CreatedAt', yesterdayEnd.toISOString());

      userStatus.push({
        userId: user.UserId,
        userName: user.UserName,
        email: user.Email,
        coach: user.CoachName,
        hasTodayWeight: todayRecords && todayRecords.length > 0,
        hasYesterdayWeight: yesterdayRecords && yesterdayRecords.length > 0,
        todayWeight: todayRecords?.[0]?.Weight || null,
        yesterdayWeight: yesterdayRecords?.[0]?.Weight || null,
        canShowInLeaderboard: todayRecords?.length > 0 && yesterdayRecords?.length > 0
      });
    }

    const eligibleUsers = userStatus.filter(u => u.canShowInLeaderboard);

    res.status(200).json({
      success: true,
      summary: {
        totalActiveUsers: activeUsers?.length || 0,
        usersWithTodayWeight: userStatus.filter(u => u.hasTodayWeight).length,
        usersWithYesterdayWeight: userStatus.filter(u => u.hasYesterdayWeight).length,
        eligibleForLeaderboard: eligibleUsers.length
      },
      dates: {
        today: todayStart.toISOString().split('T')[0],
        yesterday: yesterdayStart.toISOString().split('T')[0]
      },
      users: userStatus
    });

  } catch (error) {
    console.error('❌ [CHECK-DATA] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check data',
      error: error.message
    });
  }
}
*/
