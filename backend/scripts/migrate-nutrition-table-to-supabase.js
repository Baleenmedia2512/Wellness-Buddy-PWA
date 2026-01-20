require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function migrateNutritionData() {
  try {
    console.log('🚀 Starting Nutrition Table migration to Supabase...\n');

    // Read the JSON file from workspace root
    const filePath = path.join(__dirname, '..', '..', 'nutritiontable.json');
    console.log(`📁 Reading from: ${filePath}\n`);
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const nutritionRecords = JSON.parse(fileContent);

    console.log(`📊 Found ${nutritionRecords.length} nutrition records to migrate\n`);

    // Transform data to match Supabase schema (PascalCase)
    const transformedRecords = nutritionRecords.map(record => ({
      Id: record.Id,
      EntryUser: record.EntryUser,
      EntryDate: record.EntryDate,
      NutritionName: record.NutritionName
    }));

    // Process in batches
    const batchSize = 50;
    let successCount = 0;
    let failCount = 0;
    const totalBatches = Math.ceil(transformedRecords.length / batchSize);

    for (let i = 0; i < transformedRecords.length; i += batchSize) {
      const batch = transformedRecords.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;

      console.log(`📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} records)...`);

      const { data, error } = await supabase
        .from('nutrition_table')
        .upsert(batch, { 
          onConflict: 'Id',
          ignoreDuplicates: false 
        });

      if (error) {
        console.error(`❌ Batch ${batchNumber} failed:`, error.message);
        if (error.details) console.error('Details:', error.details);
        if (error.hint) console.error('Hint:', error.hint);
        
        console.log('First row in batch:', JSON.stringify(batch[0], null, 2));
        failCount += batch.length;
      } else {
        console.log(`✅ Batch ${batchNumber} inserted successfully`);
        successCount += batch.length;
      }
    }

    console.log('\n==================================================');
    console.log('📊 Migration Summary:');
    console.log('==================================================');
    console.log(`✅ Successfully migrated: ${successCount} records`);
    console.log(`❌ Failed: ${failCount} records`);
    console.log(`📈 Total processed: ${nutritionRecords.length} records`);
    console.log('==================================================\n');

    if (failCount === 0) {
      console.log('🎉 All nutrition records migrated successfully!\n');
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
migrateNutritionData();
