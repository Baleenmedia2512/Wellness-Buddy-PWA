/**
 * Check exact count differences
 */

import pg from 'pg';
const { Pool } = pg;

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

async function checkCounts() {
  const client = await pool.connect();

  try {
    console.log('🔍 Checking activity_table counts...\n');

    // Total count
    const total = await client.query('SELECT COUNT(*) FROM activity_table');
    console.log(`📊 Supabase Total: ${total.rows[0].count}`);
    console.log(`📊 Workbench Shows: 78,239`);
    console.log(`❌ Missing: ${78239 - parseInt(total.rows[0].count)} records\n`);

    // Check ID range
    const idRange = await client.query(`
      SELECT 
        MIN(id) as min_id,
        MAX(id) as max_id,
        MAX(id) - MIN(id) + 1 as expected_count,
        COUNT(*) as actual_count,
        (MAX(id) - MIN(id) + 1) - COUNT(*) as gaps
      FROM activity_table
    `);
    console.log('📋 ID Range Analysis:');
    console.table(idRange.rows);

    // Find missing IDs (if any gaps)
    if (idRange.rows[0].gaps > 0) {
      console.log('\n🔍 Finding missing ID sequences...');
      const missing = await client.query(`
        WITH RECURSIVE id_series AS (
          SELECT 1 AS id
          UNION ALL
          SELECT id + 1
          FROM id_series
          WHERE id < (SELECT MAX(id) FROM activity_table)
        )
        SELECT id_series.id as missing_id
        FROM id_series
        LEFT JOIN activity_table ON id_series.id = activity_table.id
        WHERE activity_table.id IS NULL
        ORDER BY id_series.id
        LIMIT 50
      `);
      console.log(`Found ${missing.rows.length} missing IDs (showing first 50):`);
      console.log(missing.rows.map(r => r.missing_id).join(', '));
    }

    // Check most recent records
    console.log('\n📅 Most Recent Records by ID:');
    const recent = await client.query(`
      SELECT id, user_id, activity_type, 
             to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') as created_at
      FROM activity_table
      ORDER BY id DESC
      LIMIT 10
    `);
    console.table(recent.rows);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkCounts();
