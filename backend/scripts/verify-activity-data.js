/**
 * Verify Activity Table Data Quality
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

async function verifyData() {
  const client = await pool.connect();

  try {
    console.log('🔍 Verifying activity_table data...\n');

    // Check total count
    const countResult = await client.query('SELECT COUNT(*) as count FROM activity_table');
    console.log(`✅ Total records: ${countResult.rows[0].count}\n`);

    // Check sample data
    console.log('📋 Sample records (latest 10):');
    const sampleResult = await client.query(`
      SELECT id, user_id, activity_type, activity_date, 
             to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') as created_at,
             is_deleted
      FROM activity_table 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    
    console.table(sampleResult.rows);

    // Check date range
    console.log('\n📅 Date Range:');
    const dateRange = await client.query(`
      SELECT 
        MIN(activity_date) as earliest_date,
        MAX(activity_date) as latest_date,
        COUNT(DISTINCT activity_date) as unique_dates
      FROM activity_table
    `);
    console.table(dateRange.rows);

    // Check users
    console.log('\n👥 User Distribution (Top 10):');
    const users = await client.query(`
      SELECT user_id, COUNT(*) as activity_count
      FROM activity_table
      GROUP BY user_id
      ORDER BY activity_count DESC
      LIMIT 10
    `);
    console.table(users.rows);

    // Check activity types
    console.log('\n📊 Activity Types:');
    const activities = await client.query(`
      SELECT activity_type, COUNT(*) as count
      FROM activity_table
      GROUP BY activity_type
      ORDER BY count DESC
    `);
    console.table(activities.rows);

    // Check for data issues
    console.log('\n🔍 Data Quality Checks:');
    
    const nullCheck = await client.query(`
      SELECT 
        COUNT(*) FILTER (WHERE user_id IS NULL) as null_users,
        COUNT(*) FILTER (WHERE activity_type IS NULL) as null_types,
        COUNT(*) FILTER (WHERE activity_date IS NULL) as null_dates
      FROM activity_table
    `);
    console.log('Null values:', nullCheck.rows[0]);

    const deletedCount = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_deleted = true) as deleted,
        COUNT(*) FILTER (WHERE is_deleted = false) as active
      FROM activity_table
    `);
    console.log('Deletion status:', deletedCount.rows[0]);

    console.log('\n✅ Verification complete!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

verifyData();
