
/**
 * Insert only the missing 4 OTP records
 * 
 * This script:
 * 1. Compares JSON (360) with Supabase (356)
 * 2. Finds the 4 missing IDs
 * 3. Inserts only those 4 records
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
  connectionTimeoutMillis: 30000,
  ssl: {
    rejectUnauthorized: false
  }
});

async function insertMissingRecords() {
  const client = await pool.connect();

  try {
    console.log('🔍 Finding and inserting missing OTP records...\n');

    // Read JSON file
    const jsonPath = path.join(__dirname, '..', '..', 'otpTable.json');
    const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    console.log(`📂 JSON file: ${jsonData.length} records`);

    // Get current count
    const countResult = await client.query('SELECT COUNT(*) FROM otp_table');
    console.log(`📊 Supabase: ${countResult.rows[0].count} records\n`);

    // Get all existing IDs from Supabase
    const existingIds = await client.query('SELECT id FROM otp_table ORDER BY id');
    const dbIdSet = new Set(existingIds.rows.map(r => r.id));

    // Find missing records
    const missingRecords = jsonData.filter(record => !dbIdSet.has(record.ID));

    console.log(`❌ Missing: ${missingRecords.length} records\n`);

    if (missingRecords.length === 0) {
      console.log('✅ All records are already present!');
      return;
    }

    console.log('📋 Missing record IDs:', missingRecords.map(r => r.ID).join(', '));
    console.log('\n💾 Inserting missing records...\n');

    let inserted = 0;
    let failed = 0;

    for (const record of missingRecords) {
      try {
        await client.query(`
          INSERT INTO otp_table 
          (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          record.ID,
          record.Recipient,
          record.ContactType,
          record.OTPHash,
          record.ExpiresAt,
          record.Verified,
          record.IsActive,
          record.CreatedAt
        ]);
        console.log(`✅ Inserted ID ${record.ID} (${record.Recipient})`);
        inserted++;
      } catch (err) {
        console.log(`❌ Failed ID ${record.ID}: ${err.message}`);
        failed++;
      }
    }

    console.log(`\n📊 Results:`);
    console.log(`  ✅ Inserted: ${inserted}`);
    console.log(`  ❌ Failed: ${failed}`);

    // Verify final count
    const finalCount = await client.query('SELECT COUNT(*) FROM otp_table');
    console.log(`\n📈 Final Supabase count: ${finalCount.rows[0].count}`);

    if (parseInt(finalCount.rows[0].count) === jsonData.length) {
      console.log('✅ SUCCESS! All 360 records are now in Supabase! 🎉');
    } else {
      const still_missing = jsonData.length - parseInt(finalCount.rows[0].count);
      console.log(`⚠️  Still missing ${still_missing} records`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

insertMissingRecords().catch(console.error);
