// Test database connection
import { getPool } from './utils/dbPool.js';

console.log('🧪 Testing database connection...\n');

async function testConnection() {
  try {
    const pool = getPool();
    console.log('\n✅ Pool initialized, testing query...\n');
    
    const [rows] = await pool.execute('SELECT NOW() as time, current_database() as db, current_user as user, version() as version');
    
    console.log('\n✅✅✅ CONNECTION TEST SUCCESSFUL! ✅✅✅');
    console.log('Results:', rows);
    console.log('\nTesting team_table...');
    
    const [teamRows] = await pool.execute('SELECT COUNT(*) as count FROM team_table');
    console.log('✅ team_table accessible, rows:', teamRows[0].count);
    
    console.log('\n🎉 All tests passed!\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌❌❌ CONNECTION TEST FAILED! ❌❌❌');
    console.error('Error:', error.message);
    console.error('Code:', error.code);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testConnection();
