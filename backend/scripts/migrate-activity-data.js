/**
 * Activity Table Data Migration Script
 * 
 * Migrates activity_table data from MySQL dump to Supabase PostgreSQL
 * Uses streaming to handle large file efficiently
 */

import pg from 'pg';
import fs from 'fs';
import readline from 'readline';

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

let totalRecords = 0;
let successCount = 0;
let errorCount = 0;
let batchData = [];
const BATCH_SIZE = 50; // Reduced batch size to avoid parameter limits

async function processBatch(client) {
  if (batchData.length === 0) return;

  const currentBatch = batchData.splice(0, BATCH_SIZE);

  try {
    // Build bulk INSERT
    const values = currentBatch.map((record, idx) => {
      const offset = idx * 11;
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11})`;
    }).join(',');

    const query = `
      INSERT INTO activity_table (
        activity_date, user_id, id, activity_type, created_at, 
        is_deleted, activity_time, duration, calories_burned, notes, updated_at
      ) VALUES ${values}
      ON CONFLICT (id) DO NOTHING
    `;

    // Flatten all parameters
    const params = currentBatch.flatMap(r => [
      r.activity_date,
      r.user_id,
      r.id,
      r.activity_type,
      r.created_at,
      r.is_deleted,
      null, // activity_time
      null, // duration
      null, // calories_burned
      null, // notes
      r.created_at // updated_at
    ]);

    await client.query(query, params);
    successCount += currentBatch.length;
    process.stdout.write(`\r✅ Migrated: ${successCount}/${totalRecords} records`);
  } catch (error) {
    console.error(`\n❌ Batch error (${currentBatch.length} records):`, error.message);
    errorCount += currentBatch.length;
  }

  // If there are more records, process them
  if (batchData.length > 0) {
    await processBatch(client);
  }
}

function parseInsertValue(valueStr) {
  // Parse a single value from INSERT statement
  // Format: ('2025-11-20','Priyankaa',76232,'Breakfast','2025-11-20 07:59:05',1)
  const regex = /\('([^']+)','([^']+)',(\d+),'([^']+)','([^']+)',([01])\)/g;
  const matches = [];
  let match;
  
  while ((match = regex.exec(valueStr)) !== null) {
    // Handle invalid dates (0000-00-00) by converting to NULL
    let activityDate = match[1];
    if (activityDate === '0000-00-00' || activityDate === '0000-00-00 00:00:00') {
      activityDate = null;
    }
    
    // Handle invalid created_at timestamps
    let createdAt = match[5];
    if (createdAt === '0000-00-00 00:00:00' || createdAt === '0000-00-00') {
      createdAt = '1970-01-01 00:00:00'; // Use epoch as fallback
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
  
  console.log('🚀 Starting activity_table migration...\n');
  console.log('📁 Reading from: wellnessvalleyDump20260109.sql');
  console.log('🎯 Target: Supabase activity_table\n');

  try {
    // Clean existing data
    await client.query('DELETE FROM activity_table');
    console.log('🧹 Cleared existing data\n');

    const fileStream = fs.createReadStream('wellnessvalleyDump20260109.sql', {
      encoding: 'utf8',
      highWaterMark: 64 * 1024 // 64KB chunks
    });

    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    let currentInsert = '';
    let inActivityInsert = false;

    for await (const line of rl) {
      // Check if this is start of activity_table INSERT
      if (line.includes("INSERT INTO `activity_table` VALUES")) {
        inActivityInsert = true;
        currentInsert = line;
        
        // If the line ends with semicolon, process it immediately
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
        // Continue building multi-line INSERT
        currentInsert += line;
        
        // Check if this line completes the INSERT
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

    // Process remaining records
    if (batchData.length > 0) {
      await processBatch(client);
    }

    console.log('\n\n✅ Migration completed!');
    console.log(`📊 Total records: ${totalRecords}`);
    console.log(`✅ Successfully migrated: ${successCount}`);
    console.log(`❌ Errors: ${errorCount}`);

    // Verify
    const result = await client.query('SELECT COUNT(*) FROM activity_table');
    console.log(`\n🔍 Final count in Supabase: ${result.rows[0].count}`);

  } catch (error) {
    console.error('❌ Migration error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migration
migrateActivityData().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
