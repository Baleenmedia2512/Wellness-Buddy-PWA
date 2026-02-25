/**
 * Fix Food Corrections with Wrong Type/Unit
 * 
 * Problem: Some corrections have liquid foods (shakes, juice, tea) 
 *          saved with solid units (g, kg) which blocks auto-corrections
 * 
 * This script:
 * 1. Finds corrections where name suggests liquid but type/unit is solid
 * 2. Updates CorrectedFoodType to 'liquid'
 * 3. Updates CorrectedUnit from 'g' to 'ml'
 * 4. Adjusts CorrectedQuantity if needed (g → ml conversion)
 * 
 * Usage: node backend/scripts/fix-liquid-corrections.js
 */

import { getSupabaseClient } from '../utils/supabaseClient.js';

// Patterns that clearly indicate liquid foods
const OBVIOUS_LIQUID_PATTERNS = [
  'milkshake', 'milk shake', 'smoothie', 'juice', 'lassi',
  'tea', 'coffee', 'shake', 'beverage', 'drink', 'soup',
  'broth', 'formula 1', 'afresh', 'water', 'lemonade',
  'buttermilk', 'energy drink', 'soda', 'cola', 'cocktail',
  'formula1', 'f1'
];

/**
 * Check if food name is obviously a liquid
 */
function isObviousLiquid(name) {
  if (!name) return false;
  const nameLower = name.toLowerCase();
  return OBVIOUS_LIQUID_PATTERNS.some(pattern => nameLower.includes(pattern));
}

/**
 * Convert gram weight to approximate milliliters for liquids
 * Assumes density close to water (1g ≈ 1ml) for most beverages
 */
function convertGramsToMl(grams) {
  // For shakes/drinks, typical servings:
  // Small: 200-250ml
  // Medium: 250-350ml
  // Large: 350-500ml
  
  // If grams is very small (like 60g), likely a powder measurement
  // Convert to typical prepared serving
  if (grams < 100) {
    return Math.round(grams * 4); // ~60g powder → 240ml prepared
  }
  
  // For larger amounts, assume 1:1 ratio (density ≈ water)
  return Math.round(grams);
}

/**
 * Main fix function
 */
async function fixLiquidCorrections() {
  console.log('🔧 Starting fix for liquid corrections with wrong type/unit...\n');
  
  const supabase = getSupabaseClient();
  
  try {
    // Step 1: Fetch all corrections with solid type/unit
    console.log('📊 Fetching corrections with potential issues...');
    const { data: corrections, error: fetchError } = await supabase
      .from('food_corrections_table')
      .select('*')
      .or('"CorrectedFoodType".eq.solid,"CorrectedUnit".eq.g,"CorrectedUnit".eq.kg');
    
    if (fetchError) throw fetchError;
    
    console.log(`   Found ${corrections.length} corrections with solid type or g/kg units\n`);
    
    // Step 2: Filter to find mismatches
    const toFix = corrections.filter(correction => {
      const userCorrectedName = correction.UserCorrected;
      const aiDetectedName = correction.AiDetected;
      
      // Check if either name is obviously liquid
      const isUserCorrectedLiquid = isObviousLiquid(userCorrectedName);
      const isAiDetectedLiquid = isObviousLiquid(aiDetectedName);
      const hasWrongType = correction.CorrectedFoodType === 'solid';
      const hasWrongUnit = correction.CorrectedUnit === 'g' || correction.CorrectedUnit === 'kg';
      
      return (isUserCorrectedLiquid || isAiDetectedLiquid) && (hasWrongType || hasWrongUnit);
    });
    
    console.log(`🔍 Found ${toFix.length} corrections that need fixing:\n`);
    
    if (toFix.length === 0) {
      console.log('✅ No corrections need fixing. All good!');
      return;
    }
    
    // Step 3: Show what will be fixed
    toFix.forEach((correction, index) => {
      console.log(`${index + 1}. ID: ${correction.Id}`);
      console.log(`   User: ${correction.UserId}`);
      console.log(`   AI Detected: "${correction.AiDetected}"`);
      console.log(`   User Corrected: "${correction.UserCorrected}"`);
      console.log(`   Current Type: ${correction.CorrectedFoodType || 'null'}`);
      console.log(`   Current Unit: ${correction.CorrectedUnit || 'null'}`);
      console.log(`   Current Quantity: ${correction.CorrectedQuantity || 'null'}`);
      
      // Calculate new values
      let newQuantity = correction.CorrectedQuantity;
      if (correction.CorrectedUnit === 'g' && newQuantity) {
        newQuantity = convertGramsToMl(newQuantity);
      }
      
      console.log(`   → Will change to: Type=liquid, Unit=ml, Quantity=${newQuantity}`);
      console.log('');
    });
    
    // Step 4: Confirm before proceeding
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚠️  READY TO UPDATE DATABASE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   ${toFix.length} records will be updated`);
    console.log('');
    
    // Step 5: Apply fixes
    let successCount = 0;
    let errorCount = 0;
    
    for (const correction of toFix) {
      try {
        let newQuantity = correction.CorrectedQuantity;
        let newUnit = 'ml';
        
        // Convert quantity if currently in grams
        if (correction.CorrectedUnit === 'g' && newQuantity) {
          newQuantity = convertGramsToMl(newQuantity);
        } else if (correction.CorrectedUnit === 'kg' && newQuantity) {
          newQuantity = convertGramsToMl(newQuantity * 1000);
        }
        
        // Update the record
        const { error: updateError } = await supabase
          .from('food_corrections_table')
          .update({
            CorrectedFoodType: 'liquid',
            CorrectedUnit: newUnit,
            CorrectedQuantity: newQuantity
          })
          .eq('Id', correction.Id);
        
        if (updateError) {
          console.error(`❌ Failed to update ID ${correction.Id}:`, updateError.message);
          errorCount++;
        } else {
          console.log(`✅ Updated ID ${correction.Id}: "${correction.UserCorrected}"`);
          successCount++;
        }
      } catch (error) {
        console.error(`❌ Error updating ID ${correction.Id}:`, error.message);
        errorCount++;
      }
    }
    
    // Step 6: Summary
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 FIX COMPLETE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   ✅ Successfully updated: ${successCount}`);
    console.log(`   ❌ Failed: ${errorCount}`);
    console.log(`   📝 Total processed: ${toFix.length}`);
    console.log('');
    console.log('🎯 Next steps:');
    console.log('   1. Clear food corrections cache in the app');
    console.log('   2. Test the auto-correction feature');
    console.log('   3. Verify "Chocolate Milkshake" now auto-corrects properly');
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the fix
fixLiquidCorrections()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
