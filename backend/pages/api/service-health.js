import { getSupabaseClient } from '../../utils/supabaseClient.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ message: 'Method not allowed' });
    return;
  }

  try {
    // Test Supabase connection
    const supabase = getSupabaseClient();

    // Get service statistics
    const { count: totalCount, error: totalError } = await supabase
      .from('food_nutrition_data_table')
      .select('*', { count: 'exact', head: true });

    if (totalError) throw totalError;

    // Get today's count (using local date)
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    const { count: todayCount, error: todayError } = await supabase
      .from('food_nutrition_data_table')
      .select('*', { count: 'exact', head: true })
      .gte('CreatedAt', todayStr)
      .lt('CreatedAt', new Date(today.getTime() + 86400000).toISOString().split('T')[0]);

    if (todayError) throw todayError;

    // Get background service count
    const { count: backgroundCount, error: backgroundError } = await supabase
      .from('food_nutrition_data_table')
      .select('*', { count: 'exact', head: true })
      .eq('ProcessedBy', 'background_service');

    if (backgroundError) throw backgroundError;

    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        testQuery: rows[0].test === 1
      },
      statistics: {
        totalAnalyses: totalCount[0].total,
        todayAnalyses: todayCount[0].today,
        backgroundAnalyses: backgroundCount[0].background
      }
    });

  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
      database: {
        connected: false
      }
    });
  }
}
