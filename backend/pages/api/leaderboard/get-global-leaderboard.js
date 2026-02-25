import { getSupabaseClient } from '../../../utils/supabaseClient.js';

/**
 * Global Weight Loss Leaderboard API
 * Calculates weight loss (today vs yesterday) for all active users
 * Returns top performers sorted by weight loss (descending)
 * 
 * Logic:
 * - Only includes active users (Status = 'Active')
 * - Only includes users with weight loss > 0 (reduced weight)
 * - Compares most recent weight entry from today vs yesterday
 * - Returns: rank, profile (email for avatar), userName, coachName, weightLoss
 */
export default async function handler(req, res) {
  // Set CORS headers for all requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cache-Control, Pragma');
  
  // Prevent caching
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  // Handle CORS preflight
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

    // Get topN parameter (default to 3, max 7)
    const topN = Math.min(parseInt(req.query.topN) || 3, 7);

    console.log(`🏆 [LEADERBOARD] Calculating global weight loss leaderboard (Top ${topN})...`);

    // Step 1: Get all active users
    const { data: activeUsers, error: usersError } = await supabase
      .from('team_table')
      .select('UserId, UserName, Email, CoachName, Status')
      .ilike('Status', 'Active'); // Case-insensitive match for 'active' or 'Active'

    if (usersError) throw usersError;

    if (!activeUsers || activeUsers.length === 0) {
      console.log('⚠️ [LEADERBOARD] No active users found');
      return res.status(200).json({
        success: true,
        data: [],
        topN,
        message: 'No active users found'
      });
    }

    console.log(`✅ [LEADERBOARD] Found ${activeUsers.length} active users`);

    // Step 2: Calculate date ranges for today and yesterday (IST timezone)
    const now = new Date();
    
    // Today: Start of day (00:00:00) to end of day (23:59:59) in IST
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    // Yesterday: Start to end
    const yesterdayStart = new Date(now);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    yesterdayStart.setHours(0, 0, 0, 0);
    
    const yesterdayEnd = new Date(now);
    yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);
    yesterdayEnd.setHours(23, 59, 59, 999);

    // Format for database query (ISO format)
    const todayStartStr = todayStart.toISOString();
    const todayEndStr = todayEnd.toISOString();
    const yesterdayStartStr = yesterdayStart.toISOString();
    const yesterdayEndStr = yesterdayEnd.toISOString();

    console.log(`📅 [LEADERBOARD] Today: ${todayStartStr} to ${todayEndStr}`);
    console.log(`📅 [LEADERBOARD] Yesterday: ${yesterdayStartStr} to ${yesterdayEndStr}`);

    // Step 3: Calculate weight loss for each active user
    const leaderboardData = [];

    for (const user of activeUsers) {
      try {
        // Get today's latest weight
        const { data: todayWeights, error: todayError } = await supabase
          .from('weight_records_table')
          .select('Weight, CreatedAt')
          .eq('UserId', user.UserId)
          .gte('CreatedAt', todayStartStr)
          .lte('CreatedAt', todayEndStr)
          .or('IsDeleted.is.null,IsDeleted.eq.0')
          .order('CreatedAt', { ascending: false })
          .limit(1);

        if (todayError) throw todayError;

        // Get yesterday's latest weight
        const { data: yesterdayWeights, error: yesterdayError } = await supabase
          .from('weight_records_table')
          .select('Weight, CreatedAt')
          .eq('UserId', user.UserId)
          .gte('CreatedAt', yesterdayStartStr)
          .lte('CreatedAt', yesterdayEndStr)
          .or('IsDeleted.is.null,IsDeleted.eq.0')
          .order('CreatedAt', { ascending: false })
          .limit(1);

        if (yesterdayError) throw yesterdayError;

        // Calculate weight loss if both records exist
        if (todayWeights && todayWeights.length > 0 && 
            yesterdayWeights && yesterdayWeights.length > 0) {
          
          const todayWeight = parseFloat(todayWeights[0].Weight);
          const yesterdayWeight = parseFloat(yesterdayWeights[0].Weight);
          const weightLoss = yesterdayWeight - todayWeight; // Positive = weight lost

          // Only include users who have lost weight (weightLoss > 0)
          if (weightLoss > 0) {
            leaderboardData.push({
              userId: user.UserId,
              userName: user.UserName || 'Unknown',
              email: user.Email || '',
              coachName: user.CoachName || 'No Coach',
              weightLoss: parseFloat(weightLoss.toFixed(2)),
              todayWeight: parseFloat(todayWeight.toFixed(2)),
              yesterdayWeight: parseFloat(yesterdayWeight.toFixed(2)),
              todayDate: todayWeights[0].CreatedAt,
              yesterdayDate: yesterdayWeights[0].CreatedAt
            });
          }
        }
      } catch (userError) {
        console.error(`❌ [LEADERBOARD] Error processing user ${user.UserId}:`, userError.message);
        // Continue with other users
      }
    }

    // Step 4: Sort by weight loss (descending - highest first)
    leaderboardData.sort((a, b) => b.weightLoss - a.weightLoss);

    // Step 5: Limit to topN and add rank
    const topResults = leaderboardData.slice(0, topN).map((user, index) => ({
      rank: index + 1,
      userId: user.userId,
      userName: user.userName,
      email: user.email,
      coachName: user.coachName,
      weightLoss: user.weightLoss,
      todayWeight: user.todayWeight,
      yesterdayWeight: user.yesterdayWeight,
      comparison: 'Today vs Yesterday'
    }));

    console.log(`🏆 [LEADERBOARD] Top ${topResults.length} weight losers calculated`);
    console.table(topResults.map(u => ({
      Rank: u.rank,
      Name: u.userName,
      Coach: u.coachName,
      'Weight Loss': `${u.weightLoss} kg`,
      Today: `${u.todayWeight} kg`,
      Yesterday: `${u.yesterdayWeight} kg`
    })));

    res.status(200).json({
      success: true,
      data: topResults,
      topN,
      totalEligible: leaderboardData.length,
      calculatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [LEADERBOARD] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate leaderboard',
      error: error.message
    });
  }
}
