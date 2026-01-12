const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function findActualColumns() {
  console.log('Testing different column name combinations...\n');
  
  // Test 1: All PascalCase
  const test1 = await supabase.from('coach_teams_table').insert([{
    Id: 999,
    TeamId: 'TEST999',
    CoachId: 1,
    CoCoachId: 0,
    Status: 'active',
    CreatedAt: '2026-01-01 00:00:00',
    UpdatedAt: '2026-01-01 00:00:00'
  }]);
  
  if (!test1.error) {
    console.log('✅ SUCCESS with PascalCase!');
    await supabase.from('coach_teams_table').delete().eq('Id', 999);
    return;
  }
  
  console.log('❌ Test 1 (PascalCase):', test1.error.message);
  
  // Test 2: lowercase with underscores
  const test2 = await supabase.from('coach_teams_table').insert([{
    id: 999,
    team_id: 'TEST999',
    coach_id: 1,
    co_coach_id: 0,
    status: 'active',
    created_at: '2026-01-01 00:00:00',
    updated_at: '2026-01-01 00:00:00'
  }]);
  
  if (!test2.error) {
    console.log('✅ SUCCESS with snake_case!');
    await supabase.from('coach_teams_table').delete().eq('id', 999);
    return;
  }
  
  console.log('❌ Test 2 (snake_case):', test2.error.message);
  
  // Test 3: Minimal columns
  const test3 = await supabase.from('coach_teams_table').insert([{
    TeamId: 'TEST999',
    CoachId: 1,
    CoCoachId: 0,
    Status: 'active'
  }]);
  
  if (!test3.error) {
    console.log('✅ SUCCESS with minimal PascalCase (no timestamps)!');
    await supabase.from('coach_teams_table').delete().eq('TeamId', 'TEST999');
    return;
  }
  
  console.log('❌ Test 3 (minimal):', test3.error.message);
  console.log('Details:', test3.error.details);
  console.log('Hint:', test3.error.hint);
}

findActualColumns();
