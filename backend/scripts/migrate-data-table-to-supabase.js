/**
 * Migrate Data Table from dataTable.json to Supabase
 * Run: node scripts/migrate-data-table-to-supabase.js
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

async function migrateDataTable() {
  console.log('🚀 Starting Data Table migration to Supabase...\n');

  // Read JSON file
  const jsonPath = path.join(__dirname, '..', '..', 'dataTable.json');
  const rawData = fs.readFileSync(jsonPath, 'utf-8');
  const dataRecords = JSON.parse(rawData);

  console.log(`📊 Found ${dataRecords.length} data records to migrate\n`);

  // Transform data to match Supabase schema (lowercase snake_case)
  const transformedRecords = dataRecords.map(record => ({
    id: record.Id,
    name: record.EntryUser,
    date: record.EntryDate !== '0000-00-00' ? record.EntryDate : '2000-01-01',  // Use default date for invalid dates
    type: record.ActivityName,
    value: record.Measurement,
    timestamp: record.PostedDateTime !== '0000-00-00 00:00:00' ? record.PostedDateTime : '2000-01-01 00:00:00',
    is_deleted: record.Validity === 0 ? 1 : 0  // Invert: Validity=1 means not deleted
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
      .from('data_table')
      .upsert(batch, { onConflict: 'id' });

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
    console.log('\n🎉 All data table records migrated successfully!');
  } else {
    console.log('\n⚠️  Some records failed to migrate. Check errors above.');
  }
}

// Run migration
migrateDataTable()
  .then(() => {
    console.log('\n✨ Migration completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });
