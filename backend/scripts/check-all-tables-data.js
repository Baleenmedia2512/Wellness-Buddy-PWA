/**
 * Check all tables data status in Supabase
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

const EXPECTED_TABLES = [
  'activity_table',
  'admin_users',
  'athlete_table',
  'coach_teams_table',
  'feedback_table',
  'health_records',
  'nutritional_info',
  'nutrition_table',
  'personal_best_table',
  'profile_table',
  'settings',
  'team_details',
  'team_table',
  'tokens_monitoring',
  'User',
  'user_level_table',
  'user_profiles',
  'water_reminder_settings',
  'wellness_level_guide'
];

async function checkAllTables() {
  const client = await pool.connect();

  try {
    console.log('🔍 Checking all tables in Supabase...\n');
    console.log('=' .repeat(80));
    console.log('| Table Name                    | Status | Row Count | Has Data |');
    console.log('=' .repeat(80));

    let totalRecords = 0;
    let tablesWithData = 0;
    let emptyTables = 0;

    for (const tableName of EXPECTED_TABLES) {
      try {
        const result = await client.query(`SELECT COUNT(*) as count FROM ${tableName}`);
        const count = parseInt(result.rows[0].count);
        totalRecords += count;

        const status = count > 0 ? '✅' : '⚠️ ';
        const hasData = count > 0 ? 'YES' : 'NO';
        
        if (count > 0) tablesWithData++;
        else emptyTables++;

        console.log(`| ${tableName.padEnd(30)} | ${status}    | ${String(count).padStart(9)} | ${hasData.padEnd(8)} |`);
      } catch (error) {
        console.log(`| ${tableName.padEnd(30)} | ❌    | ERROR     | N/A      |`);
      }
    }

    console.log('=' .repeat(80));
    console.log('\n📊 Summary:');
    console.log(`   Total Tables: ${EXPECTED_TABLES.length}`);
    console.log(`   ✅ Tables with data: ${tablesWithData}`);
    console.log(`   ⚠️  Empty tables: ${emptyTables}`);
    console.log(`   📈 Total records across all tables: ${totalRecords.toLocaleString()}\n`);

    // Get top 5 tables by record count
    console.log('📊 Top 5 Tables by Record Count:');
    const topTables = [];
    for (const tableName of EXPECTED_TABLES) {
      try {
        const result = await client.query(`SELECT COUNT(*) as count FROM ${tableName}`);
        topTables.push({ name: tableName, count: parseInt(result.rows[0].count) });
      } catch (error) {
        // Skip
      }
    }
    topTables.sort((a, b) => b.count - a.count);
    topTables.slice(0, 5).forEach((table, idx) => {
      console.log(`   ${idx + 1}. ${table.name}: ${table.count.toLocaleString()} records`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkAllTables();
