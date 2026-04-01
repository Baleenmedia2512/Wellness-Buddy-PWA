/**
 * Weight Validation and Auto-Correction Utility
 * Intelligently corrects AI misreadings and prevents unrealistic weight changes
 */

/**
 * Auto-correct weight if AI misread the number
 * Handles common OCR errors: 7↔9, 6↔8, 1↔7, 5↔6
 * Example: AI reads 95.6 but previous was 74.8 → tries 75.6, 95.6, 85.6, etc.
 */
function autoCorrectWeight(detectedWeight, previousWeight) {
  const detected = parseFloat(detectedWeight);
  const previous = parseFloat(previousWeight);
  
  // If difference is huge (>10 kg), likely AI misread a digit
  const diff = Math.abs(detected - previous);
  
  if (diff > 10) {
    // Common OCR digit confusions
    const digitConfusions = {
      '9': ['7', '4'],  // 9 often confused with 7 or 4
      '7': ['9', '1'],  // 7 often confused with 9 or 1
      '8': ['6', '3'],  // 8 often confused with 6 or 3
      '6': ['8', '5'],  // 6 often confused with 8 or 5
      '5': ['6', '3'],  // 5 often confused with 6 or 3
      '1': ['7', '4'],  // 1 often confused with 7 or 4
      '4': ['9', '1'],  // 4 often confused with 9 or 1
      '3': ['8', '5']   // 3 often confused with 8 or 5
    };
    
    const detectedStr = detected.toFixed(1);
    const detectedDigits = detectedStr.replace('.', '').split('');
    
    // Try all possible digit corrections for tens place (most common error)
    const tensPlace = Math.floor(detected / 10) % 10;
    const tensPlaceStr = tensPlace.toString();
    
    if (digitConfusions[tensPlaceStr]) {
      for (const alternativeDigit of digitConfusions[tensPlaceStr]) {
        // Replace tens digit with alternative
        const remainder = detected % 10;
        const newTens = parseInt(alternativeDigit);
        const corrected = Math.floor(detected / 10) - tensPlace + newTens;
        const correctedWeight = corrected * 10 + remainder;
        
        // Check if corrected weight is plausible
        if (Math.abs(correctedWeight - previous) <= 5 && correctedWeight > 20 && correctedWeight < 300) {
          console.log(`🔧 Auto-corrected tens digit: ${tensPlace} → ${alternativeDigit} (${detected} → ${correctedWeight.toFixed(1)})`);
          return {
            corrected: parseFloat(correctedWeight.toFixed(1)),
            wasCorrected: true,
            original: detected,
            correctionReason: `AI likely misread ${tensPlace} as ${alternativeDigit} (OCR error)`
          };
        }
      }
    }
    
    // Try units place correction
    const unitsPlace = Math.floor(detected) % 10;
    const unitsPlaceStr = unitsPlace.toString();
    
    if (digitConfusions[unitsPlaceStr]) {
      for (const alternativeDigit of digitConfusions[unitsPlaceStr]) {
        const wholePart = Math.floor(detected);
        const decimal = detected - wholePart;
        const newUnits = parseInt(alternativeDigit);
        const correctedWhole = wholePart - unitsPlace + newUnits;
        const correctedWeight = correctedWhole + decimal;
        
        if (Math.abs(correctedWeight - previous) <= 5 && correctedWeight > 20 && correctedWeight < 300) {
          console.log(`🔧 Auto-corrected units digit: ${unitsPlace} → ${alternativeDigit} (${detected} → ${correctedWeight.toFixed(1)})`);
          return {
            corrected: parseFloat(correctedWeight.toFixed(1)),
            wasCorrected: true,
            original: detected,
            correctionReason: `AI likely misread ${unitsPlace} as ${alternativeDigit} (OCR error)`
          };
        }
      }
    }
    
    // Fallback: Original logic - try adjusting tens digit to match previous
    const detectedTens = Math.floor(detected / 10);
    const previousTens = Math.floor(previous / 10);
    
    if (Math.abs(detectedTens - previousTens) > 1) {
      const decimal = detected - (detectedTens * 10);
      const corrected = (previousTens * 10) + decimal;
      
      if (Math.abs(corrected - previous) <= 5 && corrected > 20 && corrected < 300) {
        console.log(`🔧 Auto-corrected using previous tens: ${detectedTens} → ${previousTens} (${detected} → ${corrected.toFixed(1)})`);
        return {
          corrected: parseFloat(corrected.toFixed(1)),
          wasCorrected: true,
          original: detected,
          correctionReason: 'Tens digit adjusted to match previous weight'
        };
      }
    }
  }
  
  return {
    corrected: detected,
    wasCorrected: false,
    original: detected,
    correctionReason: null
  };
}

/**
 * Get maximum allowed weight change based on time elapsed
 * Returns time-aware limits to handle users who don't use app regularly
 */
function getMaxAllowedChange(hoursSinceLastEntry) {
  // Competition anti-cheat: strict 1.5 kg limit within 24 hours
  if (hoursSinceLastEntry <= 24) {
    return 1.5; // kg
  }
  
  // User didn't use app for 1-2 days: allow moderate change
  if (hoursSinceLastEntry <= 48) {
    return 2.5; // kg
  }
  
  // User away for 2-7 days: allow more variation
  if (hoursSinceLastEntry <= 168) { // 7 days
    return 5.0; // kg - reasonable weekly change
  }
  
  // More than a week: allow larger change (but still reasonable)
  return 10.0; // kg
}

/**
 * Validate and auto-correct weight change
 * @param {number} detectedWeight - Weight detected by AI
 * @param {number} previousWeight - Previous weight from database
 * @param {string} previousWeightDate - Previous weight date
 * @param {string} unit - Unit ('kg' or 'lbs')
 * @returns {Object} Validation result with auto-correction
 */
export function validateAndCorrectWeight(detectedWeight, previousWeight, previousWeightDate, unit = 'kg') {
  const previousWeightNum = parseFloat(previousWeight);
  
  if (isNaN(previousWeightNum)) {
    return {
      valid: true,
      finalWeight: parseFloat(detectedWeight),
      wasCorrected: false,
      message: 'No previous weight for comparison'
    };
  }

  // Calculate time since last entry
  const previousDate = new Date(previousWeightDate);
  const currentDate = new Date();
  const hoursDifference = (currentDate - previousDate) / (1000 * 60 * 60);
  const daysDifference = Math.floor(hoursDifference / 24);

  // Step 1: Auto-correct if AI misread
  const correction = autoCorrectWeight(detectedWeight, previousWeightNum);
  let workingWeight = correction.corrected;

  // Step 2: Get time-aware maximum allowed change
  const maxChange = getMaxAllowedChange(hoursDifference);
  
  // Step 3: Validate corrected weight against time-aware limit
  const difference = workingWeight - previousWeightNum;
  const absoluteDifference = Math.abs(difference);

  if (absoluteDifference > maxChange) {
    // Still exceeds limit after correction - reject
    const timeContext = hoursDifference <= 24 
      ? 'within 24 hours' 
      : daysDifference <= 2 
        ? `in ${daysDifference} days`
        : `in ${daysDifference} days`;
    
    return {
      valid: false,
      finalWeight: workingWeight,
      wasCorrected: correction.wasCorrected,
      originalWeight: correction.original,
      message: `Weight change of ${absoluteDifference.toFixed(1)} kg ${timeContext} exceeds maximum allowed (${maxChange} kg). Please verify weight.`,
      difference: difference,
      hoursSinceLastEntry: hoursDifference,
      maxAllowed: maxChange
    };
  }

  // Valid weight - return with correction info
  let message = '';
  if (correction.wasCorrected) {
    message = `Weight auto-corrected from ${correction.original} kg to ${workingWeight} kg (${correction.correctionReason || 'AI misread scale'})`;
  } else if (absoluteDifference > 1.0) {
    message = `Weight change of ${Math.abs(difference).toFixed(1)} kg in ${daysDifference} day(s)`;
  }

  return {
    valid: true,
    finalWeight: workingWeight,
    wasCorrected: correction.wasCorrected,
    originalWeight: correction.original,
    correctionReason: correction.correctionReason,
    message: message,
    difference: difference,
    hoursSinceLastEntry: hoursDifference
  };
}
