/**
 * Migrate ai_token_usage_table to Supabase
 * 
 * This script:
 * 1. Drops the existing table with incorrect schema
 * 2. Creates the table with correct MySQL-compatible schema
 * 3. Migrates data from the MySQL dump
 * 
 * Schema from MySQL:
 * - ID (PK, auto-increment)
 * - UserId (VARCHAR 255)
 * - Email (VARCHAR 255)  
 * - InputTokens (INT)
 * - OutputTokens (INT)
 * - TotalTokens (INT)
 * - OperationType (VARCHAR 50) - food_analysis, weight_detection
 * - ModelName (VARCHAR 100) - gemini-2.5-flash-lite
 * - CreatedAt (TIMESTAMP)
 * - InputTokenCost (DECIMAL 10,8)
 * - OutputTokenCost (DECIMAL 10,8)
 * - TotalTokenCost (DECIMAL 10,8)
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

// Sample data from MySQL dump
const sampleRecords = [
  { id: 1, userId: '123', email: 'testuser@example.com', inputTokens: 1037, outputTokens: 146, totalTokens: 1183, operationType: 'food_analysis', modelName: 'gemini-2.5-flash-lite', createdAt: '2025-12-16 12:43:59', inputTokenCost: 0.007, outputTokenCost: 0.0397, totalTokenCost: 0.0467 },
  { id: 2, userId: '123', email: 'testuser@example.com', inputTokens: 850, outputTokens: 120, totalTokens: 970, operationType: 'weight_detection', modelName: 'gemini-2.5-flash-lite', createdAt: '2025-12-16 11:43:59', inputTokenCost: 0.0058, outputTokenCost: 0.0326, totalTokenCost: 0.0384 },
  { id: 3, userId: '339', email: 'yasheeer.yash03@gmail.com', inputTokens: 914, outputTokens: 393, totalTokens: 1307, operationType: 'image_analysis', modelName: 'gemini-2.5-flash-lite', createdAt: '2025-12-22 12:55:13', inputTokenCost: 0.0001, outputTokenCost: 0.0001, totalTokenCost: 0.0002 },
  { id: 4, userId: '339', email: 'yasheeer.yash03@gmail.com', inputTokens: 671, outputTokens: 72, totalTokens: 743, operationType: 'weight_detection', modelName: 'gemini-2.5-flash-lite', createdAt: '2025-12-22 12:55:35', inputTokenCost: 0.0001, outputTokenCost: 0.0001, totalTokenCost: 0.0002 }
];

async function migrateTokenUsage() {
  const client = await pool.connect();

  try {
    console.log('🚀 Starting migration of ai_token_usage_table...\n');

    // 1. Drop existing table with wrong schema
    console.log('📋 Dropping existing table (if any)...');
    await client.query(`DROP TABLE IF EXISTS ai_token_usage_table CASCADE`);
    console.log('✅ Old table dropped\n');

    // 2. Create the table with correct MySQL-compatible schema
    console.log('📋 Creating ai_token_usage_table with correct schema...');
    await client.query(`
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
    console.log('✅ ai_token_usage_table created\n');

    // 3. Create indexes for performance
    console.log('📋 Creating indexes...');
    await client.query(`
      CREATE INDEX idx_ai_token_usage_user_id 
      ON ai_token_usage_table(user_id)
    `);
    await client.query(`
      CREATE INDEX idx_ai_token_usage_email 
      ON ai_token_usage_table(email)
    `);
    await client.query(`
      CREATE INDEX idx_ai_token_usage_created_at 
      ON ai_token_usage_table(created_at DESC)
    `);
    await client.query(`
      CREATE INDEX idx_ai_token_usage_operation_type 
      ON ai_token_usage_table(operation_type)
    `);
    console.log('✅ Indexes created\n');

    // 4. Insert sample data from MySQL dump
    console.log('📥 Inserting sample records from MySQL dump...');
    
    for (const record of sampleRecords) {
      await client.query(`
        INSERT INTO ai_token_usage_table 
        (id, user_id, email, input_tokens, output_tokens, total_tokens, 
         operation_type, model_name, created_at, input_token_cost, 
         output_token_cost, total_token_cost)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        record.id,
        record.userId,
        record.email,
        record.inputTokens,
        record.outputTokens,
        record.totalTokens,
        record.operationType,
        record.modelName,
        record.createdAt,
        record.inputTokenCost,
        record.outputTokenCost,
        record.totalTokenCost
      ]);
      
      console.log(`  ✓ Inserted record ${record.id}: ${record.operationType} by ${record.email}`);
    }

    console.log('\n✅ All sample records inserted\n');

    // 5. Update sequence to continue from correct ID
    console.log('📋 Updating ID sequence...');
    await client.query(`
      SELECT setval('ai_token_usage_table_id_seq', 
        (SELECT COALESCE(MAX(id), 1) FROM ai_token_usage_table), true)
    `);
    console.log('✅ Sequence updated\n');

    // 6. Verify migration
    console.log('🔍 Verifying migration...');
    
    // Check total records
    const count = await client.query('SELECT COUNT(*) FROM ai_token_usage_table');
    console.log(`Total records: ${count.rows[0].count}\n`);

    // Check summary statistics
    const summary = await client.query(`
      SELECT 
        SUM(input_tokens) as total_input_tokens,
        SUM(output_tokens) as total_output_tokens,
        SUM(total_tokens) as total_tokens,
        SUM(total_token_cost) as total_cost,
        COUNT(*) as request_count,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(DISTINCT operation_type) as unique_operations
      FROM ai_token_usage_table
    `);
    
    console.log('📊 Summary Statistics:');
    console.table(summary.rows);

    // Check by operation type
    const byOperation = await client.query(`
      SELECT 
        operation_type,
        COUNT(*) as count,
        SUM(total_tokens) as total_tokens,
        SUM(total_token_cost) as total_cost
      FROM ai_token_usage_table
      GROUP BY operation_type
      ORDER BY count DESC
    `);
    
    console.log('\n📊 By Operation Type:');
    console.table(byOperation.rows);

    // Get sample records
    const samples = await client.query(`
      SELECT 
        id,
        user_id,
        email,
        operation_type,
        total_tokens,
        total_token_cost,
        created_at
      FROM ai_token_usage_table
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    console.log('\n📋 Sample Records (Most Recent):');
    console.table(samples.rows);

    console.log('\n✅ Migration completed successfully!');
    console.log(`📈 Total records migrated: ${count.rows[0].count}`);
    console.log('\n💡 Note: Only sample data from MySQL dump was migrated.');
    console.log('   If you have more records in MySQL, you can extend the sampleRecords array.');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migration
migrateTokenUsage().catch(console.error);
