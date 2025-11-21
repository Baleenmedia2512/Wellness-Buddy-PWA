// src/services/weightDetectionService.js
import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Weight Detection Service using Google Gemini AI
 * Analyzes images to detect weight scale readings
 */
class WeightDetectionService {
  constructor() {
    this.apiKey = process.env.REACT_APP_GEMINI_API_KEY;
    this.genAI = null;
    this.model = null;
    this.timeout = 30000; // 30 second timeout
    this.maxRetries = 2;

    if (this.apiKey) {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
      this.model = this.genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
        generationConfig: {
          temperature: 0.1, // Low temperature for accurate number detection
          topK: 1,
          topP: 0.8,
          maxOutputTokens: 512, // Short response needed
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
    // console.log('🔍 Detecting image type...');

    if (!this.model) {
      throw new Error('Gemini API key is not configured');
    }

    try {
      const imageBase64 = await this.fileToBase64(imageFile);

      const prompt = `Analyze this image and determine if it shows a WEIGHT SCALE (digital or analog weighing scale).

Return ONLY this JSON format:
{
  "isWeightScale": true or false,
  "confidence": 0.0 to 1.0,
  "reason": "brief explanation"
}

Examples:
- Digital bathroom scale showing numbers = true
- Analog scale with dial/needle = true
- Food on plate = false
- Person standing on scale = true
- Empty scale = true`;

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

      // console.log('✅ Image type detection:', data);

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
    // console.log('🔍 WeightDetectionService: Analyzing weight scale image with Gemini AI...');

    if (!this.model) {
      throw new Error('Gemini API key is not configured');
    }

    try {
      // Convert image to base64
      const imageBase64 = await this.fileToBase64(imageFile);

      const prompt = `Analyze this weighing scale image and extract ALL visible measurements.

IMPORTANT: Look for these values on the scale display:
1. Weight (main number) - REQUIRED
2. BMI (Body Mass Index) - if shown
3. Body Fat % - if shown
4. Muscle Mass (kg) - if shown
5. BMR (Basal Metabolic Rate, calories) - if shown

Return ONLY this JSON format:
{
  "weight": number (e.g., 72.5),
  "unit": "kg" or "lbs",
  "bmi": number or null,
  "bodyFat": number or null,
  "muscleMass": number or null,
  "bmr": number or null,
  "confidence": 0.0 to 1.0,
  "detectedValues": ["list of what you found"]
}

RULES:
- Weight is REQUIRED - extract the main/largest number
- Unit: "kg" if metric, "lbs" if imperial
- Only include values you can clearly see
- Set null for values not visible
- Weight range: 20-300 kg or 44-660 lbs
- BMI range: 10-50
- Body Fat: 5-60%
- Confidence: high=0.9+, medium=0.6-0.9, low=<0.6

Examples:
{
  "weight": 72.5,
  "unit": "kg",
  "bmi": 24.3,
  "bodyFat": 18.5,
  "muscleMass": 55.2,
  "bmr": 1650,
  "confidence": 0.95,
  "detectedValues": ["weight", "bmi", "bodyFat", "muscleMass", "bmr"]
}`;

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

      // console.log(`✅ Weight detection completed in ${processingTime}ms:`, data);

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
        confidence: data.confidence || 0.8,
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
   * Initialize service (optional)
   */
  async initialize() {
    // console.log('✅ WeightDetectionService initialized with Gemini AI');
    return Promise.resolve();
  }

  /**
   * Cleanup resources (optional)
   */
  async terminate() {
    // console.log('🔚 WeightDetectionService terminated');
    return Promise.resolve();
  }
}

// Export singleton instance
export const weightDetectionService = new WeightDetectionService();
