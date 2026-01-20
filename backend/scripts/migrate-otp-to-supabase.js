/**
 * Migrate OTP data from otpTable.json to Supabase
 * Run: node scripts/migrate-otp-to-supabase.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrateOTPData() {
  console.log('🚀 Starting OTP migration to Supabase...\n');

  // Read JSON file
  const jsonPath = path.join(__dirname, '..', '..', 'otpTable.json');
  const rawData = fs.readFileSync(jsonPath, 'utf-8');
  const otpRecords = JSON.parse(rawData);

  console.log(`📊 Found ${otpRecords.length} OTP records to migrate\n`);

  // Transform data to match Supabase schema (snake_case)
  const transformedRecords = otpRecords.map(record => ({
    id: record.ID,
    identifier: record.Recipient,
    identifier_type: record.ContactType,
    token: record.OTPHash,
    expires_at: record.ExpiresAt,
    is_verified: record.Verified,
    created_at: record.CreatedAt
  }));

  // Insert in batches of 100
  const batchSize = 100;
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < transformedRecords.length; i += batchSize) {
    const batch = transformedRecords.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(transformedRecords.length / batchSize);

    console.log(`📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} records)...`);

    const { data, error } = await supabase
      .from('otp_tokens_table')
      .upsert(batch, { onConflict: 'id' });

    if (error) {
      console.error(`❌ Error in batch ${batchNum}:`, error.message);
      errorCount += batch.length;
    } else {
      console.log(`✅ Batch ${batchNum} inserted successfully`);
      successCount += batch.length;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 Migration Summary:');
  console.log('='.repeat(50));
  console.log(`✅ Successfully migrated: ${successCount} records`);
  console.log(`❌ Failed: ${errorCount} records`);
  console.log(`📈 Total processed: ${transformedRecords.length} records`);
  console.log('='.repeat(50));

  if (successCount === transformedRecords.length) {
    console.log('\n🎉 All OTP records migrated successfully!');
  } else {
    console.log('\n⚠️  Some records failed to migrate. Check errors above.');
  }
}

// Run migration
migrateOTPData()
  .then(() => {
    console.log('\n✨ Migration completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });
