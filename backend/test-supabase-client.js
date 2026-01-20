/**
 * Alternative: Use Supabase JavaScript Client (bypasses direct DB connection)
 * This uses REST API over HTTPS which is NOT blocked
 */

// Install: npm install @supabase/supabase-js

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Get these from Supabase Dashboard → Settings → API
const SUPABASE_URL = 'https://lnvvaeudhtazvxtmifeg.supabase.co';
const SUPABASE_ANON_KEY = 'GET_THIS_FROM_DASHBOARD'; // You need to get this

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testSupabaseClient() {
  console.log('🧪 Testing Supabase Client (REST API - bypasses direct DB)...\n');
  
  try {
    // Test query to team_table
    const { data, error } = await supabase
      .from('team_table')
      .select('UserId, UserName, Email, Status, Role')
      .eq('Email', 'yasheeer.yash03@gmail.com')
      .single();
    
    if (error) {
      console.log('❌ Query error:', error.message);
      if (error.message.includes('API key')) {
        console.log('\n⚠️  You need to set SUPABASE_ANON_KEY');
        console.log('   1. Go to https://supabase.com/dashboard');
        console.log('   2. Select your project');
        console.log('   3. Go to Settings → API');
        console.log('   4. Copy the "anon" "public" key');
        console.log('   5. Update this file with the key');
      }
      return;
    }
    
    console.log('✅ SUCCESS! User found via REST API:');
    console.log(JSON.stringify(data, null, 2));
    console.log('\n✅ This approach WORKS and bypasses the blocked ports!');
    console.log('💡 Consider migrating to @supabase/supabase-js for all DB operations');
    
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

testSupabaseClient();
