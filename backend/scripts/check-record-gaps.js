/**
 * Check for records with null or problematic dates
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

async function checkRecords() {
  const client = await pool.connect();

  try {
    console.log('🔍 Checking activity_table records...\n');

    // Get exact count
    const count = await client.query('SELECT COUNT(*) as count FROM activity_table');
    console.log(`Total records: ${count.rows[0].count}\n`);

    // Check ID range
    const idRange = await client.query(`
      SELECT MIN(id) as min_id, MAX(id) as max_id, MAX(id) - MIN(id) + 1 as expected_count
      FROM activity_table
    `);
    console.log('ID Range:', idRange.rows[0]);
    console.log(`Expected records (based on ID range): ${idRange.rows[0].expected_count}`);
    console.log(`Actual records: ${count.rows[0].count}`);
    console.log(`Missing IDs: ${parseInt(idRange.rows[0].expected_count) - parseInt(count.rows[0].count)}\n`);

    // Check for gaps in IDs
    const gaps = await client.query(`
      WITH RECURSIVE id_range AS (
        SELECT MIN(id) as id FROM activity_table
        UNION ALL
        SELECT id + 1 FROM id_range WHERE id < (SELECT MAX(id) FROM activity_table)
      )
      SELECT id as missing_id
      FROM id_range
      WHERE id NOT IN (SELECT id FROM activity_table)
      LIMIT 20
    `);
    
    if (gaps.rows.length > 0) {
      console.log('Sample missing IDs:');
      console.table(gaps.rows.slice(0, 10));
    }

    // Check oldest and newest records
    console.log('\n📅 Oldest records:');
    const oldest = await client.query(`
      SELECT id, user_id, activity_type, activity_date, created_at
      FROM activity_table
      ORDER BY id ASC
      LIMIT 5
    `);
    console.table(oldest.rows);

    console.log('\n📅 Newest records:');
    const newest = await client.query(`
      SELECT id, user_id, activity_type, activity_date, created_at
      FROM activity_table
      ORDER BY id DESC
      LIMIT 5
    `);
    console.table(newest.rows);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkRecords();
