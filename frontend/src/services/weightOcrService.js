// src/services/weightOcrService.js
import Tesseract from 'tesseract.js';

class WeightOcrService {
  constructor() {
    this.worker = null;
    this.isInitialized = false;
  }

  /**
   * Initialize Tesseract worker
   */
  async initialize() {
    if (this.isInitialized && this.worker) {
      return;
    }

    try {
      console.log('🔧 Initializing Tesseract OCR...');
      this.worker = await Tesseract.createWorker('eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
          }
        }
      });
      this.isInitialized = true;
      console.log('✅ Tesseract OCR initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Tesseract:', error);
      throw new Error('Failed to initialize OCR service');
    }
  }

  /**
   * Extract weight value from image using OCR
   * @param {string|File} image - Image data URL or File object
   * @returns {Promise<{success: boolean, weightValue: number|null, unit: string, confidence: number, rawText: string, error?: string}>}
   */
  async extractWeightFromImage(image) {
    try {
      // Initialize worker if not already done
      await this.initialize();

      console.log('📸 Starting OCR on weighing scale image...');

      // Perform OCR
      const { data } = await this.worker.recognize(image);
      const rawText = data.text;
      
      console.log('📝 Raw OCR text:', rawText);

      // Parse weight from text
      const weightData = this.parseWeightFromText(rawText);

      if (!weightData.success) {
        return {
          success: false,
          weightValue: null,
          unit: 'kg',
          confidence: 0,
          rawText,
          error: weightData.error || 'Unable to detect weight value'
        };
      }

      return {
        success: true,
        weightValue: weightData.value,
        unit: weightData.unit,
        confidence: data.confidence / 100, // Convert to 0-1 scale
        rawText
      };

    } catch (error) {
      console.error('❌ OCR extraction failed:', error);
      return {
        success: false,
        weightValue: null,
        unit: 'kg',
        confidence: 0,
        rawText: '',
        error: error.message || 'OCR processing failed'
      };
    }
  }

  /**
   * Parse weight value from OCR text
   * Looks for patterns like: "72.5", "72.5kg", "72.5 kg", "160 lbs", etc.
   * @param {string} text - Raw OCR text
   * @returns {{success: boolean, value: number|null, unit: string, error?: string}}
   */
  parseWeightFromText(text) {
    if (!text || typeof text !== 'string') {
      return { success: false, value: null, unit: 'kg', error: 'No text provided' };
    }

    // Clean up text: remove extra whitespace, newlines
    const cleanText = text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

    // Common OCR mistakes mapping
    const ocrCorrections = {
      'O': '0',
      'o': '0',
      'l': '1',
      'I': '1',
      'S': '5',
      'B': '8',
      'Z': '2'
    };

    // Pattern to match weight values
    // Matches: 72.5, 72,5, 160.2, 72.5kg, 72.5 kg, 160 lbs, etc.
    const weightPatterns = [
      // Pattern 1: Number with optional decimal (dot or comma) + optional unit
      /(\d+[.,]?\d*)\s*(kg|kgs|kilogram|kilograms|lb|lbs|pound|pounds)?/gi,
      
      // Pattern 2: Isolated numbers (fallback)
      /(\d{2,3}[.,]\d{1,2})/g,
      
      // Pattern 3: Just integers between 30-300 (reasonable weight range)
      /\b(\d{2,3})\b/g
    ];

    let bestMatch = null;
    let bestConfidence = 0;

    for (const pattern of weightPatterns) {
      const matches = cleanText.matchAll(pattern);
      
      for (const match of matches) {
        let valueStr = match[1];
        let unit = match[2] ? match[2].toLowerCase() : 'kg';

        // Normalize unit
        if (unit.includes('lb') || unit.includes('pound')) {
          unit = 'lbs';
        } else {
          unit = 'kg';
        }

        // Convert comma to dot for decimal separator
        valueStr = valueStr.replace(',', '.');

        // Apply OCR corrections for common mistakes
        let correctedValue = valueStr;
        for (const [wrong, correct] of Object.entries(ocrCorrections)) {
          correctedValue = correctedValue.replace(new RegExp(wrong, 'g'), correct);
        }

        const value = parseFloat(correctedValue);

        // Validate weight range (reasonable human weight: 20kg - 300kg or 44lbs - 660lbs)
        const minWeight = unit === 'kg' ? 20 : 44;
        const maxWeight = unit === 'kg' ? 300 : 660;

        if (!isNaN(value) && value >= minWeight && value <= maxWeight) {
          // Calculate confidence based on various factors
          let confidence = 0.5; // Base confidence

          // Higher confidence if unit is explicitly mentioned
          if (match[2]) confidence += 0.2;

          // Higher confidence if value has decimal point
          if (valueStr.includes('.')) confidence += 0.15;

          // Higher confidence if in common weight range (50-120kg or 110-265lbs)
          const commonMin = unit === 'kg' ? 50 : 110;
          const commonMax = unit === 'kg' ? 120 : 265;
          if (value >= commonMin && value <= commonMax) confidence += 0.15;

          if (confidence > bestConfidence) {
            bestMatch = { value, unit };
            bestConfidence = confidence;
          }
        }
      }
    }

    if (bestMatch) {
      // Round to 1 decimal place
      bestMatch.value = Math.round(bestMatch.value * 10) / 10;
      
      console.log('✅ Weight detected:', bestMatch.value, bestMatch.unit, 'Confidence:', bestConfidence);
      return { success: true, ...bestMatch };
    }

    return { 
      success: false, 
      value: null, 
      unit: 'kg', 
      error: 'No valid weight value detected in image' 
    };
  }

  /**
   * Validate weight value
   * @param {number} weight - Weight value to validate
   * @param {string} unit - Weight unit (kg or lbs)
   * @returns {{valid: boolean, error?: string}}
   */
  validateWeight(weight, unit = 'kg') {
    if (typeof weight !== 'number' || isNaN(weight)) {
      return { valid: false, error: 'Weight must be a valid number' };
    }

    if (weight <= 0) {
      return { valid: false, error: 'Weight must be greater than 0' };
    }

    const minWeight = unit === 'kg' ? 20 : 44;
    const maxWeight = unit === 'kg' ? 300 : 660;

    if (weight < minWeight || weight > maxWeight) {
      return { 
        valid: false, 
        error: `Weight must be between ${minWeight} and ${maxWeight} ${unit}` 
      };
    }

    return { valid: true };
  }

  /**
   * Convert weight between units
   * @param {number} weight - Weight value
   * @param {string} fromUnit - Source unit (kg or lbs)
   * @param {string} toUnit - Target unit (kg or lbs)
   * @returns {number} Converted weight value
   */
  convertWeight(weight, fromUnit, toUnit) {
    if (fromUnit === toUnit) return weight;

    if (fromUnit === 'kg' && toUnit === 'lbs') {
      return Math.round(weight * 2.20462 * 10) / 10;
    }

    if (fromUnit === 'lbs' && toUnit === 'kg') {
      return Math.round(weight * 0.453592 * 10) / 10;
    }

    return weight;
  }

  /**
   * Cleanup resources
   */
  async terminate() {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      this.isInitialized = false;
      console.log('🔚 Tesseract OCR terminated');
    }
  }
}

// Export singleton instance
export const weightOcrService = new WeightOcrService();
