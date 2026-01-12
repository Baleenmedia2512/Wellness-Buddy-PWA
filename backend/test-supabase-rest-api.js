/**
 * Test Supabase REST API Connection
 * This bypasses the blocked db.supabase.co ports and uses HTTPS instead
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// These need to be set in .env file
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lnvvaeudhtazvxtmifeg.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

console.log('🔍 Testing Supabase REST API (bypasses blocked ports)\n');
console.log('📋 Configuration:');
console.log('   URL:', SUPABASE_URL);
console.log('   ANON KEY:', SUPABASE_ANON_KEY ? `${SUPABASE_ANON_KEY.substring(0, 20)}...` : '❌ NOT SET');
console.log('');

if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY === 'YOUR_ANON_KEY_HERE_FROM_DASHBOARD') {
  console.log('❌ ERROR: SUPABASE_ANON_KEY not set!\n');
  console.log('📝 To fix this:');
  console.log('   1. Go to: https://supabase.com/dashboard/project/lnvvaeudhtazvxtmifeg/settings/api');
  console.log('   2. Copy the "anon" "public" key (starts with eyJ...)');
  console.log('   3. Add to .env file:');
  console.log('      SUPABASE_ANON_KEY=your_key_here');
  console.log('   4. Run this test again');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testConnection() {
  try {
    console.log('⏳ Testing connection to Supabase via REST API...\n');
    
    // Test 1: Simple query - get all columns first to see structure
    console.log('Test 1: Fetching from team_table (checking structure)...');
    const { data, error, count } = await supabase
      .from('team_table')
      .select('*', { count: 'exact' })
      .limit(1);
    
    if (error) {
      console.log('❌ Query error:', error.message);
      if (error.message.includes('relation') || error.message.includes('does not exist')) {
        console.log('\n⚠️  Table "team_table" might not exist or has different name');
        console.log('   Try checking table names in Supabase dashboard');
      }
      return;
    }
    
    console.log(`✅ Success! Found ${count} total records`);
    console.log(`✅ Retrieved ${data.length} records`);
    if (data.length > 0) {
      console.log('\n📊 Table structure (column names):');
      console.log(Object.keys(data[0]).join(', '));
      console.log('\n📊 Sample record:');
      console.log(JSON.stringify(data[0], null, 2));
    }
    
    // Test 2: Specific user lookup - adjust column names based on what we found
    console.log('\n---\nTest 2: Looking up specific user...');
    const { data: user, error: userError } = await supabase
      .from('team_table')
      .select('*')
      .eq('email', 'yasheeer.yash03@gmail.com')
      .maybeSingle();
    
    if (userError) {
      console.log('❌ Error:', userError.message);
    } else if (!user) {
      console.log('⚠️  User not found (this is okay for testing)');
    } else {
      console.log('✅ User found:');
      console.log(JSON.stringify(user, null, 2));
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ SUPABASE REST API CONNECTION SUCCESSFUL!');
    console.log('='.repeat(60));
    console.log('\n💡 This approach WORKS because it uses HTTPS (port 443)');
    console.log('   instead of direct PostgreSQL connection (blocked ports 5432/6543)');
    console.log('\n📝 Next steps:');
    console.log('   1. Update your API handlers to use Supabase client');
    console.log('   2. Replace dbPool.execute() calls with supabase queries');
    console.log('   3. Enjoy fast, unblocked database access!');
    
  } catch (error) {
    console.log('❌ Unexpected error:', error.message);
    console.log('\n🔍 Full error:', error);
  }
}

testConnection();
