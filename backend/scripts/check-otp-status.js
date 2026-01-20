/**
 * Check which OTP records are missing in Supabase
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

async function checkMissingRecords() {
  const client = await pool.connect();

  try {
    console.log('🔍 Checking OTP records status...\n');

    // Read JSON file
    const jsonPath = path.join(__dirname, '..', '..', 'otpTable.json');
    const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    console.log(`📂 JSON file: ${jsonData.length} records expected`);

    // Get current count from Supabase
    const countResult = await client.query('SELECT COUNT(*) FROM otp_table');
    const currentCount = parseInt(countResult.rows[0].count);
    console.log(`📊 Supabase: ${currentCount} records exist`);
    console.log(`❌ Missing: ${jsonData.length - currentCount} records\n`);

    if (currentCount === jsonData.length) {
      console.log('✅ SUCCESS! All records are present! 🎉');
      return;
    }

    // Get all existing IDs
    const existingIds = await client.query('SELECT id FROM otp_table ORDER BY id');
    const dbIdSet = new Set(existingIds.rows.map(r => r.id));

    // Find missing records
    const missingRecords = jsonData.filter(record => !dbIdSet.has(record.ID));

    console.log('❌ Missing Records:\n');
    missingRecords.forEach(record => {
      console.log(`ID: ${record.ID}`);
      console.log(`  Recipient: ${record.Recipient}`);
      console.log(`  Contact Type: ${record.ContactType}`);
      console.log(`  Verified: ${record.Verified}`);
      console.log(`  Created: ${record.CreatedAt}`);
      console.log('');
    });

    // Generate SQL for just the missing records
    console.log('📝 Generated SQL to insert missing records:\n');
    console.log('-- Copy and paste this into Supabase SQL Editor:\n');
    
    missingRecords.forEach(record => {
      console.log(`INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)`);
      console.log(`VALUES (${record.ID}, '${record.Recipient.replace(/'/g, "''")}', '${record.ContactType}', '${record.OTPHash}', '${record.ExpiresAt}', ${record.Verified}, ${record.IsActive}, '${record.CreatedAt}');`);
      console.log('');
    });

    console.log('-- After running above SQL, verify:');
    console.log('SELECT COUNT(*) FROM otp_table;');
    console.log(`-- Should show: ${jsonData.length}\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n⚠️  Cannot connect to Supabase.');
    console.log('💡 Please use the SQL file generated earlier:');
    console.log('   backend/scripts/insert-missing-otp-safe.sql');
    console.log('   Copy its contents and run in Supabase SQL Editor\n');
  } finally {
    client.release();
    await pool.end();
  }
}

checkMissingRecords().catch(console.error);
