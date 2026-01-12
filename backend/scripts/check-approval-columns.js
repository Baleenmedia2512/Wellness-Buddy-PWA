const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function checkColumns() {
  const { data, error } = await supabase
    .from('approval_requests_table')
    .select('*')
    .limit(0);
  
  console.log('Error:', error);
  console.log('Available columns from error:', error?.details || error?.hint || 'Check Supabase dashboard');
}

checkColumns();
