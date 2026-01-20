import { getSupabaseClient } from '../../utils/supabaseClient.js';

export default async function handler(req, res) {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ message: 'Method not allowed' });
    return;
  }

  try {
    // Use Supabase client
    const supabase = getSupabaseClient();

    // Get table counts
    const { count: teamCount, error: teamError } = await supabase
      .from('team_table')
      .select('*', { count: 'exact', head: true });

    if (teamError) throw teamError;

    const { count: otpCount, error: otpError } = await supabase
      .from('otp_tokens_table')
      .select('*', { count: 'exact', head: true });

    if (otpError) throw otpError;

    const { count: foodCount, error: foodError } = await supabase
      .from('food_nutrition_data_table')
      .select('*', { count: 'exact', head: true });

    if (foodError) throw foodError;
    
    // Get sample user
    const { data: sampleUser, error: userError } = await supabase
      .from('team_table')
      .select('UserId, UserName, Email')
      .limit(1);

    if (userError) throw userError;

    res.json({
      success: true,
      message: 'Supabase connection successful',
      environment: process.env.NODE_ENV || 'development',
      connectionType: 'Supabase REST API',
      counts: {
        team_table: teamCount || 0,
        otp_tokens_table: otpCount || 0,
        food_nutrition_data_table: foodCount || 0
      },
      sampleUser: sampleUser && sampleUser[0] ? sampleUser[0] : null,
      timestamp: new Date().toISOString()
    });
    return;

  } catch (error) {
    console.error('Database test error:', error);
    res.status(500).json({
      success: false,
      message: 'Supabase connection failed',
      error: error.message,
      code: error.code
    });
    return;
  }
}
