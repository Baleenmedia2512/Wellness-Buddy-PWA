require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function migrateEnquiryData() {
  try {
    console.log('🚀 Starting Enquiry Table migration to Supabase...\n');

    // Read the JSON file from workspace root
    const filePath = path.join(__dirname, '..', '..', 'enquiry_table.json');
    console.log(`📁 Reading from: ${filePath}\n`);
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const enquiryRecords = JSON.parse(fileContent);

    console.log(`📊 Found ${enquiryRecords.length} enquiry records to migrate\n`);

    // Transform data to match Supabase schema (PascalCase with parentheses in column names)
    const transformedRecords = enquiryRecords.map(record => ({
      Id: record.Id,
      EntryUser: record.EntryUser,
      EntryDate: record.EntryDate,
      EnquirerName: record.EnquirerName,
      Gender: record.Gender,
      EnquirerPhoneNo: record.EnquirerPhoneNo,
      DOB: record.DOB === "0000-00-00" ? null : record.DOB,
      Age: record.Age,
      Profession: record.Profession,
      InitialHeight: record.InitialHeight,
      InitialWeight: record.InitialWeight,
      InitialChest: record.InitialChest,
      InitialWaist: record.InitialWaist,
      InitialHip: record.InitialHip,
      'InitialWaterIntake(in ltrs)': record['InitialWaterIntake(in ltrs)'],
      FoodType: record.FoodType,
      InitialWakeUpTime: record.InitialWakeUpTime,
      'NoOfCoffeeTea(in Cups)': record['NoOfCoffeeTea(in Cups)'],
      InitialBreakfastTime: record.InitialBreakfastTime,
      InitialLunchTime: record.InitialLunchTime,
      InitialDinnerTime: record.InitialDinnerTime,
      InitialBedTime: record.InitialBedTime,
      HealthProblems: record.HealthProblems,
      Medication: record.Medication,
      TargetWeight: record.TargetWeight,
      TargetWakeUpTime: record.TargetWakeUpTime,
      TargetWeightPostingTime: record.TargetWeightPostingTime,
      Afresh1Time: record.Afresh1Time,
      EducationTime: record.EducationTime,
      TargetBreakfastTime: record.TargetBreakfastTime,
      Afresh2Time: record.Afresh2Time,
      TargetLunchTime: record.TargetLunchTime,
      Afresh3Time: record.Afresh3Time,
      WorkoutTime: record.WorkoutTime,
      TargetDinnerTime: record.TargetDinnerTime,
      TargetBedTime: record.TargetBedTime,
      TargetNutrition: record.TargetNutrition,
      'TargetHipSize(in cm)': record['TargetHipSize(in cm)'],
      'TargetChestSize(in cm)': record['TargetChestSize(in cm)'],
      'TargetWaistSize(in cm)': record['TargetWaistSize(in cm)'],
      'TargetWaterInTake(in Ltrs)': record['TargetWaterInTake(in Ltrs)']
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
        .from('enquiry_table')
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
    console.log(`📈 Total processed: ${enquiryRecords.length} records`);
    console.log('==================================================\n');

    if (failCount === 0) {
      console.log('🎉 All enquiry table records migrated successfully!\n');
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
migrateEnquiryData();
