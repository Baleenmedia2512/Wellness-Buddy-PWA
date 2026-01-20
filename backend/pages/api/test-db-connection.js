import { getSupabaseClient } from '../../utils/supabaseClient.js';

export default async function handler(req, res) {
  console.log('\n🧪🧪🧪 TEST-DB-CONNECTION ENDPOINT HIT 🧪🧪🧪\n');
  
  try {
    const supabase = getSupabaseClient();
    console.log('✅ Supabase client obtained, testing query...\n');
    
    // Test connection with a simple count query
    const { count, error } = await supabase
      .from('team_table')
      .select('*', { count: 'exact', head: true });
    
    if (error) throw error;
    
    console.log('\n✅✅✅ DATABASE TEST SUCCESSFUL! ✅✅✅');
    console.log('✅ team_table count:', count);
    
    res.status(200).json({ 
      success: true,
      message: 'Supabase connection successful!',
      timestamp: new Date().toISOString(),
      teamTableCount: count,
      connectionType: 'Supabase REST API'
    });
    return;
  } catch (error) {
    console.error('\n❌❌❌ DATABASE TEST FAILED! ❌❌❌');
    console.error('🚨 Error Message:', error.message);
    console.error('📍 Error Code:', error.code);
    console.error('=========================================\n');
    
    res.status(500).json({ 
      success: false,
      message: 'Supabase connection failed!',
      error: error.message,
      code: error.code
    });
    return;
  }
}
