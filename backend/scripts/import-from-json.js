/**
 * Import ai_token_usage_table data from JSON file
 * 
 * Prerequisites:
 * 1. Export data from MySQL Workbench to JSON file
 * 2. Save as: scripts/ai_token_data.json
 * 3. Run this script
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

async function importFromJSON() {
  const client = await pool.connect();

  try {
    console.log('🚀 Starting import from JSON file...\n');

    // Read JSON file
    const jsonPath = path.join(__dirname, 'ai_token_data.json');
    console.log(`📂 Reading file: ${jsonPath}`);
    
    if (!fs.existsSync(jsonPath)) {
      console.error('❌ File not found: ai_token_data.json');
      console.log('\n📝 Please export data from MySQL Workbench:');
      console.log('   1. Run: SELECT * FROM ai_token_usage_table');
      console.log('   2. Click Export > Export to JSON');
      console.log('   3. Save as: scripts/ai_token_data.json');
      console.log('   4. Run this script again');
      return;
    }

    const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    console.log(`✅ Found ${jsonData.length} records in JSON file\n`);

    // Drop and recreate table
    console.log('📋 Dropping existing table...');
    await client.query('DROP TABLE IF EXISTS ai_token_usage_table CASCADE');
    console.log('✅ Table dropped\n');

    console.log('📋 Creating fresh table...');
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
    console.log('✅ Table created\n');

    // Create indexes
    console.log('📋 Creating indexes...');
    await client.query('CREATE INDEX idx_ai_token_usage_user_id ON ai_token_usage_table(user_id)');
    await client.query('CREATE INDEX idx_ai_token_usage_email ON ai_token_usage_table(email)');
    await client.query('CREATE INDEX idx_ai_token_usage_created_at ON ai_token_usage_table(created_at DESC)');
    await client.query('CREATE INDEX idx_ai_token_usage_operation_type ON ai_token_usage_table(operation_type)');
    console.log('✅ Indexes created\n');

    // Insert records
    console.log('💾 Inserting records...');
    let inserted = 0;

    for (const record of jsonData) {
      await client.query(`
        INSERT INTO ai_token_usage_table 
        (id, user_id, email, input_tokens, output_tokens, total_tokens, 
         operation_type, model_name, created_at, input_token_cost, 
         output_token_cost, total_token_cost)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        record.ID || record.id,
        record.UserId || record.user_id,
        record.Email || record.email,
        record.InputTokens || record.input_tokens,
        record.OutputTokens || record.output_tokens,
        record.TotalTokens || record.total_tokens,
        record.OperationType || record.operation_type,
        record.ModelName || record.model_name,
        record.CreatedAt || record.created_at,
        record.InputTokenCost || record.input_token_cost,
        record.OutputTokenCost || record.output_token_cost,
        record.TotalTokenCost || record.total_token_cost
      ]);
      
      inserted++;
      if (inserted % 10 === 0) {
        const progress = Math.round((inserted / jsonData.length) * 100);
        console.log(`  Progress: ${inserted}/${jsonData.length} (${progress}%)`);
      }
    }

    console.log(`\n✅ All ${inserted} records inserted\n`);

    // Update sequence
    console.log('📋 Updating ID sequence...');
    await client.query(`
      SELECT setval('ai_token_usage_table_id_seq', 
        (SELECT COALESCE(MAX(id), 1) FROM ai_token_usage_table), true)
    `);
    console.log('✅ Sequence updated\n');

    // Verify
    const count = await client.query('SELECT COUNT(*) FROM ai_token_usage_table');
    console.log(`📊 Total records in Supabase: ${count.rows[0].count}`);

    const summary = await client.query(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(DISTINCT operation_type) as unique_operations,
        SUM(total_tokens) as total_tokens,
        ROUND(SUM(total_token_cost)::numeric, 4) as total_cost
      FROM ai_token_usage_table
    `);

    console.log('\n📊 Summary:');
    console.table(summary.rows);

    console.log('\n✅ Import completed successfully!');
    console.log(`🎉 Migrated ${inserted} records from JSON to Supabase`);

  } catch (error) {
    console.error('❌ Import failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

importFromJSON().catch(console.error);
