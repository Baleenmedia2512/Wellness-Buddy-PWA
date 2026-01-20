require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function migrateDisciplineData() {
  try {
    console.log('🚀 Starting Discipline Table migration to Supabase...\n');

    // Read the JSON file from workspace root
    const filePath = path.join(__dirname, '..', '..', 'disciplineTable.json');
    console.log(`📁 Reading from: ${filePath}\n`);
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const disciplineRecords = JSON.parse(fileContent);

    console.log(`📊 Found ${disciplineRecords.length} discipline records to migrate\n`);

    // Transform data to match Supabase schema (PascalCase - matches screenshot)
    const transformedRecords = disciplineRecords.map(record => ({
      ID: record.ID,
      EntryDate: record.EntryDate,
      EntryUser: record.EntryUser,
      Activity: record.Activity,
      ActivityStartTime: record.ActivityStartTime,
      ActivityEndTime: record.ActivityEndTime,
      ValidityStartDate: record.ValidityStartDate,
      ValidityEndDate: record.ValidityEndDate,
      TrackForDiscipline: record.TrackForDiscipline,
      DisciplineGroupID: record.DisciplineGroupID
    }));

    // Process in batches
    const batchSize = 100;
    let successCount = 0;
    let failCount = 0;
    const totalBatches = Math.ceil(transformedRecords.length / batchSize);

    for (let i = 0; i < transformedRecords.length; i += batchSize) {
      const batch = transformedRecords.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;

      console.log(`📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} records)...`);

      const { data, error } = await supabase
        .from('discipline_table')
        .upsert(batch, { 
          onConflict: 'ID',
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
    console.log(`📈 Total processed: ${disciplineRecords.length} records`);
    console.log('==================================================\n');

    if (failCount === 0) {
      console.log('🎉 All discipline table records migrated successfully!\n');
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
migrateDisciplineData();
