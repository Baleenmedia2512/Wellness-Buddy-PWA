// Weight OCR Service for Wellness Buddy
// Uses Tesseract.js to extract weight values from weighing scale photos

import Tesseract from 'tesseract.js';

class WeightOcrService {
  constructor() {
    this.worker = null;
  }

  /**
   * Initialize Tesseract worker (call once at app start)
   */
  async initialize() {
    if (this.worker) return;
    
    try {
      console.log('🔍 Initializing Tesseract OCR worker...');
      this.worker = await Tesseract.createWorker('eng', 1, {
        logger: m => {
          if (m.status === 'recognizing text') {
            console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
          }
        }
      });
      console.log('✅ Tesseract OCR worker ready');
    } catch (error) {
      console.error('❌ Failed to initialize OCR:', error);
      throw error;
    }
  }

  /**
   * Extract weight value from weighing scale image
   * @param {string|File|Blob} image - Image source (base64, URL, or File)
   * @returns {Promise<Object>} { success, weight, unit, confidence, rawText, error }
   */
  async extractWeight(image) {
    try {
      // Initialize worker if not already done
      if (!this.worker) {
        await this.initialize();
      }

      console.log('🔍 Starting OCR weight extraction...');
      
      // Perform OCR
      const { data } = await this.worker.recognize(image);
      const rawText = data.text;
      const confidence = data.confidence;
      
      console.log('📄 Raw OCR text:', rawText);
      console.log('📊 OCR confidence:', confidence);

      // Parse weight from text
      const weightData = this.parseWeightFromText(rawText);

      if (!weightData.success) {
        return {
          success: false,
          weight: null,
          unit: null,
          confidence: confidence,
          rawText: rawText,
          error: 'Unable to detect weight value in image'
        };
      }

      return {
        success: true,
        weight: weightData.weight,
        unit: weightData.unit,
        confidence: confidence,
        rawText: rawText,
        error: null
      };

    } catch (error) {
      console.error('❌ OCR extraction failed:', error);
      return {
        success: false,
        weight: null,
        unit: null,
        confidence: 0,
        rawText: '',
        error: error.message || 'OCR processing failed'
      };
    }
  }

  /**
   * Parse weight value from OCR text using multiple patterns
   * @param {string} text - Raw OCR text
   * @returns {Object} { success, weight, unit }
   */
  parseWeightFromText(text) {
    if (!text) {
      return { success: false, weight: null, unit: null };
    }

    // Clean the text (remove extra spaces, normalize)
    const cleanText = text.replace(/\s+/g, ' ').trim();
    console.log('🧹 Cleaned text:', cleanText);

    // Pattern 1: Direct weight with units (e.g., "72.5 kg", "160 lbs", "72.5kg")
    const patterns = [
      /(\d+\.?\d*)\s*(kg|kilogram|kilograms)/i,
      /(\d+\.?\d*)\s*(lb|lbs|pound|pounds)/i,
      /(\d+\.?\d*)\s*kg/i,
      /(\d+\.?\d*)\s*lb/i,
      // Pattern for numbers that look like weight (20-300 range typically)
      /\b(\d{2,3}\.?\d{0,2})\b/
    ];

    for (const pattern of patterns) {
      const match = cleanText.match(pattern);
      if (match) {
        const value = parseFloat(match[1]);
        let unit = match[2] ? match[2].toLowerCase() : 'kg';
        
        // Normalize unit
        if (unit.includes('lb') || unit.includes('pound')) {
          unit = 'lbs';
        } else {
          unit = 'kg';
        }

        // Validate weight range (reasonable human weight)
        if (this.isValidWeight(value, unit)) {
          console.log(`✅ Weight detected: ${value} ${unit}`);
          return {
            success: true,
            weight: value,
            unit: unit
          };
        }
      }
    }

    // Try to find any decimal number that could be weight
    const numbers = cleanText.match(/\d+\.?\d*/g);
    if (numbers && numbers.length > 0) {
      for (const num of numbers) {
        const value = parseFloat(num);
        // Assume kg if in typical human weight range
        if (value >= 30 && value <= 200) {
          console.log(`✅ Weight detected (assumed kg): ${value} kg`);
          return {
            success: true,
            weight: value,
            unit: 'kg'
          };
        }
      }
    }

    console.log('❌ No valid weight found in text');
    return { success: false, weight: null, unit: null };
  }

  /**
   * Validate if weight value is in reasonable human range
   * @param {number} value - Weight value
   * @param {string} unit - Unit (kg or lbs)
   * @returns {boolean}
   */
  isValidWeight(value, unit) {
    if (unit === 'kg') {
      // Typical human weight range: 20-300 kg
      return value >= 20 && value <= 300;
    } else if (unit === 'lbs') {
      // Typical human weight range: 44-660 lbs
      return value >= 44 && value <= 660;
    }
    return false;
  }

  /**
   * Convert weight between units
   * @param {number} value - Weight value
   * @param {string} fromUnit - Source unit
   * @param {string} toUnit - Target unit
   * @returns {number}
   */
  convertWeight(value, fromUnit, toUnit) {
    if (fromUnit === toUnit) return value;
    
    if (fromUnit === 'kg' && toUnit === 'lbs') {
      return value * 2.20462;
    } else if (fromUnit === 'lbs' && toUnit === 'kg') {
      return value / 2.20462;
    }
    
    return value;
  }

  /**
   * Cleanup and terminate worker
   */
  async terminate() {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      console.log('🛑 OCR worker terminated');
    }
  }
}

// Export singleton instance
const weightOcrService = new WeightOcrService();
export default weightOcrService;
