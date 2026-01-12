import { getPool } from '../../utils/dbPool.js';

export default async function handler(req, res) {
  console.log('\n🧪🧪🧪 TEST-DB-CONNECTION ENDPOINT HIT 🧪🧪🧪\n');
  
  try {
    const pool = getPool();
    console.log('✅ Pool obtained, testing query...\n');
    
    const [rows] = await pool.execute('SELECT NOW() as time, current_database() as db, current_user as user_name');
    
    console.log('\n✅✅✅ DATABASE TEST SUCCESSFUL! ✅✅✅');
    console.log('DB Results:', rows);
    
    const [teamCount] = await pool.execute('SELECT COUNT(*) as count FROM team_table');
    console.log('✅ team_table count:', teamCount[0].count);
    
    return res.status(200).json({ 
      success: true,
      message: 'Database connection successful!',
      dbInfo: rows[0],
      teamTableCount: teamCount[0].count
    });
  } catch (error) {
    console.error('\n❌❌❌ DATABASE TEST FAILED! ❌❌❌');
    console.error('🚨 Error Message:', error.message);
    console.error('📍 Error Code:', error.code);
    console.error('🔍 Stack:', error.stack);
    console.error('=========================================\n');
    
    return res.status(500).json({ 
      success: false,
      message: 'Database connection failed!',
      error: error.message,
      code: error.code
    });
  }
}
