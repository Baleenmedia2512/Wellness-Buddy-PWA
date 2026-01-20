/**
 * Offline check - shows which records are missing
 * (doesn't require database connection)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function checkOffline() {
  console.log('🔍 Analyzing OTP records offline...\n');

  // Read JSON file
  const jsonPath = path.join(__dirname, '..', '..', 'otpTable.json');
  const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  
  console.log(`📂 Expected total: ${jsonData.length} records`);
  console.log(`📊 Current in Supabase: 356 records (from your screenshot)`);
  console.log(`❌ Missing: ${jsonData.length - 356} records\n`);

  // We know records 1-356 were inserted before timeout
  // So missing records are likely the last 4 that failed
  
  console.log('🔎 Based on migration sequence, missing records are likely:\n');
  
  // Get records that would have been inserted after record 356
  const allIds = jsonData.map(r => r.ID).sort((a, b) => a - b);
  
  console.log('📋 All record IDs in your JSON file:');
  console.log(`   Min ID: ${Math.min(...allIds)}`);
  console.log(`   Max ID: ${Math.max(...allIds)}`);
  console.log('');

  // Show last 10 records as those are most likely missing
  console.log('⚠️  Last 10 records in JSON (these are most likely to be missing):\n');
  const lastRecords = jsonData.slice(-10);
  
  lastRecords.forEach(record => {
    console.log(`ID: ${record.ID} | Recipient: ${record.Recipient} | Verified: ${record.Verified} | Created: ${record.CreatedAt}`);
  });

  console.log('\n📝 To find EXACT missing records:\n');
  console.log('1. Open Supabase SQL Editor');
  console.log('2. Run this query:\n');
  console.log('   SELECT id FROM otp_table ORDER BY id;\n');
  console.log('3. Compare with all IDs from JSON to find gaps\n');

  console.log('💡 OR simply run the safe SQL file:\n');
  console.log('   File: backend/scripts/insert-missing-otp-safe.sql');
  console.log('   This will insert ALL 360 records with ON CONFLICT DO NOTHING');
  console.log('   Only the 4 missing records will be inserted\n');

  // Generate quick SQL for last 10 records
  console.log('🚀 Quick SQL (insert last 10 records, safe with ON CONFLICT):\n');
  lastRecords.forEach(record => {
    console.log(`INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)`);
    console.log(`VALUES (${record.ID}, '${record.Recipient.replace(/'/g, "''")}', '${record.ContactType}', '${record.OTPHash}', '${record.ExpiresAt}', ${record.Verified}, ${record.IsActive}, '${record.CreatedAt}')`);
    console.log(`ON CONFLICT (id) DO NOTHING;`);
    console.log('');
  });
}

checkOffline().catch(console.error);
