/**
 * Migrate ALL ai_token_usage_table records from MySQL to Supabase
 * 
 * This script connects to both databases and migrates all 158 records
 */

import pg from 'pg';
import mysql from 'mysql2/promise';
const { Pool } = pg;

// Supabase connection
const supabasePool = new Pool({
  host: 'db.lnvvaeudhtazvxtmifeg.supabase.co',
  user: 'postgres',
  password: 'Wellness@123#@',
  database: 'postgres',
  port: 5432,
  ssl: {
    rejectUnauthorized: false
  }
});

// MySQL connection
const mysqlConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'wellness_buddy'
};

async function migrateAllRecords() {
  let mysqlConn = null;
  let supabaseClient = null;

  try {
    console.log('🚀 Starting full migration of ai_token_usage_table...\n');

    // Connect to MySQL
    console.log('📡 Connecting to MySQL...');
    mysqlConn = await mysql.createConnection(mysqlConfig);
    console.log('✅ MySQL connected\n');

    // Connect to Supabase
    console.log('📡 Connecting to Supabase...');
    supabaseClient = await supabasePool.connect();
    console.log('✅ Supabase connected\n');

    // Get count from MySQL
    console.log('🔍 Checking MySQL record count...');
    const [countResult] = await mysqlConn.execute(
      'SELECT COUNT(*) as total FROM ai_token_usage_table'
    );
    const totalRecords = countResult[0].total;
    console.log(`📊 Found ${totalRecords} records in MySQL\n`);

    if (totalRecords === 0) {
      console.log('⚠️  No records to migrate!');
      return;
    }

    // Drop and recreate table in Supabase
    console.log('📋 Dropping existing Supabase table...');
    await supabaseClient.query('DROP TABLE IF EXISTS ai_token_usage_table CASCADE');
    console.log('✅ Table dropped\n');

    console.log('📋 Creating fresh table in Supabase...');
    await supabaseClient.query(`
      CREATE TABLE ai_token_usage_table (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        input_tokens INTEGER DEFAULT 0,
        output_tokens INTEGER DEFAULT 0,
        total_tokens INTEGER DEFAULT 0,
        operation_type VARCHAR(50) NOT NULL,
        model_name VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        input_token_cost DECIMAL(10,8) DEFAULT 0,
        output_token_cost DECIMAL(10,8) DEFAULT 0,
        total_token_cost DECIMAL(10,8) DEFAULT 0
      )
    `);
    console.log('✅ Table created\n');

    // Create indexes
    console.log('📋 Creating indexes...');
    await supabaseClient.query('CREATE INDEX idx_ai_token_usage_user_id ON ai_token_usage_table(user_id)');
    await supabaseClient.query('CREATE INDEX idx_ai_token_usage_email ON ai_token_usage_table(email)');
    await supabaseClient.query('CREATE INDEX idx_ai_token_usage_created_at ON ai_token_usage_table(created_at DESC)');
    await supabaseClient.query('CREATE INDEX idx_ai_token_usage_operation_type ON ai_token_usage_table(operation_type)');
    console.log('✅ Indexes created\n');

    // Fetch all records from MySQL
    console.log('📥 Fetching all records from MySQL...');
    const [rows] = await mysqlConn.execute(`
      SELECT 
        ID as id,
        UserId as user_id,
        Email as email,
        InputTokens as input_tokens,
        OutputTokens as output_tokens,
        TotalTokens as total_tokens,
        OperationType as operation_type,
        ModelName as model_name,
        CreatedAt as created_at,
        InputTokenCost as input_token_cost,
        OutputTokenCost as output_token_cost,
        TotalTokenCost as total_token_cost
      FROM ai_token_usage_table
      ORDER BY ID
    `);
    console.log(`✅ Fetched ${rows.length} records\n`);

    // Insert records in batches
    console.log('💾 Inserting records into Supabase...');
    const batchSize = 50;
    let inserted = 0;

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      
      for (const row of batch) {
        await supabaseClient.query(`
          INSERT INTO ai_token_usage_table 
          (id, user_id, email, input_tokens, output_tokens, total_tokens, 
           operation_type, model_name, created_at, input_token_cost, 
           output_token_cost, total_token_cost)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, [
          row.id,
          row.user_id,
          row.email,
          row.input_tokens,
          row.output_tokens,
          row.total_tokens,
          row.operation_type,
          row.model_name,
          row.created_at,
          row.input_token_cost,
          row.output_token_cost,
          row.total_token_cost
        ]);
        inserted++;
      }

      const progress = Math.round((inserted / rows.length) * 100);
      console.log(`  Progress: ${inserted}/${rows.length} (${progress}%)`);
    }

    console.log('\n✅ All records inserted\n');

    // Update sequence
    console.log('📋 Updating ID sequence...');
    await supabaseClient.query(`
      SELECT setval('ai_token_usage_table_id_seq', 
        (SELECT COALESCE(MAX(id), 1) FROM ai_token_usage_table), true)
    `);
    console.log('✅ Sequence updated\n');

    // Verify migration
    console.log('🔍 Verifying migration...\n');

    const supabaseCount = await supabaseClient.query(
      'SELECT COUNT(*) FROM ai_token_usage_table'
    );
    console.log(`MySQL Records: ${totalRecords}`);
    console.log(`Supabase Records: ${supabaseCount.rows[0].count}`);

    if (parseInt(supabaseCount.rows[0].count) === totalRecords) {
      console.log('✅ Record counts match!\n');
    } else {
      console.log('❌ Record counts do NOT match!\n');
    }

    // Summary statistics
    const summary = await supabaseClient.query(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(DISTINCT operation_type) as unique_operations,
        SUM(total_tokens) as total_tokens,
        SUM(total_token_cost) as total_cost,
        MIN(created_at) as oldest_record,
        MAX(created_at) as newest_record
      FROM ai_token_usage_table
    `);

    console.log('📊 Migration Summary:');
    console.table(summary.rows);

    // By operation type
    const byOp = await supabaseClient.query(`
      SELECT 
        operation_type,
        COUNT(*) as count,
        SUM(total_tokens) as total_tokens,
        ROUND(SUM(total_token_cost)::numeric, 4) as total_cost
      FROM ai_token_usage_table
      GROUP BY operation_type
      ORDER BY count DESC
    `);

    console.log('\n📊 By Operation Type:');
    console.table(byOp.rows);

    console.log('\n✅ Migration completed successfully!');
    console.log(`🎉 Migrated ${inserted} records from MySQL to Supabase`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    if (mysqlConn) {
      await mysqlConn.end();
      console.log('\n📡 MySQL connection closed');
    }
    if (supabaseClient) {
      supabaseClient.release();
      console.log('📡 Supabase connection closed');
    }
    await supabasePool.end();
  }
}

// Run migration
migrateAllRecords().catch(console.error);
