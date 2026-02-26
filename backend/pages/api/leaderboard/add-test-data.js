import { getSupabaseClient } from '../../../utils/supabaseClient.js';

/**
 * TEST UTILITY: Add Sample Weight Loss Data
 * Creates test weight records for today and yesterday to populate leaderboard
 * 
 * WARNING: This is for TESTING ONLY. Remove before production.
 */
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, message: 'Method not allowed' });
    return;
  }

  try {
    const supabase = getSupabaseClient();

    console.log('🧪 [TEST-DATA] Creating sample weight loss data...');

    // Get first 5 active users
    const { data: activeUsers, error: usersError } = await supabase
      .from('team_table')
      .select('UserId, UserName, Email, CoachName')
      .ilike('Status', 'Active')
      .limit(5);

    if (usersError) throw usersError;

    if (!activeUsers || activeUsers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No active users found to add test data'
      });
    }

    console.log(`✅ [TEST-DATA] Found ${activeUsers.length} active users`);

    // Calculate date ranges
    const now = new Date();
    
    // Today's timestamp (current time)
    const todayTimestamp = now.toISOString();
    
    // Yesterday's timestamp (24 hours ago)
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayTimestamp = yesterday.toISOString();

    const insertedRecords = [];

    // Create weight records for each user
    for (let i = 0; i < activeUsers.length; i++) {
      const user = activeUsers[i];
      
      // Generate realistic weight data
      const baseWeight = 70 + (i * 5); // 70, 75, 80, 85, 90 kg
      const weightLoss = parseFloat((0.5 + (i * 0.4)).toFixed(1)); // 0.5, 0.9, 1.3, 1.7, 2.1 kg
      
      const yesterdayWeight = baseWeight;
      const todayWeight = baseWeight - weightLoss;

      try {
        // Insert yesterday's weight
        const { error: yesterdayError } = await supabase
          .from('weight_records_table')
          .insert({
            UserId: user.UserId,
            Weight: yesterdayWeight,
            CreatedAt: yesterdayTimestamp,
            UpdatedAt: yesterdayTimestamp,
            IsDeleted: 0
          });

        if (yesterdayError) throw yesterdayError;

        // Insert today's weight
        const { error: todayError } = await supabase
          .from('weight_records_table')
          .insert({
            UserId: user.UserId,
            Weight: todayWeight,
            CreatedAt: todayTimestamp,
            UpdatedAt: todayTimestamp,
            IsDeleted: 0
          });

        if (todayError) throw todayError;

        insertedRecords.push({
          userId: user.UserId,
          userName: user.UserName,
          coachName: user.CoachName || 'No Coach',
          yesterdayWeight,
          todayWeight,
          weightLoss
        });

        console.log(`✅ [TEST-DATA] Added weight records for ${user.UserName}: ${yesterdayWeight}kg → ${todayWeight}kg (-${weightLoss}kg)`);
      } catch (userError) {
        console.error(`❌ [TEST-DATA] Error for user ${user.UserId}:`, userError.message);
      }
    }

    console.log('\n🎉 [TEST-DATA] Sample data created successfully!\n');
    console.table(insertedRecords);

    res.status(200).json({
      success: true,
      message: `Created test weight records for ${insertedRecords.length} users`,
      data: insertedRecords,
      today: todayTimestamp,
      yesterday: yesterdayTimestamp
    });

  } catch (error) {
    console.error('❌ [TEST-DATA] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create test data',
      error: error.message
    });
  }
}
