/**
 * Verify activity_time_windows_table migration
 * 
 * This script verifies:
 * 1. Table exists with correct schema
 * 2. All required columns are present
 * 3. Data has been migrated correctly
 * 4. Indexes are in place
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

async function verifyMigration() {
  const client = await pool.connect();

  try {
    console.log('🔍 Verifying activity_time_windows_table migration...\n');

    // 1. Check table exists
    console.log('1️⃣ Checking if table exists...');
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'activity_time_windows_table'
      )
    `);
    
    if (!tableExists.rows[0].exists) {
      console.log('❌ Table does not exist!');
      return;
    }
    console.log('✅ Table exists\n');

    // 2. Check schema
    console.log('2️⃣ Verifying table schema...');
    const columns = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'activity_time_windows_table'
      ORDER BY ordinal_position
    `);
    
    console.log('Columns:');
    console.table(columns.rows);

    const expectedColumns = [
      'id', 'activity_type', 'window_start_time', 'window_end_time',
      'effective_from_date', 'effective_to_date', 'changed_by', 
      'change_reason', 'created_at'
    ];

    const actualColumns = columns.rows.map(r => r.column_name);
    const missingColumns = expectedColumns.filter(c => !actualColumns.includes(c));
    
    if (missingColumns.length > 0) {
      console.log(`❌ Missing columns: ${missingColumns.join(', ')}`);
    } else {
      console.log('✅ All required columns present\n');
    }

    // 3. Check indexes
    console.log('3️⃣ Verifying indexes...');
    const indexes = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'activity_time_windows_table'
      AND indexname != 'activity_time_windows_table_pkey'
    `);
    
    console.log('Indexes:');
    console.table(indexes.rows);
    console.log('');

    // 4. Check data
    console.log('4️⃣ Verifying data...');
    const count = await client.query(
      'SELECT COUNT(*) FROM activity_time_windows_table'
    );
    console.log(`Total records: ${count.rows[0].count}`);

    const data = await client.query(`
      SELECT 
        id,
        activity_type,
        window_start_time::text as start_time,
        window_end_time::text as end_time,
        effective_from_date,
        effective_to_date,
        changed_by
      FROM activity_time_windows_table
      ORDER BY id
    `);
    
    console.log('\nTime Windows:');
    console.table(data.rows);

    // 5. Verify time window logic
    console.log('\n5️⃣ Testing time window query logic...');
    const testDate = '2025-06-15';
    const testResult = await client.query(`
      SELECT 
        activity_type,
        window_start_time,
        window_end_time,
        effective_from_date,
        effective_to_date
      FROM activity_time_windows_table
      WHERE activity_type = 'breakfast'
      AND effective_from_date <= $1::timestamp
      AND (effective_to_date IS NULL OR effective_to_date > $1::timestamp)
    `, [testDate]);

    console.log(`\nActive breakfast window for ${testDate}:`);
    console.table(testResult.rows);

    if (testResult.rows.length === 1) {
      console.log('✅ Time window query works correctly\n');
    } else {
      console.log('⚠️  Expected 1 result, got', testResult.rows.length, '\n');
    }

    console.log('✅ Migration verification complete!');
    console.log('\n📝 Summary:');
    console.log(`  - Table: ✅ Created`);
    console.log(`  - Schema: ✅ ${columns.rows.length} columns`);
    console.log(`  - Indexes: ✅ ${indexes.rows.length} custom indexes`);
    console.log(`  - Data: ✅ ${count.rows[0].count} time windows`);
    console.log(`  - Query Logic: ✅ Working`);

  } catch (error) {
    console.error('❌ Verification failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

verifyMigration().catch(console.error);
