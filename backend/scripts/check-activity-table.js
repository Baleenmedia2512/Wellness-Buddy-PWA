/**
 * Quick Check - activity_table Data Status
 * 
 * Checks both MySQL dump and Supabase for activity_table data
 */

import pg from 'pg';
const { Pool } = pg;

// Supabase connection
const pool = new Pool({
  host: 'db.lnvvaeudhtazvxtmifeg.supabase.co',
  user: 'postgres',
  password: 'Wellness@123#@',
  database: 'postgres',
  port: 5432,
  ssl: {
    rejectUnauthorized: false
  }
});

async function quickCheck() {
  const client = await pool.connect();

  try {
    console.log('🔍 Checking activity_table status...\n');

    // Check Supabase
    const result = await client.query('SELECT COUNT(*) as count FROM activity_table');
    const count = parseInt(result.rows[0].count);
    
    console.log(`📊 Supabase activity_table records: ${count}\n`);

    if (count > 0) {
      console.log('✅ activity_table already has data. Sample records:');
      const sample = await client.query('SELECT * FROM activity_table ORDER BY created_at DESC LIMIT 5');
      sample.rows.forEach((row, i) => {
        console.log(`   ${i + 1}. ID: ${row.id}, User: ${row.user_id}, Type: ${row.activity_type}, Date: ${row.activity_date}`);
      });
    } else {
      console.log('📋 activity_table is currently empty.');
      console.log('💡 To migrate data:');
      console.log('   1. Check if MySQL has activity_table data');
      console.log('   2. Export using: mysqldump or MySQL Workbench');
      console.log('   3. Run migration script\n');
    }

    // Show table structure
    console.log('\n📋 Table structure:');
    const structure = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'activity_table'
      ORDER BY ordinal_position
    `);
    
    structure.rows.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

quickCheck();
