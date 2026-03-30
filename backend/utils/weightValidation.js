/**
 * Weight Validation and Auto-Correction Utility
 * Intelligently corrects AI misreadings and prevents unrealistic weight changes
 */

/**
 * Auto-correct weight if AI misread the number
 * Example: AI reads 95.6 but previous was 74.8 → corrects to 75.6
 */
function autoCorrectWeight(detectedWeight, previousWeight) {
  const detected = parseFloat(detectedWeight);
  const previous = parseFloat(previousWeight);
  
  // If difference is huge (>10 kg), likely AI misread a digit
  const diff = Math.abs(detected - previous);
  
  if (diff > 10) {
    // Try to find nearest plausible weight by adjusting tens digit
    const detectedStr = detected.toFixed(1);
    const previousStr = previous.toFixed(1);
    
    // Extract digits
    const detectedTens = Math.floor(detected / 10);
    const previousTens = Math.floor(previous / 10);
    
    // If tens digit differs significantly, try swapping
    if (Math.abs(detectedTens - previousTens) > 1) {
      // Keep decimal part from detected, use tens from previous
      const decimal = detected - (detectedTens * 10);
      const corrected = (previousTens * 10) + decimal;
      
      // Check if corrected weight is within reasonable range of previous
      if (Math.abs(corrected - previous) <= 5) {
        return {
          corrected: parseFloat(corrected.toFixed(1)),
          wasCorrected: true,
          original: detected
        };
      }
    }
  }
  
  return {
    corrected: detected,
    wasCorrected: false,
    original: detected
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
    message = `Weight auto-corrected from ${correction.original} kg to ${workingWeight} kg (AI misread scale)`;
  } else if (absoluteDifference > 1.0) {
    message = `Weight change of ${Math.abs(difference).toFixed(1)} kg in ${daysDifference} day(s)`;
  }

  return {
    valid: true,
    finalWeight: workingWeight,
    wasCorrected: correction.wasCorrected,
    originalWeight: correction.original,
    message: message,
    difference: difference,
    hoursSinceLastEntry: hoursDifference
  };
}
