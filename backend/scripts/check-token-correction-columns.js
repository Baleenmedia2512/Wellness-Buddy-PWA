require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
  try {
    // Get one record to see all columns
    const { data, error } = await supabase
      .from('token_correction_table')
      .select('*')
      .limit(1);

    if (error) {
      console.error('Error:', error);
      return;
    }

    if (data && data.length > 0) {
      console.log('\n📋 Current columns in token_correction table:');
      console.log('================================================');
      const columns = Object.keys(data[0]);
      columns.forEach((col, index) => {
        console.log(`${index + 1}. ${col}`);
      });
      console.log('================================================');
      console.log(`\nTotal columns: ${columns.length}`);
    } else {
      console.log('\n⚠️  No records found in token_correction table');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

checkColumns();
