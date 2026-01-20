-- Create enquiry_table in Supabase
-- This table stores user wellness program enquiry and onboarding information

CREATE TABLE IF NOT EXISTS enquiry_table (
  "Id" INTEGER PRIMARY KEY,
  "EntryUser" VARCHAR(100) NOT NULL,
  "EntryDate" TIMESTAMP NOT NULL,
  "EnquirerName" VARCHAR(100) NOT NULL,
  "Gender" VARCHAR(20),
  "EnquirerPhoneNo" BIGINT,
  "DOB" DATE,
  "Age" INTEGER,
  "Profession" VARCHAR(100),
  "InitialHeight" DECIMAL(5, 2),
  "InitialWeight" DECIMAL(5, 2),
  "InitialChest" INTEGER,
  "InitialWaist" INTEGER,
  "InitialHip" INTEGER,
  "InitialWaterIntake" INTEGER,
  "FoodType" VARCHAR(50),
  "InitialWakeUpTime" TIME,
  "NoOfCoffeeTea" INTEGER,
  "InitialBreakfastTime" TIME,
  "InitialLunchTime" TIME,
  "InitialDinnerTime" TIME,
  "InitialBedTime" TIME,
  "HealthProblems" TEXT,
  "Medication" TEXT,
  "TargetWeight" DECIMAL(5, 2),
  "TargetWakeUpTime" TIME,
  "TargetWeightPostingTime" TIME,
  "Afresh1Time" TIME,
  "EducationTime" TIME,
  "TargetBreakfastTime" TIME,
  "Afresh2Time" TIME,
  "TargetLunchTime" TIME,
  "Afresh3Time" TIME,
  "WorkoutTime" TIME,
  "TargetDinnerTime" TIME,
  "TargetBedTime" TIME,
  "TargetNutrition" TEXT,
  "TargetHipSize" INTEGER,
  "TargetChestSize" INTEGER,
  "TargetWaistSize" INTEGER,
  "TargetWaterInTake" INTEGER
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_enquiry_user ON enquiry_table("EntryUser");
CREATE INDEX IF NOT EXISTS idx_enquiry_date ON enquiry_table("EntryDate");
CREATE INDEX IF NOT EXISTS idx_enquiry_phone ON enquiry_table("EnquirerPhoneNo");
CREATE INDEX IF NOT EXISTS idx_enquirer_name ON enquiry_table("EnquirerName");
