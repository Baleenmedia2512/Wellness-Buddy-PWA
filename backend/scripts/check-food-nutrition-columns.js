require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
  try {
    // Get one record to see all columns
    const { data, error } = await supabase
      .from('food_nutrition_data_table')
      .select('*')
      .limit(1);

    if (error) {
      console.error('Error:', error);
      return;
    }

    if (data && data.length > 0) {
      console.log('\n📋 Current columns in food_nutrition_data_table:');
      console.log('================================================');
      const columns = Object.keys(data[0]);
      columns.forEach((col, index) => {
        console.log(`${index + 1}. ${col}`);
      });
      console.log('================================================');
      console.log(`\nTotal columns: ${columns.length}`);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

checkColumns();
