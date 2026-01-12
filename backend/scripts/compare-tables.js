/**
 * Compare MySQL and Supabase Tables
 * 
 * This script compares tables in MySQL dump with Supabase to find missing tables
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

// Expected tables from MySQL dump
const mysqlTables = [
  'activity_table',
  'activity_time_windows_table',
  'ai_token_usage_table',
  'approval_requests_table',
  'coach_teams_table',
  'data_table',
  'discipline_table',
  'disease_table',
  'education_logs_table',
  'enquiry_table',
  'food_corrections_table',
  'food_nutrition_data_table',
  'member_table',
  'nutrition_table',
  'otp_tokens_table',
  'report_table',
  'team_table',
  'token_correction_table',
  'weight_records_table'
].sort();

async function compareTables() {
  try {
    console.log('🔍 Comparing MySQL dump with Supabase tables...\n');

    // Get Supabase tables
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    const supabaseTables = result.rows.map(r => r.table_name).sort();

    console.log(`📊 MySQL Dump: ${mysqlTables.length} tables`);
    console.log(`📊 Supabase:   ${supabaseTables.length} tables\n`);

    // Find missing tables
    const missingInSupabase = mysqlTables.filter(t => !supabaseTables.includes(t));
    const extraInSupabase = supabaseTables.filter(t => !mysqlTables.includes(t));

    if (missingInSupabase.length > 0) {
      console.log('❌ Missing in Supabase:');
      missingInSupabase.forEach(table => {
        console.log(`   - ${table}`);
      });
      console.log('');
    }

    if (extraInSupabase.length > 0) {
      console.log('➕ Extra in Supabase (not in MySQL dump):');
      extraInSupabase.forEach(table => {
        console.log(`   - ${table}`);
      });
      console.log('');
    }

    if (missingInSupabase.length === 0 && extraInSupabase.length === 0) {
      console.log('✅ All tables match perfectly!');
    }

    console.log('\n📋 Complete Table List:');
    console.log('═'.repeat(70));
    console.log('Table Name'.padEnd(40) + 'MySQL'.padEnd(10) + 'Supabase');
    console.log('═'.repeat(70));

    const allTables = [...new Set([...mysqlTables, ...supabaseTables])].sort();
    allTables.forEach(table => {
      const inMySQL = mysqlTables.includes(table) ? '✅' : '❌';
      const inSupabase = supabaseTables.includes(table) ? '✅' : '❌';
      console.log(`${table.padEnd(40)}${inMySQL.padEnd(10)}${inSupabase}`);
    });
    console.log('═'.repeat(70));

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

compareTables();
