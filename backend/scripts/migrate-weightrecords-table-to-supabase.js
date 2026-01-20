require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function migrateWeightRecordsTable() {
  try {
    console.log('🚀 Starting Weight Records Table migration to Supabase...\n');

    const filePath = 'c:\\Users\\siva1\\Documents\\dumps\\weightrecoredstable.json';
    console.log(`📁 Reading from: ${filePath}\n`);

    // Read file size
    const stats = fs.statSync(filePath);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`📦 File size: ${fileSizeMB} MB\n`);

    // Read and parse the JSON file
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const records = JSON.parse(fileContent);
    
    console.log(`📊 Found ${records.length} weight records to migrate\n`);

    // Transform and batch process (smaller batch size due to large images)
    const batchSize = 10; // Smaller batch due to large base64 images
    let successCount = 0;
    let failCount = 0;
    const totalBatches = Math.ceil(records.length / batchSize);

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;

      // Transform batch to match Supabase schema with PascalCase
      const transformedBatch = batch.map(record => ({
        ID: record.ID,
        UserId: record.UserId,
        Weight: record.Weight || 0,
        Bmi: record.Bmi || 0,
        BodyFat: record.BodyFat || 0,
        MuscleMass: record.MuscleMass || 0,
        Bmr: record.Bmr || 0,
        WeightImageBase64: record.WeightImageBase64 || null,
        CreatedAt: record.CreatedAt || null,
        UpdatedAt: record.UpdatedAt || null,
        IsDeleted: record.IsDeleted || 0
      }));

      console.log(`📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} records)...`);

      const { data, error } = await supabase
        .from('weight_records_table')
        .upsert(transformedBatch, { 
          onConflict: 'ID',
          ignoreDuplicates: false 
        });

      if (error) {
        console.error(`❌ Batch ${batchNumber} failed:`, error.message);
        if (error.details) console.error('Details:', error.details);
        if (error.hint) console.error('Hint:', error.hint);
        failCount += batch.length;
      } else {
        console.log(`✅ Batch ${batchNumber} completed successfully`);
        successCount += batch.length;
      }

      // Progress update every 10 batches
      if (batchNumber % 10 === 0) {
        const percentComplete = ((i + batch.length) / records.length * 100).toFixed(2);
        console.log(`\n⏳ Progress: ${percentComplete}% (${successCount + failCount}/${records.length} records)\n`);
      }
    }

    console.log('\n==================================================');
    console.log('📊 Migration Summary:');
    console.log('==================================================');
    console.log(`✅ Successfully migrated: ${successCount} records`);
    console.log(`❌ Failed: ${failCount} records`);
    console.log(`📈 Total processed: ${records.length} records`);
    console.log('==================================================\n');

    if (failCount === 0) {
      console.log('🎉 All weight records migrated successfully!\n');
    } else {
      console.log('⚠️  Some records failed to migrate. Check the errors above.\n');
    }

    console.log('✨ Migration completed');
  } catch (error) {
    console.error('💥 Fatal error during migration:', error);
    process.exit(1);
  }
}

// Run the migration
migrateWeightRecordsTable();
