const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function showColumns() {
  // Get one record to see all columns
  const { data, error } = await supabase
    .from('approval_requests_table')
    .select('*')
    .limit(1);
  
  if (error) {
    console.log('❌ Error:', error.message);
  } else if (data && data.length > 0) {
    console.log('📋 Columns in approval_requests_table:');
    console.log('='.repeat(50));
    const columns = Object.keys(data[0]);
    columns.forEach((col, index) => {
      console.log(`${index + 1}. ${col}`);
    });
    console.log('='.repeat(50));
    console.log(`Total columns: ${columns.length}`);
    console.log('\nSample data:');
    console.log(JSON.stringify(data[0], null, 2));
  } else {
    console.log('⚠️  Table is empty, cannot determine columns from data');
  }
}

showColumns();
