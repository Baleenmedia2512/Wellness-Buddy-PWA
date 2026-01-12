require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const { chain } = require('stream-chain');
const { parser } = require('stream-json');
const { streamArray } = require('stream-json/streamers/StreamArray');

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function migrateFoodNutritionData() {
  try {
    console.log('🚀 Starting Food Nutrition Data Table migration to Supabase...\n');

    const filePath = path.join(__dirname, '..', '..', 'foodnutritiontable.json');
    console.log(`📁 Reading from: ${filePath}\n`);
    console.log('📖 Streaming and processing file...\n');

    const records = [];
    let recordCount = 0;
    
    // Stream parse the JSON file
    const pipeline = chain([
      fs.createReadStream(filePath),
      parser(),
      streamArray()
    ]);

    for await (const { value } of pipeline) {
      records.push(value);
      recordCount++;
      if (recordCount % 100 === 0) {
        process.stdout.write(`\r📊 Loaded ${recordCount} records...`);
      }
    }
    
    console.log(`\n\n📊 Found ${records.length} food nutrition records to migrate\n`);

    // Check which records already exist
    console.log('🔍 Checking existing records in database...\n');
    const { data: existingRecords, error: fetchError } = await supabase
      .from('food_nutrition_data_table')
      .select('ID');
    
    if (fetchError) {
      console.error('Error fetching existing records:', fetchError);
    }
    
    const existingIds = new Set((existingRecords || []).map(r => r.ID));
    console.log(`📊 Found ${existingIds.size} existing records\n`);
    
    // Filter out already migrated records
    const newRecords = records.filter(r => !existingIds.has(r.ID));
    console.log(`📊 ${newRecords.length} new records to migrate\n`);
    
    if (newRecords.length === 0) {
      console.log('✅ All records already migrated!\n');
      return;
    }

    // Process in smaller batches (due to large ImageBase64 fields)
    const batchSize = 10; // Further reduced to avoid timeouts
    let successCount = 0;
    let failCount = 0;
    const totalBatches = Math.ceil(newRecords.length / batchSize);

    for (let i = 0; i < newRecords.length; i += batchSize) {
      const batch = newRecords.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;

      // Transform batch to PascalCase columns (exclude ImageBase64 if empty to reduce size)
      const transformedBatch = batch.map(record => {
        const transformed = {
          ID: record.ID,
          UserID: record.UserID,
          ImagePath: record.ImagePath || null,
          AnalysisData: record.AnalysisData || null,
          ConfidenceScore: record.ConfidenceScore || 0,
          TotalCalories: record.TotalCalories || 0,
          TotalProtein: record.TotalProtein || 0,
          TotalCarbs: record.TotalCarbs || 0,
          TotalFat: record.TotalFat || 0,
          TotalFiber: record.TotalFiber || 0,
          ProcessedBy: record.ProcessedBy || null,
          DeviceInfo: record.DeviceInfo || null,
          CreatedAt: record.CreatedAt || null,
          UpdatedAt: record.UpdatedAt || null,
          IsDeleted: record.IsDeleted || 0
        };
        
        // Only include ImageBase64 if it's not empty
        if (record.ImageBase64 && record.ImageBase64.length > 0) {
          transformed.ImageBase64 = record.ImageBase64;
        } else {
          transformed.ImageBase64 = null;
        }
        
        return transformed;
      });

      console.log(`📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} records)...`);

      // Retry logic for timeouts
      let retries = 0;
      let success = false;
      
      while (retries < 3 && !success) {
        const { error } = await supabase
          .from('food_nutrition_data_table')
          .upsert(transformedBatch, { 
            onConflict: 'ID',
            ignoreDuplicates: false 
          });

        if (error) {
          if (error.message.includes('timeout') && retries < 2) {
            retries++;
            console.log(`⏳ Timeout - retrying (${retries}/3)...`);
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s before retry
          } else {
            console.error(`❌ Batch ${batchNumber} failed:`, error.message);
            if (error.details) console.error('Details:', error.details);
            failCount += batch.length;
            success = true; // Stop retrying
          }
        } else {
          console.log(`✅ Batch ${batchNumber} completed`);
          successCount += batch.length;
          success = true;
        }
      }

      if (batchNumber % 5 === 0) {
        const percentComplete = ((i + batch.length) / newRecords.length * 100).toFixed(2);
        console.log(`\n⏳ Progress: ${percentComplete}%\n`);
      }
    }

    console.log('\n==================================================');
    console.log('📊 Migration Summary:');
    console.log('==================================================');
    console.log(`✅ Successfully migrated: ${successCount} records`);
    console.log(`❌ Failed: ${failCount} records`);
    console.log(`📈 Total new records processed: ${newRecords.length}`);
    console.log(`📈 Total records in database: ${existingIds.size + successCount}`);
    console.log('==================================================\n');

    console.log('✨ Migration completed');
  } catch (error) {
    console.error('💥 Fatal error during migration:', error);
    process.exit(1);
  }
}

// Run the migration
migrateFoodNutritionData();
