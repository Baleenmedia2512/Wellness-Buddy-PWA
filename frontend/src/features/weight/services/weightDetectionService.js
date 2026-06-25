/**
 * Weight Detection Service — pure utility methods used by App.js.
 * AI weight detection now goes through /api/ai/orchestrate (orchestratorService).
 */

class WeightDetectionService {
  /** Convert weight between units (pure math, no API call). */
  convertWeight(weight, fromUnit, toUnit) {
    if (fromUnit === toUnit) return weight;
    if (fromUnit === 'kg' && toUnit === 'lbs') return Math.round(weight * 2.20462 * 10) / 10;
    if (fromUnit === 'lbs' && toUnit === 'kg') return Math.round(weight * 0.453592 * 10) / 10;
    return weight;
  }

  /** Validate a detected weight change against the previous entry (pure logic, no API call). */
  validateWeightChange(detectedWeight, previousWeight, previousWeightDate) {
    if (!previousWeight || isNaN(previousWeight)) {
      return { valid: true, warning: false, message: 'First weight entry - no previous data to compare' };
    }
    const detected = parseFloat(detectedWeight);
    const previous = parseFloat(previousWeight);
    const hoursDiff = (new Date() - new Date(previousWeightDate)) / (1000 * 60 * 60);
    const daysDiff = Math.floor(hoursDiff / 24);
    const maxChange = hoursDiff <= 24 ? 1.5 : hoursDiff <= 48 ? 2.5 : hoursDiff <= 168 ? 5.0 : 10.0;
    const diff = detected - previous;
    const absDiff = Math.abs(diff);
    if (absDiff > maxChange) {
      const ctx = hoursDiff <= 24 ? 'in 24 hours' : `in ${daysDiff} day(s)`;
      return {
        valid: false, warning: true,
        message: `⚠️ Detected weight change of ${absDiff.toFixed(1)} kg ${ctx} seems unrealistic (max: ${maxChange} kg).\n\nPlease verify the scale shows ${detected} kg or retake the photo.`,
        detectedWeight: detected, previousWeight: previous, difference: diff, maxAllowed: maxChange, daysSinceLastEntry: daysDiff,
      };
    }
    if (absDiff > 1.0) {
      return { valid: true, warning: true, message: `Weight changed by ${absDiff.toFixed(1)} kg in ${daysDiff} day(s)`, detectedWeight: detected, previousWeight: previous, difference: diff };
    }
    return { valid: true, warning: false, message: 'Weight change looks normal', detectedWeight: detected, previousWeight: previous, difference: diff };
  }
}

export const weightDetectionService = new WeightDetectionService();
export default weightDetectionService;
