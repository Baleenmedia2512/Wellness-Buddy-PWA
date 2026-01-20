require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixColumns() {
  try {
    console.log('🔧 Fixing food_nutrition_data_table columns...\n');

    const sqlFile = path.join(__dirname, 'FIX_FOOD_NUTRITION_COLUMNS.sql');
    const sqlContent = fs.readFileSync(sqlFile, 'utf8');
    
    // Split by semicolon and execute each statement
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'));

    for (const statement of statements) {
      console.log(`Executing: ${statement.substring(0, 50)}...`);
      const { error } = await supabase.rpc('exec_sql', { sql: statement });
      
      if (error) {
        console.error('❌ Error:', error.message);
      } else {
        console.log('✅ Success');
      }
    }

    console.log('\n✨ Column cleanup completed!');
    
    // Verify columns
    console.log('\n📋 Verifying final columns...');
    const { data } = await supabase
      .from('food_nutrition_data_table')
      .select('*')
      .limit(1);

    if (data && data.length > 0) {
      const columns = Object.keys(data[0]);
      console.log('\nFinal columns:');
      columns.forEach((col, i) => console.log(`${i + 1}. ${col}`));
    }

  } catch (error) {
    console.error('💥 Error:', error);
  }
}

fixColumns();
