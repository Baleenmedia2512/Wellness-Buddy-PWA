/**
 * Fresh Activity Table Migration
 * Migrates ALL activity_table data from MySQL dump to Supabase
 * Handles invalid dates by converting them to NULL
 */

import pg from 'pg';
import fs from 'fs';
import readline from 'readline';

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

let totalRecords = 0;
let successCount = 0;
let errorCount = 0;
let invalidDateCount = 0;
let batchData = [];
const BATCH_SIZE = 50;

async function processBatch(client) {
  if (batchData.length === 0) return;

  const currentBatch = batchData.splice(0, BATCH_SIZE);

  try {
    const values = currentBatch.map((record, idx) => {
      const offset = idx * 11;
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11})`;
    }).join(',');

    const query = `
      INSERT INTO activity_table (
        activity_date, user_id, id, activity_type, created_at, 
        is_deleted, activity_time, duration, calories_burned, notes, updated_at
      ) VALUES ${values}
      ON CONFLICT (id) DO UPDATE SET
        activity_date = EXCLUDED.activity_date,
        user_id = EXCLUDED.user_id,
        activity_type = EXCLUDED.activity_type,
        created_at = EXCLUDED.created_at,
        is_deleted = EXCLUDED.is_deleted,
        updated_at = EXCLUDED.updated_at
    `;

    const params = currentBatch.flatMap(r => [
      r.activity_date,
      r.user_id,
      r.id,
      r.activity_type,
      r.created_at,
      r.is_deleted,
      null,
      null,
      null,
      null,
      r.created_at
    ]);

    await client.query(query, params);
    successCount += currentBatch.length;
    process.stdout.write(`\r✅ Migrated: ${successCount}/${totalRecords} | Invalid dates handled: ${invalidDateCount}`);
  } catch (error) {
    console.error(`\n❌ Batch error (${currentBatch.length} records):`, error.message);
    errorCount += currentBatch.length;
  }

  if (batchData.length > 0) {
    await processBatch(client);
  }
}

function parseInsertValue(valueStr) {
  const regex = /\('([^']+)','([^']+)',(\d+),'([^']+)','([^']+)',([01])\)/g;
  const matches = [];
  let match;
  
  while ((match = regex.exec(valueStr)) !== null) {
    let activityDate = match[1];
    let createdAt = match[5];
    
    // Handle invalid MySQL dates - use created_at date or 1900-01-01
    if (activityDate === '0000-00-00') {
      // Extract date from timestamp if available
      if (createdAt && createdAt !== '0000-00-00 00:00:00') {
        activityDate = createdAt.split(' ')[0];
      } else {
        activityDate = '1900-01-01'; // Placeholder for truly invalid dates
      }
      invalidDateCount++;
    }
    
    matches.push({
      activity_date: activityDate,
      user_id: match[2],
      id: parseInt(match[3]),
      activity_type: match[4],
      created_at: createdAt,
      is_deleted: match[6] === '1'
    });
  }
  
  return matches;
}

async function migrateActivityData() {
  const client = await pool.connect();
  
  console.log('🚀 Starting FRESH activity_table migration...\n');
  console.log('📁 Reading from: wellnessvalleyDump20260109.sql');
  console.log('🎯 Target: Supabase activity_table\n');

  try {
    // Clear existing data
    console.log('🧹 Clearing existing data...');
    await client.query('DELETE FROM activity_table');
    console.log('✅ Table cleared\n');

    const fileStream = fs.createReadStream('wellnessvalleyDump20260109.sql', {
      encoding: 'utf8',
      highWaterMark: 64 * 1024
    });

    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    let currentInsert = '';
    let inActivityInsert = false;
    let lineCount = 0;

    console.log('📖 Reading SQL dump...\n');

    for await (const line of rl) {
      lineCount++;
      
      if (lineCount % 100000 === 0) {
        process.stdout.write(`\r📖 Processed ${lineCount.toLocaleString()} lines...`);
      }

      if (line.includes("INSERT INTO `activity_table` VALUES")) {
        inActivityInsert = true;
        currentInsert = line;
        
        if (line.trim().endsWith(';')) {
          const records = parseInsertValue(currentInsert);
          totalRecords += records.length;
          batchData.push(...records);
          
          if (batchData.length >= BATCH_SIZE) {
            await processBatch(client);
          }
          
          currentInsert = '';
          inActivityInsert = false;
        }
      } else if (inActivityInsert) {
        currentInsert += line;
        
        if (line.trim().endsWith(';')) {
          const records = parseInsertValue(currentInsert);
          totalRecords += records.length;
          batchData.push(...records);
          
          if (batchData.length >= BATCH_SIZE) {
            await processBatch(client);
          }
          
          currentInsert = '';
          inActivityInsert = false;
        }
      }
    }

    if (batchData.length > 0) {
      await processBatch(client);
    }

    console.log('\n\n✅ Migration completed!');
    console.log(`📊 Total records found: ${totalRecords}`);
    console.log(`✅ Successfully migrated: ${successCount}`);
    console.log(`⚠️  Invalid dates handled: ${invalidDateCount}`);
    console.log(`❌ Errors: ${errorCount}`);

    // Verify
    const result = await client.query('SELECT COUNT(*) FROM activity_table');
    console.log(`\n🔍 Final count in Supabase: ${result.rows[0].count}`);

    // Show sample with corrected dates if any
    if (invalidDateCount > 0) {
      console.log('\n📋 Sample records with corrected dates:');
      const correctedDates = await client.query(`
        SELECT id, user_id, activity_type, activity_date, 
               to_char(created_at, 'YYYY-MM-DD') as created_date
        FROM activity_table 
        WHERE activity_date = '1900-01-01'
        LIMIT 5
      `);
      if (correctedDates.rows.length > 0) {
        console.table(correctedDates.rows);
      } else {
        console.log('✅ All invalid dates were corrected using created_at timestamp');
      }
    }

  } catch (error) {
    console.error('❌ Migration error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrateActivityData().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
