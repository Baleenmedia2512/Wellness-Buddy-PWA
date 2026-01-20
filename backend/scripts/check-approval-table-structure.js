const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function checkColumns() {
  // Try to insert a test record to see what columns are expected
  const testRecord = {
    Id: 999999,
    RequesterId: 1,
    UplineCoachId: 1,
    Status: 'test'
  };
  
  const { data, error } = await supabase
    .from('approval_requests_table')
    .insert([testRecord])
    .select();
  
  if (error) {
    console.log('❌ Error (this tells us what columns exist):');
    console.log(error.message);
    console.log('\nDetails:', error.details);
    console.log('\nHint:', error.hint);
  } else {
    console.log('✅ Insert succeeded (cleaning up...)');
    await supabase.from('approval_requests_table').delete().eq('Id', 999999);
  }
}

checkColumns();
