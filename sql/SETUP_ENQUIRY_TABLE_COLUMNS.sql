-- Add all required columns to enquiry_table (if not exist)
-- Keep Id as primary key

-- Ensure Id column exists
ALTER TABLE enquiry_table ADD COLUMN IF NOT EXISTS "Id" INTEGER PRIMARY KEY;

ALTER TABLE enquiry_table ADD COLUMN IF NOT EXISTS "EntryUser" VARCHAR(100);
ALTER TABLE enquiry_table ADD COLUMN IF NOT EXISTS "EntryDate" TIMESTAMP;
ALTER TABLE enquiry_table ADD COLUMN IF NOT EXISTS "EnquirerName" VARCHAR(100);
ALTER TABLE enquiry_table ADD COLUMN IF NOT EXISTS "Gender" VARCHAR(20);
ALTER TABLE enquiry_table ADD COLUMN IF NOT EXISTS "EnquirerPhoneNo" BIGINT;
ALTER TABLE enquiry_table ADD COLUMN IF NOT EXISTS "DOB" DATE;
ALTER TABLE enquiry_table ADD COLUMN IF NOT EXISTS "Age" INTEGER;
ALTER TABLE enquiry_table ADD COLUMN IF NOT EXISTS "Profession" VARCHAR(100);
ALTER TABLE enquiry_table ADD COLUMN IF NOT EXISTS "InitialHeight" DECIMAL(5, 2);
ALTER TABLE enquiry_table ADD COLUMN IF NOT EXISTS "InitialWeight" DECIMAL(5, 2);
ALTER TABLE enquiry_table ADD COLUMN IF NOT EXISTS "InitialChest" INTEGER;
ALTER TABLE enquiry_table ADD COLUMN IF NOT EXISTS "InitialWaist" INTEGER;
ALTER TABLE enquiry_table ADD COLUMN IF NOT EXISTS "InitialHip" INTEGER;
ALTER TABLE enquiry_table ADD COLUMN IF NOT EXISTS "InitialWaterIntake(in ltrs)" INTEGER;
ALTER TABLE enquiry_table ADD COLUMN IF NOT EXISTS "FoodType" VARCHAR(50);
ALTER TABLE enquiry_table ADD COLUMN IF NOT EXISTS "InitialWakeUpTime" TIME;
ALTER TABLE enquiry_table ADD COLUMN IF NOT EXISTS "NoOfCoffeeTea(in Cups)" INTEGER;
ALTER TABLE enquiry_table ADD COLUMN IF NOT EXISTS "InitialBreakfastTime" TIME;
ALTER TABLE enquiry_table ADD COLUMN IF NOT EXISTS "InitialLunchTime" TIME;
ALTER TABLE enquiry_table ADD COLUMN IF NOT EXISTS "InitialDinnerTime" TIME;
ALTER TABLE enquiry_table ADD COLUMN IF NOT EXISTS "InitialBedTime" TIME;
ALTER TABLE enquiry_table ADD COLUMN IF NOT EXISTS "HealthProblems" TEXT;
ALTER TABLE enquiry_table ADD COLUMN IF NOT EXISTS "Medication" TEXT;
ALTER TABLE enquiry_table ADD COLUMN IF NOT EXISTS "TargetWeight" DECIMAL(5, 2);
ALTER TABLE enquiry_table ADD COLUMN IF NOT EXISTS "TargetWakeUpTime" TIME;
ALTER TABLE enquiry_table ADD COLUMN IF NOT EXISTS "TargetWeightPostingTime" TIME;
ALTER TABLE enquiry_table ADD COLUMN IF NOT EXISTS "Afresh1Time" TIME;
ALTER TABLE enquiry_table ADD COLUMN IF NOT EXISTS "EducationTime" TIME;
ALTER TABLE enquiry_table ADD COLUMN IF NOT EXISTS "TargetBreakfastTime" TIME;
ALTER TABLE enquiry_table ADD COLUMN IF NOT EXISTS "Afresh2Time" TIME;
ALTER TABLE enquiry_table ADD COLUMN IF NOT EXISTS "TargetLunchTime" TIME;
ALTER TABLE enquiry_table ADD COLUMN IF NOT EXISTS "Afresh3Time" TIME;
ALTER TABLE enquiry_table ADD COLUMN IF NOT EXISTS "WorkoutTime" TIME;
ALTER TABLE enquiry_table ADD COLUMN IF NOT EXISTS "TargetDinnerTime" TIME;
ALTER TABLE enquiry_table ADD COLUMN IF NOT EXISTS "TargetBedTime" TIME;
ALTER TABLE enquiry_table ADD COLUMN IF NOT EXISTS "TargetNutrition" TEXT;
ALTER TABLE enquiry_table ADD COLUMN IF NOT EXISTS "TargetHipSize(in cm)" INTEGER;
ALTER TABLE enquiry_table ADD COLUMN IF NOT EXISTS "TargetChestSize(in cm)" INTEGER;
ALTER TABLE enquiry_table ADD COLUMN IF NOT EXISTS "TargetWaistSize(in cm)" INTEGER;
ALTER TABLE enquiry_table ADD COLUMN IF NOT EXISTS "TargetWaterInTake(in Ltrs)" INTEGER;

-- Drop any columns that are NOT in the required list
-- Note: Manually check existing columns and drop unwanted ones
-- Common snake_case columns to drop if they exist:

ALTER TABLE enquiry_table DROP COLUMN IF EXISTS entry_user;
ALTER TABLE enquiry_table DROP COLUMN IF EXISTS entry_date;
ALTER TABLE enquiry_table DROP COLUMN IF EXISTS enquirer_name;
ALTER TABLE enquiry_table DROP COLUMN IF EXISTS gender;
ALTER TABLE enquiry_table DROP COLUMN IF EXISTS enquirer_phone_no;
ALTER TABLE enquiry_table DROP COLUMN IF EXISTS dob;
ALTER TABLE enquiry_table DROP COLUMN IF EXISTS age;
ALTER TABLE enquiry_table DROP COLUMN IF EXISTS profession;
ALTER TABLE enquiry_table DROP COLUMN IF EXISTS initial_height;
ALTER TABLE enquiry_table DROP COLUMN IF EXISTS initial_weight;
ALTER TABLE enquiry_table DROP COLUMN IF EXISTS initial_chest;
ALTER TABLE enquiry_table DROP COLUMN IF EXISTS initial_waist;
ALTER TABLE enquiry_table DROP COLUMN IF EXISTS initial_hip;
ALTER TABLE enquiry_table DROP COLUMN IF EXISTS initial_water_intake;
ALTER TABLE enquiry_table DROP COLUMN IF EXISTS food_type;
ALTER TABLE enquiry_table DROP COLUMN IF EXISTS initial_wake_up_time;
ALTER TABLE enquiry_table DROP COLUMN IF EXISTS no_of_coffee_tea;
ALTER TABLE enquiry_table DROP COLUMN IF EXISTS initial_breakfast_time;
ALTER TABLE enquiry_table DROP COLUMN IF EXISTS initial_lunch_time;
ALTER TABLE enquiry_table DROP COLUMN IF EXISTS initial_dinner_time;
ALTER TABLE enquiry_table DROP COLUMN IF EXISTS initial_bed_time;
ALTER TABLE enquiry_table DROP COLUMN IF EXISTS health_problems;
ALTER TABLE enquiry_table DROP COLUMN IF EXISTS medication;
ALTER TABLE enquiry_table DROP COLUMN IF EXISTS target_weight;
ALTER TABLE enquiry_table DROP COLUMN IF EXISTS target_wake_up_time;
ALTER TABLE enquiry_table DROP COLUMN IF EXISTS target_weight_posting_time;
ALTER TABLE enquiry_table DROP COLUMN IF EXISTS afresh1_time;
ALTER TABLE enquiry_table DROP COLUMN IF EXISTS education_time;
ALTER TABLE enquiry_table DROP COLUMN IF EXISTS target_breakfast_time;
ALTER TABLE enquiry_table DROP COLUMN IF EXISTS afresh2_time;
ALTER TABLE enquiry_table DROP COLUMN IF EXISTS target_lunch_time;
ALTER TABLE enquiry_table DROP COLUMN IF EXISTS afresh3_time;
ALTER TABLE enquiry_table DROP COLUMN IF EXISTS workout_time;
ALTER TABLE enquiry_table DROP COLUMN IF EXISTS target_dinner_time;
ALTER TABLE enquiry_table DROP COLUMN IF EXISTS target_bed_time;
ALTER TABLE enquiry_table DROP COLUMN IF EXISTS target_nutrition;
ALTER TABLE enquiry_table DROP COLUMN IF EXISTS target_hip_size;
ALTER TABLE enquiry_table DROP COLUMN IF EXISTS target_chest_size;
ALTER TABLE enquiry_table DROP COLUMN IF EXISTS target_waist_size;
ALTER TABLE enquiry_table DROP COLUMN IF EXISTS target_water_in_take;

-- Drop lowercase id only if "Id" (uppercase) exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'enquiry_table' AND column_name = 'Id') THEN
        ALTER TABLE enquiry_table DROP COLUMN IF EXISTS id;
    ELSE
        ALTER TABLE enquiry_table RENAME COLUMN id TO "Id";
    END IF;
END $$;
