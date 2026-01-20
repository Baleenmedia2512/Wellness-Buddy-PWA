/**
 * Check and Migrate activity_table Data
 * 
 * This script checks MySQL dump for activity_table data and migrates it to Supabase
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

async function checkAndMigrateActivityTable() {
  const client = await pool.connect();

  try {
    console.log('🔍 Checking activity_table...\n');

    // 1. Check current data in Supabase
    const supabaseCheck = await client.query('SELECT COUNT(*) as count FROM activity_table');
    const currentCount = parseInt(supabaseCheck.rows[0].count);
    
    console.log(`📊 Current Supabase activity_table records: ${currentCount}`);

    if (currentCount > 0) {
      console.log('⚠️  Warning: activity_table already has data in Supabase.');
      const sample = await client.query('SELECT * FROM activity_table LIMIT 3');
      console.log('\n📋 Sample records:');
      sample.rows.forEach((row, i) => {
        console.log(`   ${i + 1}. ID: ${row.id}, User: ${row.user_id}, Type: ${row.activity_type}, Date: ${row.activity_date}`);
      });
      console.log('');
    }

    // 2. Read MySQL dump file
    console.log('📂 Reading MySQL dump file...');
    const dumpPath = path.join(__dirname, '..', '..', 'wellnessvalleyDump20260109.sql');
    
    if (!fs.existsSync(dumpPath)) {
      console.log('❌ MySQL dump file not found at:', dumpPath);
      return;
    }

    const dumpContent = fs.readFileSync(dumpPath, 'utf8');
    
    // 3. Extract INSERT statements for activity_table
    const insertPattern = /INSERT INTO `activity_table` VALUES \((.*?)\);/gs;
    const matches = [...dumpContent.matchAll(insertPattern)];
    
    console.log(`📊 Found ${matches.length} INSERT statements in MySQL dump\n`);

    if (matches.length === 0) {
      console.log('✅ No data to migrate. activity_table is empty in MySQL dump.');
      return;
    }

    // 4. Parse the INSERT data
    console.log('🔄 Parsing MySQL data...');
    let recordCount = 0;
    const records = [];

    for (const match of matches) {
      const valuesStr = match[1];
      // Parse individual records - MySQL format: (val1,val2,val3),(val1,val2,val3)...
      const recordPattern = /\(([^)]+)\)/g;
      const recordMatches = [...valuesStr.matchAll(recordPattern)];
      
      for (const recordMatch of recordMatches) {
        const values = recordMatch[1].split(',').map(v => {
          v = v.trim();
          // Remove quotes
          if ((v.startsWith("'") && v.endsWith("'")) || (v.startsWith('"') && v.endsWith('"'))) {
            v = v.slice(1, -1);
          }
          // Handle NULL
          if (v === 'NULL' || v === 'null') {
            return null;
          }
          return v;
        });

        // Map to activity_table structure
        // MySQL columns: ID, UserID, ActivityType, ActivityDate, ActivityTime, Duration, CaloriesBurned, Notes, CreatedAt, UpdatedAt, IsDeleted
        records.push({
          id: parseInt(values[0]) || null,
          user_id: values[1],
          activity_type: values[2],
          activity_date: values[3],
          activity_time: values[4],
          duration: values[5] ? parseInt(values[5]) : null,
          calories_burned: values[6] ? parseFloat(values[6]) : null,
          notes: values[7],
          created_at: values[8],
          updated_at: values[9],
          is_deleted: values[10] === '1' || values[10] === 'true'
        });
        recordCount++;
      }
    }

    console.log(`✅ Parsed ${recordCount} records\n`);

    if (recordCount === 0) {
      console.log('✅ No records to migrate.');
      return;
    }

    // 5. Show sample data before migration
    console.log('📋 Sample records to migrate:');
    records.slice(0, 3).forEach((rec, i) => {
      console.log(`   ${i + 1}. User: ${rec.user_id}, Type: ${rec.activity_type}, Date: ${rec.activity_date}`);
    });
    console.log('');

    // 6. Migrate data
    console.log('🚀 Starting migration to Supabase...');
    
    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const record of records) {
      try {
        await client.query(`
          INSERT INTO activity_table (
            user_id, activity_type, activity_date, activity_time, 
            duration, calories_burned, notes, created_at, updated_at, is_deleted
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT DO NOTHING
        `, [
          record.user_id,
          record.activity_type,
          record.activity_date,
          record.activity_time,
          record.duration,
          record.calories_burned,
          record.notes,
          record.created_at,
          record.updated_at,
          record.is_deleted
        ]);
        migratedCount++;
        
        if (migratedCount % 10 === 0) {
          process.stdout.write(`\r   Migrated: ${migratedCount}/${recordCount}`);
        }
      } catch (error) {
        if (error.code === '23505') { // Duplicate key
          skippedCount++;
        } else {
          errorCount++;
          console.error(`\n   Error migrating record:`, error.message);
        }
      }
    }

    console.log(`\n\n✅ Migration complete!\n`);
    console.log('📊 Summary:');
    console.log(`   Total records: ${recordCount}`);
    console.log(`   Migrated: ${migratedCount}`);
    console.log(`   Skipped (duplicates): ${skippedCount}`);
    console.log(`   Errors: ${errorCount}\n`);

    // 7. Verify final count
    const finalCheck = await client.query('SELECT COUNT(*) as count FROM activity_table');
    const finalCount = parseInt(finalCheck.rows[0].count);
    console.log(`📊 Final Supabase activity_table records: ${finalCount}\n`);

  } catch (error) {
    console.error('❌ Migration error:', error.message);
    console.error('Details:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

checkAndMigrateActivityTable();
