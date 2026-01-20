const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function checkColumns() {
  const { data, error } = await supabase
    .from('coach_teams_table')
    .select('*')
    .limit(1);
  
  if (error) {
    console.log('❌ Error:', error.message);
    console.log('Hint:', error.hint);
    console.log('\n⚠️  The table might not exist or has wrong structure.');
  } else if (data && data.length > 0) {
    console.log('📋 Current columns in coach_teams_table:');
    Object.keys(data[0]).forEach((col, i) => console.log(`${i+1}. ${col}`));
  } else {
    console.log('⚠️  Table exists but is EMPTY - cannot determine columns from data');
    console.log('\nTrying test insert to see expected columns...');
    
    const testRecord = {
      Id: 999999,
      TeamId: 'TEST',
      CoachId: 1,
      CoCoachId: 0,
      Status: 'active'
    };
    
    const { error: insertError } = await supabase
      .from('coach_teams_table')
      .insert([testRecord]);
    
    if (insertError) {
      console.log('\n❌ Insert error reveals structure:');
      console.log(insertError.message);
      console.log('\nDetails:', insertError.details);
      console.log('Hint:', insertError.hint);
    } else {
      console.log('\n✅ Test insert worked! Cleaning up...');
      await supabase.from('coach_teams_table').delete().eq('Id', 999999);
    }
  }
}

checkColumns();
