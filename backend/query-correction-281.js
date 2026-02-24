/**
 * Query food correction records for user 281
 * Specifically looking for "Chocolate Milkshake" or related corrections
 */

import dotenv from 'dotenv';
import { getSupabaseClient } from './utils/supabaseClient.js';

// Load environment variables
dotenv.config();

async function queryCorrections() {
  try {
    const supabase = getSupabaseClient();
    
    console.log('🔍 Querying corrections for user 281...\n');
    
    // Query 1: All corrections for user 281
    const { data: userCorrections, error: error1 } = await supabase
      .from('food_corrections_table')
      .select('*')
      .eq('"UserId"', 281)
      .order('"LastCorrected"', { ascending: false });
    
    if (error1) throw error1;
    
    console.log('📊 All corrections for User 281:');
    console.log('═══════════════════════════════════════════════════════════════');
    if (userCorrections && userCorrections.length > 0) {
      userCorrections.forEach((correction, idx) => {
        console.log(`\n${idx + 1}. ID: ${correction.Id}`);
        console.log(`   AI Detected: "${correction.AiDetected}"`);
        console.log(`   User Corrected: "${correction.UserCorrected}"`);
        console.log(`   Times Corrected: ${correction.TimesCorrected}`);
        console.log(`   Corrected Food Type: ${correction.CorrectedFoodType || 'N/A'}`);
        console.log(`   Corrected Unit: ${correction.CorrectedUnit || 'N/A'}`);
        console.log(`   Corrected Quantity: ${correction.CorrectedQuantity || 'N/A'}`);
        console.log(`   Corrected Calories: ${correction.CorrectedCalories || 'N/A'}`);
        console.log(`   Created: ${correction.CreatedAt}`);
        console.log(`   Last Corrected: ${correction.LastCorrected}`);
      });
    } else {
      console.log('   No corrections found for user 281');
    }
    
    // Query 2: Search for any "Chocolate Milkshake" corrections (any user)
    console.log('\n\n🔍 Searching for "Chocolate Milkshake" corrections (all users)...');
    console.log('═══════════════════════════════════════════════════════════════');
    
    const { data: chocolateCorrections, error: error2 } = await supabase
      .from('food_corrections_table')
      .select('*')
      .or('"AiDetected".ilike.%Chocolate Milkshake%,"UserCorrected".ilike.%Chocolate Milkshake%')
      .order('"LastCorrected"', { ascending: false });
    
    if (error2) throw error2;
    
    if (chocolateCorrections && chocolateCorrections.length > 0) {
      chocolateCorrections.forEach((correction, idx) => {
        console.log(`\n${idx + 1}. User ID: ${correction.UserId} | Record ID: ${correction.Id}`);
        console.log(`   AI Detected: "${correction.AiDetected}"`);
        console.log(`   User Corrected: "${correction.UserCorrected}"`);
        console.log(`   Times Corrected: ${correction.TimesCorrected}`);
        console.log(`   Corrected Food Type: ${correction.CorrectedFoodType || 'N/A'}`);
        console.log(`   Corrected Unit: ${correction.CorrectedUnit || 'N/A'}`);
        console.log(`   Corrected Quantity: ${correction.CorrectedQuantity || 'N/A'}`);
        console.log(`   Created: ${correction.CreatedAt}`);
      });
    } else {
      console.log('   No "Chocolate Milkshake" corrections found in database');
    }
    
    // Query 3: Search for "Milkshake" corrections
    console.log('\n\n🔍 Searching for "Milkshake" corrections (all users)...');
    console.log('═══════════════════════════════════════════════════════════════');
    
    const { data: milkshakeCorrections, error: error3 } = await supabase
      .from('food_corrections_table')
      .select('*')
      .or('"AiDetected".ilike.%Milkshake%,"UserCorrected".ilike.%Milkshake%')
      .order('"LastCorrected"', { ascending: false })
      .limit(20);
    
    if (error3) throw error3;
    
    if (milkshakeCorrections && milkshakeCorrections.length > 0) {
      milkshakeCorrections.forEach((correction, idx) => {
        console.log(`\n${idx + 1}. User ID: ${correction.UserId} | Record ID: ${correction.Id}`);
        console.log(`   AI Detected: "${correction.AiDetected}"`);
        console.log(`   User Corrected: "${correction.UserCorrected}"`);
        console.log(`   Times Corrected: ${correction.TimesCorrected}`);
        console.log(`   Corrected Food Type: ${correction.CorrectedFoodType || 'N/A'}`);
        console.log(`   Corrected Unit: ${correction.CorrectedUnit || 'N/A'}`);
        console.log(`   Corrected Quantity: ${correction.CorrectedQuantity || 'N/A'}`);
        console.log(`   Corrected Calories: ${correction.CorrectedCalories || 'N/A'}`);
        console.log(`   Last Corrected: ${correction.LastCorrected}`);
      });
    } else {
      console.log('   No "Milkshake" corrections found');
    }
    
    // Query 4: Check user 281's meal history for Chocolate Milkshake
    console.log('\n\n🔍 Checking meals_copy table for user 281 with Chocolate Milkshake...');
    console.log('═══════════════════════════════════════════════════════════════');
    
    const { data: meals, error: error4 } = await supabase
      .from('meals_copy')
      .select('*')
      .eq('"UserId"', 281)
      .ilike('"FoodName"', '%Chocolate Milkshake%')
      .order('"DateTime"', { ascending: false })
      .limit(5);
    
    if (error4) {
      console.log('   Error querying meals_copy:', error4.message);
    } else if (meals && meals.length > 0) {
      meals.forEach((meal, idx) => {
        console.log(`\n${idx + 1}. Meal ID: ${meal.Id}`);
        console.log(`   Food Name: "${meal.FoodName}"`);
        console.log(`   Original Food Name: "${meal.OriginalFoodName || 'N/A'}"`);
        console.log(`   Weight: ${meal.Weight || 'N/A'}`);
        console.log(`   Unit: ${meal.Unit || 'N/A'}`);
        console.log(`   Calories: ${meal.Calories || 'N/A'}`);
        console.log(`   Date: ${meal.DateTime}`);
      });
    } else {
      console.log('   No meals with "Chocolate Milkshake" found for user 281');
    }
    
    console.log('\n\n✅ Query completed!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

queryCorrections();
