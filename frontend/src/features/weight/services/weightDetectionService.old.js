// src/services/weightDetectionService.js
import { GoogleGenerativeAI } from '@google/generative-ai';
import { debugLog } from '../../../shared/utils/logger.js';

/**
 * Weight Detection Service using Google Gemini AI
 * Analyzes images to detect weight scale readings
 */
class WeightDetectionService {
  constructor() {
    this.apiKey = process.env.REACT_APP_GEMINI_API_KEY;
    this.genAI = null;
    this.model = null;
    this.timeout = 60000; // 60 second timeout
    this.maxRetries = 2;

    if (this.apiKey) {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
      this.model = this.genAI.getGenerativeModel({
        model: "gemini-2.5-flash-lite",
        generationConfig: {
          temperature: 0.1, // Low temperature for accurate number detection
          topK: 1,
          topP: 1.0, // Increased for faster, more confident predictions
          maxOutputTokens: 1024, // Reduced from 2048 (sufficient for weight data)
        }
      });
    }
  }

  /**
   * Detect if image is a weight scale
   * @param {File} imageFile - Image file to analyze
   * @returns {Promise<{isWeightScale: boolean, confidence: number}>}
   */
  async detectImageType(imageFile) {
    // debugLog('🔍 Detecting image type...');

    if (!this.model) {
      throw new Error('Gemini API key is not configured');
    }

    try {
      const imageBase64 = await this.fileToBase64(imageFile);

      const prompt = `Is this a WEIGHT SCALE? JSON only.

{
  "isWeightScale": bool,
  "confidence": 0-1,
  "reason": "brief"
}

Examples:
✅ Digital/analog scale, person on scale, empty scale
❌ Food, plates`;

      const imagePart = {
        inlineData: {
          data: imageBase64,
          mimeType: imageFile.type
        }
      };

      const result = await this.makeApiCallWithRetry(
        () => this.model.generateContent([prompt, imagePart]),
        this.maxRetries
      );

      const response = await result.response;
      const text = response.text();
      const data = this.parseJsonResponse(text);

      // debugLog('✅ Image type detection:', data);

      return {
        isWeightScale: data.isWeightScale || false,
        confidence: data.confidence || 0,
        reason: data.reason || 'Unknown'
      };

    } catch (error) {
      console.error('❌ Image type detection failed:', error);
      // Default to not a weight scale on error
      return {
        isWeightScale: false,
        confidence: 0,
        reason: error.message
      };
    }
  }

  /**
   * Extract weight value from scale image using Gemini AI
   * @param {File} imageFile - Image file of weight scale
   * @returns {Promise<{success: boolean, weightValue: number, unit: string, confidence: number, bmi?: number, bodyFat?: number, muscleMass?: number, bmr?: number}>}
   */
  async extractWeightFromImage(imageFile) {
    const startTime = Date.now();
    // debugLog('🔍 WeightDetectionService: Analyzing weight scale image with Gemini AI...');

    if (!this.model) {
      throw new Error('Gemini API key is not configured');
    }

    try {
      // Convert image to base64
      const imageBase64 = await this.fileToBase64(imageFile);

      const prompt = `Extract scale readings from this weight scale display. Be EXTREMELY CAREFUL with digit recognition to avoid OCR errors.

⚠️ COMMON OCR ERRORS TO AVOID:
- DO NOT confuse 7 with 9 or 1
- DO NOT confuse 6 with 8
- DO NOT confuse 5 with 6 or 8
- Verify each digit independently
- Double-check the tens digit (most critical)

LOOK FOR: Weight (required), BMI, Body Fat %, Muscle Mass, BMR

Return JSON ONLY:
{
  "weight": number,
  "unit": "kg"|"lbs",
  "bmi": number|null,
  "bodyFat": number|null,
  "muscleMass": number|null,
  "bmr": number|null,
  "confidence": 0-1,
  "detectedValues": ["weight", ...],
  "digitConfidence": 0-1
}

VALIDATION RULES:
- Weight: 20-300 kg or 44-660 lbs
- BMI: 10-50, Body Fat: 5-60%
- Confidence: Set 0.95+ ONLY if ALL digits are crystal clear
- Set digitConfidence to 0.9+ only if you're certain about each digit
- If display is blurry or digits unclear, set confidence < 0.7
- Null if metric not visible

ACCURACY IS CRITICAL - A single wrong digit can ruin user experience.`;

      const imagePart = {
        inlineData: {
          data: imageBase64,
          mimeType: imageFile.type
        }
      };

      // Make API call with retry
      const result = await this.makeApiCallWithRetry(
        () => this.model.generateContent([prompt, imagePart]),
        this.maxRetries
      );

      const response = await result.response;
      const text = response.text();

      // Parse the JSON response
      const data = this.parseJsonResponse(text);
      const processingTime = Date.now() - startTime;

      // debugLog(`✅ Weight detection completed in ${processingTime}ms:`, data);

      // Validate weight value
      if (!data.weight) {
        return {
          success: false,
          weightValue: null,
          unit: 'kg',
          confidence: 0,
          error: 'No weight value detected in image'
        };
      }

      // Check confidence threshold - reject low confidence readings
      const overallConfidence = data.confidence || 0;
      const digitConfidence = data.digitConfidence || data.confidence || 0;
      
      if (overallConfidence < 0.6 || digitConfidence < 0.65) {
        return {
          success: false,
          weightValue: parseFloat(data.weight),
          unit: data.unit || 'kg',
          confidence: overallConfidence,
          digitConfidence: digitConfidence,
          error: 'Image quality too low for accurate reading. Please retake with better lighting and focus.',
          lowConfidence: true
        };
      }

      // Validate weight range
      const validation = this.validateWeight(data.weight, data.unit || 'kg');
      if (!validation.valid) {
        return {
          success: false,
          weightValue: null,
          unit: data.unit || 'kg',
          confidence: 0,
          error: validation.error
        };
      }

      // Return success with all detected values
      return {
        success: true,
        weightValue: parseFloat(data.weight),
        unit: data.unit || 'kg',
        confidence: overallConfidence,
        digitConfidence: digitConfidence,
        bmi: data.bmi ? parseFloat(data.bmi) : null,
        bodyFat: data.bodyFat ? parseFloat(data.bodyFat) : null,
        muscleMass: data.muscleMass ? parseFloat(data.muscleMass) : null,
        bmr: data.bmr ? parseInt(data.bmr) : null,
        detectedValues: data.detectedValues || ['weight'],
        rawText: text
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`❌ Weight detection failed after ${processingTime}ms:`, error);

      return {
        success: false,
        weightValue: null,
        unit: 'kg',
        confidence: 0,
        error: error.message || 'Failed to detect weight from image',
        rawText: ''
      };
    }
  }

  /**
   * Validate weight value
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
   * Utility: Make API call with retry logic
   */
  async makeApiCallWithRetry(apiCall, maxRetries) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await Promise.race([
          apiCall(),
          this.timeoutPromise(this.timeout, `API timeout after ${this.timeout}ms`)
        ]);
      } catch (error) {
        console.warn(`❌ Attempt ${attempt} failed:`, error.message);

        if (attempt === maxRetries) {
          throw error;
        }

        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Utility: Timeout promise
   */
  timeoutPromise(ms, message) {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    });
  }

  /**
   * Utility: Parse JSON response
   */
  parseJsonResponse(text) {
    try {
      // Clean markdown code blocks if present
      const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();
      return JSON.parse(cleanText);
    } catch (parseError) {
      console.error('Failed to parse JSON response:', text);
      throw new Error('Invalid JSON response from Gemini AI');
    }
  }

  /**
   * Utility: Convert File to Base64
   */
  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Validate detected weight against previous weight for realistic changes
   * @param {number} detectedWeight - Weight detected by AI (in kg)
   * @param {number} previousWeight - Previous weight from database (in kg)
   * @param {string} previousWeightDate - Date of previous weight entry
   * @returns {Object} Validation result with suggestions
   */
  validateWeightChange(detectedWeight, previousWeight, previousWeightDate) {
    if (!previousWeight || isNaN(previousWeight)) {
      return {
        valid: true,
        warning: false,
        message: 'First weight entry - no previous data to compare'
      };
    }

    const detected = parseFloat(detectedWeight);
    const previous = parseFloat(previousWeight);
    
    // Calculate time since last entry
    const previousDate = new Date(previousWeightDate);
    const currentDate = new Date();
    const hoursDifference = (currentDate - previousDate) / (1000 * 60 * 60);
    const daysDifference = Math.floor(hoursDifference / 24);

    const difference = detected - previous;
    const absoluteDifference = Math.abs(difference);

    // Time-aware maximum allowed change
    let maxChange;
    if (hoursDifference <= 24) {
      maxChange = 1.5; // Within 24 hours
    } else if (hoursDifference <= 48) {
      maxChange = 2.5; // 1-2 days
    } else if (hoursDifference <= 168) {
      maxChange = 5.0; // Up to 7 days
    } else {
      maxChange = 10.0; // More than a week
    }

    // Check for large unrealistic changes
    if (absoluteDifference > maxChange) {
      const timeContext = hoursDifference <= 24 
        ? 'in 24 hours' 
        : `in ${daysDifference} day(s)`;
      
      return {
        valid: false,
        warning: true,
        message: `⚠️ Detected weight change of ${absoluteDifference.toFixed(1)} kg ${timeContext} seems unrealistic (max: ${maxChange} kg).\n\nPossible issues:\n• AI may have misread the scale\n• Image quality might be poor\n• Wrong image uploaded\n\nPlease verify the scale shows ${detected} kg or retake the photo.`,
        detectedWeight: detected,
        previousWeight: previous,
        difference: difference,
        maxAllowed: maxChange,
        daysSinceLastEntry: daysDifference
      };
    }

    // Moderate change - show warning but allow
    if (absoluteDifference > 1.0) {
      return {
        valid: true,
        warning: true,
        message: `Weight changed by ${Math.abs(difference).toFixed(1)} kg in ${daysDifference} day(s)`,
        detectedWeight: detected,
        previousWeight: previous,
        difference: difference
      };
    }

    return {
      valid: true,
      warning: false,
      message: 'Weight change looks normal',
      detectedWeight: detected,
      previousWeight: previous,
      difference: difference
    };
  }

  /**
   * Initialize service (optional)
   */
  async initialize() {
    debugLog('✅ WeightDetectionService initialized with Gemini AI');
    return Promise.resolve();
  }

  /**
   * Cleanup resources (optional)
   */
  async terminate() {
    debugLog('🔚 WeightDetectionService terminated');
    return Promise.resolve();
  }
}

// Export singleton instance
export const weightDetectionService = new WeightDetectionService();
