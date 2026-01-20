/**
 * Migrate activity_time_windows_table to Supabase
 * 
 * This script creates the activity_time_windows_table in Supabase PostgreSQL
 * and migrates data from MySQL workbench dump.
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

async function migrateTimeWindows() {
  const client = await pool.connect();

  try {
    console.log('🚀 Starting migration of activity_time_windows_table...\n');

    // 1. Drop existing table if it exists (since it has wrong schema)
    console.log('📋 Dropping existing table (if any)...');
    await client.query(`DROP TABLE IF EXISTS activity_time_windows_table CASCADE`);
    console.log('✅ Old table dropped\n');

    // 2. Create the table with correct schema
    console.log('📋 Creating activity_time_windows_table with versioning support...');
    await client.query(`
      CREATE TABLE activity_time_windows_table (
        id SERIAL PRIMARY KEY,
        activity_type VARCHAR(50) NOT NULL,
        window_start_time TIME NOT NULL,
        window_end_time TIME NOT NULL,
        effective_from_date TIMESTAMP NOT NULL,
        effective_to_date TIMESTAMP NULL,
        changed_by VARCHAR(100),
        change_reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ activity_time_windows_table created\n');

    // 3. Create indexes for performance
    console.log('📋 Creating indexes...');
    await client.query(`
      CREATE INDEX idx_activity_time_windows_activity_effective 
      ON activity_time_windows_table(activity_type, effective_from_date, effective_to_date)
    `);
    console.log('✅ Indexes created\n');

    // 4. Insert default time windows from MySQL dump
    console.log('📥 Inserting default time windows...');
    
    const timeWindows = [
      { id: 1, activity_type: 'weight', start: '03:00:00', end: '06:30:00', effective_from: '2025-01-01 00:00:00', changed_by: 'system' },
      { id: 2, activity_type: 'education', start: '07:15:00', end: '08:45:00', effective_from: '2025-01-01 00:00:00', changed_by: 'system' },
      { id: 3, activity_type: 'breakfast', start: '05:30:00', end: '08:30:00', effective_from: '2025-01-01 00:00:00', changed_by: 'system' },
      { id: 4, activity_type: 'lunch', start: '12:00:00', end: '16:00:00', effective_from: '2025-01-01 00:00:00', changed_by: 'system' },
      { id: 5, activity_type: 'dinner', start: '17:30:00', end: '20:30:00', effective_from: '2025-01-01 00:00:00', changed_by: 'system' }
    ];

    for (const window of timeWindows) {
      await client.query(`
        INSERT INTO activity_time_windows_table 
        (id, activity_type, window_start_time, window_end_time, effective_from_date, effective_to_date, changed_by, change_reason, created_at)
        VALUES ($1, $2, $3, $4, $5, NULL, $6, NULL, '2025-12-29 08:19:48')
      `, [
        window.id,
        window.activity_type,
        window.start,
        window.end,
        window.effective_from,
        window.changed_by
      ]);
      
      console.log(`  ✓ Inserted ${window.activity_type}: ${window.start} - ${window.end}`);
    }

    console.log('\n✅ All time windows inserted\n');

    // 5. Update sequence to continue from correct ID
    console.log('📋 Updating ID sequence...');
    await client.query(`
      SELECT setval('activity_time_windows_table_id_seq', 
        (SELECT MAX(id) FROM activity_time_windows_table), true)
    `);
    console.log('✅ Sequence updated\n');

    // 6. Verify migration
    console.log('🔍 Verifying migration...');
    const result = await client.query(`
      SELECT 
        id,
        activity_type,
        window_start_time,
        window_end_time,
        effective_from_date,
        effective_to_date,
        changed_by
      FROM activity_time_windows_table
      ORDER BY id
    `);

    console.log('\n📊 Migration Results:');
    console.table(result.rows);

    console.log('\n✅ Migration completed successfully!');
    console.log(`📈 Total records migrated: ${result.rows.length}`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migration
migrateTimeWindows().catch(console.error);
