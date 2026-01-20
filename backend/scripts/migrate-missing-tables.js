/**
 * Migrate Missing Tables to Supabase
 * 
 * This script creates the missing coach_teams_table and nutrition_table
 * in Supabase PostgreSQL.
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

async function migrateMissingTables() {
  const client = await pool.connect();

  try {
    console.log('🚀 Starting migration of missing tables...\n');

    // 1. Create coach_teams_table
    console.log('📋 Creating coach_teams_table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS coach_teams_table (
        id SERIAL PRIMARY KEY,
        coach_user_id INTEGER NOT NULL,
        coach_name VARCHAR(255) NOT NULL,
        member_user_id INTEGER NOT NULL,
        member_name VARCHAR(255) NOT NULL,
        relationship_type VARCHAR(50) DEFAULT 'coach-member',
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ coach_teams_table created\n');

    // 2. Create nutrition_table (if it's still used)
    console.log('📋 Creating nutrition_table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS nutrition_table (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        meal_type VARCHAR(100),
        food_items TEXT,
        calories NUMERIC(10,2),
        protein NUMERIC(10,2),
        carbs NUMERIC(10,2),
        fat NUMERIC(10,2),
        fiber NUMERIC(10,2),
        meal_time TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_deleted BOOLEAN DEFAULT FALSE
      )
    `);
    console.log('✅ nutrition_table created\n');

    // 3. Create indexes for performance
    console.log('📋 Creating indexes...');
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_coach_teams_coach_id 
      ON coach_teams_table(coach_user_id)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_coach_teams_member_id 
      ON coach_teams_table(member_user_id)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_nutrition_user_id 
      ON nutrition_table(user_id)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_nutrition_meal_time 
      ON nutrition_table(meal_time)
    `);
    
    console.log('✅ Indexes created\n');

    // 4. Verify tables were created
    console.log('🔍 Verifying tables...');
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('coach_teams_table', 'nutrition_table')
      ORDER BY table_name
    `);

    console.log(`✅ Found ${result.rows.length} tables:`);
    result.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📊 Summary:');
    console.log('   - coach_teams_table: Created with coach-member relationships');
    console.log('   - nutrition_table: Created for meal tracking (may be legacy)');
    console.log('   - Indexes: Created for optimal query performance');
    
    console.log('\n💡 Note: nutrition_table might be deprecated.');
    console.log('   food_nutrition_data_table is the primary table for nutrition data.');
    console.log('   Check if nutrition_table is still needed in your application.\n');

  } catch (error) {
    console.error('❌ Migration error:', error.message);
    console.error('Details:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

migrateMissingTables();
