/**
 * Check Supabase PostgreSQL Tables
 * 
 * This script connects to Supabase and lists all existing tables with their row counts
 */

import dotenv from 'dotenv';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from backend/.env
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { Pool } = pg;

// Create PostgreSQL pool
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

async function checkSupabaseTables() {
  try {
    console.log('🔍 Connecting to Supabase PostgreSQL...');
    console.log(`Host: ${process.env.DB_HOST}`);
    console.log(`Database: ${process.env.DB_NAME}`);
    console.log(`User: ${process.env.DB_USER}\n`);

    // Test connection
    const client = await pool.connect();
    console.log('✅ Connection successful!\n');

    // Get all tables in the public schema
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;
    
    const result = await client.query(tablesQuery);
    const tables = result.rows;

    if (tables.length === 0) {
      console.log('⚠️  No tables found in the database.');
      client.release();
      return;
    }

    console.log(`📊 Found ${tables.length} tables:\n`);
    console.log('═══════════════════════════════════════════════════════════');
    console.log('Table Name'.padEnd(40) + 'Row Count');
    console.log('═══════════════════════════════════════════════════════════');

    // Get row count for each table
    for (const table of tables) {
      const tableName = table.table_name;
      try {
        const countResult = await client.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
        const count = countResult.rows[0].count;
        console.log(`${tableName.padEnd(40)}${count}`);
      } catch (error) {
        console.log(`${tableName.padEnd(40)}Error: ${error.message}`);
      }
    }

    console.log('═══════════════════════════════════════════════════════════\n');

    // Get table structures (columns) for verification
    console.log('📋 Table Structures:\n');
    for (const table of tables) {
      const tableName = table.table_name;
      try {
        const columnsQuery = `
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = $1
          ORDER BY ordinal_position;
        `;
        const columnsResult = await client.query(columnsQuery, [tableName]);
        
        console.log(`\n📝 ${tableName}:`);
        console.log('  Column Name'.padEnd(30) + 'Data Type'.padEnd(20) + 'Nullable');
        console.log('  ' + '─'.repeat(70));
        
        for (const col of columnsResult.rows) {
          const nullable = col.is_nullable === 'YES' ? 'Yes' : 'No';
          console.log(`  ${col.column_name.padEnd(30)}${col.data_type.padEnd(20)}${nullable}`);
        }
      } catch (error) {
        console.log(`  Error fetching columns: ${error.message}`);
      }
    }

    client.release();
    console.log('\n✅ Check complete!');

  } catch (error) {
    console.error('❌ Error checking Supabase tables:', error);
    console.error('\nDetails:', error.message);
  } finally {
    await pool.end();
  }
}

// Run the check
checkSupabaseTables();
