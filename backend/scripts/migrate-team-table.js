/**
 * Migrate team_table data from teamtables.json to Supabase
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

async function migrateTeamTable() {
  const client = await pool.connect();

  try {
    console.log('🚀 Starting migration of team_table...\n');

    // Read JSON file
    const jsonPath = path.join(__dirname, '..', '..', 'teamtables.json');
    console.log(`📂 Reading file: ${jsonPath}`);
    
    const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    console.log(`✅ Found ${jsonData.length} records in JSON file\n`);

    // Check if table exists
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'team_table'
      )
    `);

    if (tableExists.rows[0].exists) {
      console.log('📋 Table already exists, checking current records...');
      const currentCount = await client.query('SELECT COUNT(*) FROM team_table');
      console.log(`Current records: ${currentCount.rows[0].count}\n`);
      
      console.log('📋 Dropping existing table...');
      await client.query('DROP TABLE IF EXISTS team_table CASCADE');
      console.log('✅ Table dropped\n');
    }

    // Create table
    console.log('📋 Creating team_table...');
    await client.query(`
      CREATE TABLE team_table (
        entry_date_time TIMESTAMP,
        entry_user VARCHAR(255),
        user_id INTEGER PRIMARY KEY,
        user_name VARCHAR(255) NOT NULL,
        password VARCHAR(255),
        target_weight_in_kg DECIMAL(10,4),
        coach_name VARCHAR(255),
        co_coach_name VARCHAR(255),
        status VARCHAR(50),
        coach_approved INTEGER,
        email VARCHAR(255),
        role VARCHAR(50),
        diet_type VARCHAR(100),
        height DECIMAL(10,2),
        team_id VARCHAR(100),
        upline_coach_id INTEGER
      )
    `);
    console.log('✅ team_table created\n');

    // Create indexes
    console.log('📋 Creating indexes...');
    await client.query('CREATE INDEX idx_team_user_name ON team_table(user_name)');
    await client.query('CREATE INDEX idx_team_coach_name ON team_table(coach_name)');
    await client.query('CREATE INDEX idx_team_status ON team_table(status)');
    await client.query('CREATE INDEX idx_team_email ON team_table(email)');
    console.log('✅ Indexes created\n');

    // Insert records
    console.log('💾 Inserting records...');
    let inserted = 0;
    let skipped = 0;

    for (const record of jsonData) {
      try {
        // Handle invalid dates
        let entryDateTime = record.EntryDateTime;
        if (entryDateTime === '0000-00-00 00:00:00' || !entryDateTime) {
          entryDateTime = null;
        }

        await client.query(`
          INSERT INTO team_table 
          (entry_date_time, entry_user, user_id, user_name, password, 
           TargetWeightInKg, coach_name, co_coach_name, status, 
           coach_approved, email, role, diet_type, height, team_id, upline_coach_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        `, [
          entryDateTime,
          record.EntryUser || null,
          record.UserId,
          record.UserName,
          record.Password || null,
          record['TargetWeightInKg'] || 0,
          record.CoachName || null,
          record.CoCoachName || null,
          record.Status || 'Active',
          record.CoachApproved || 0,
          record.Email || null,
          record.Role || 'user',
          record.DietType || null,
          record.Height || 0,
          record.TeamId || null,
          record.UplineCoachId || 0
        ]);
        
        inserted++;
        if (inserted % 20 === 0) {
          const progress = Math.round((inserted / jsonData.length) * 100);
          console.log(`  Progress: ${inserted}/${jsonData.length} (${progress}%)`);
        }
      } catch (err) {
        console.log(`  ⚠️  Skipped record ${record.UserId}: ${err.message}`);
        skipped++;
      }
    }

    console.log(`\n✅ Inserted ${inserted} records`);
    if (skipped > 0) {
      console.log(`⚠️  Skipped ${skipped} records\n`);
    }

    // Verify
    console.log('\n🔍 Verifying migration...\n');
    
    const count = await client.query('SELECT COUNT(*) FROM team_table');
    console.log(`Total records in Supabase: ${count.rows[0].count}`);

    // Summary by status
    const byStatus = await client.query(`
      SELECT 
        status,
        COUNT(*) as count
      FROM team_table
      GROUP BY status
      ORDER BY count DESC
    `);
    
    console.log('\n📊 By Status:');
    console.table(byStatus.rows);

    // Summary by coach
    const byCoach = await client.query(`
      SELECT 
        coach_name,
        COUNT(*) as team_members
      FROM team_table
      WHERE coach_name IS NOT NULL AND coach_name != ''
      GROUP BY coach_name
      ORDER BY team_members DESC
      LIMIT 10
    `);
    
    console.log('\n📊 Top 10 Coaches by Team Size:');
    console.table(byCoach.rows);

    // Sample records
    const samples = await client.query(`
      SELECT 
        user_id,
        user_name,
        coach_name,
        status,
        target_weight_in_kg
      FROM team_table
      ORDER BY user_id
      LIMIT 10
    `);
    
    console.log('\n📋 Sample Records (First 10):');
    console.table(samples.rows);

    console.log('\n✅ Migration completed successfully!');
    console.log(`🎉 Migrated ${inserted} team records to Supabase`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrateTeamTable().catch(console.error);
