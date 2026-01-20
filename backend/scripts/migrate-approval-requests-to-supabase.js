/**
 * Migrate Approval Requests from approcalRequestTable.json to Supabase
 * Run: node scripts/migrate-approval-requests-to-supabase.js
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

async function migrateApprovalRequests() {
  console.log('🚀 Starting Approval Requests migration to Supabase...\n');

  // Read JSON file
  const jsonPath = path.join(__dirname, '..', '..', 'approcalRequestTable.json');
  const rawData = fs.readFileSync(jsonPath, 'utf-8');
  const approvalRecords = JSON.parse(rawData);

  console.log(`📊 Found ${approvalRecords.length} approval request records to migrate\n`);

  // Transform data to match Supabase schema
  const transformedRecords = approvalRecords.map(record => {
    const obj = {};
    obj['Id'] = record.Id;
    obj['RequesterId'] = record.RequesterId;
    obj['UplineCoachId'] = record.UplineCoachId;
    obj['Status'] = record.Status;
    obj['OtpHash'] = record.OtpHash;
    obj['OtpExpiresAt'] = record.OtpExpiresAt;
    obj['OtpAttempts'] = record.OtpAttempts;
    obj['OtpSentAt'] = record.OtpSentAt;
    obj['RequestedAt'] = record.RequestedAt;
    obj['ProcessedAt'] = record.ProcessedAt || null;
    return obj;
  });

  // Insert in batches of 50
  const batchSize = 50;
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < transformedRecords.length; i += batchSize) {
    const batch = transformedRecords.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(transformedRecords.length / batchSize);

    console.log(`📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} records)...`);

    const { data, error} = await supabase
      .from('approval_requests_table')
      .upsert(batch, { onConflict: 'Id' });

    if (error) {
      console.error(`❌ Error in batch ${batchNum}:`, error.message);
      console.error('   Details:', error.hint || error.details || 'No additional details');
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
    console.log('\n🎉 All approval request records migrated successfully!');
  } else {
    console.log('\n⚠️  Some records failed to migrate. Check errors above.');
  }
}

// Run migration
migrateApprovalRequests()
  .then(() => {
    console.log('\n✨ Migration completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });
