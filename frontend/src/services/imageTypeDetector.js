// src/services/imageTypeDetector.js
import { weightDetectionService } from './weightDetectionService';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createTokenTracker, trackCombinedTokenUsage } from './tokenCost';

/**
 * Image Type Detector Service using Gemini AI
 * Uses TWO calls: Detection + Analysis for accurate token tracking
 * Types: education (meeting), weight (scale), or food (default)
 */
class ImageTypeDetector {
  constructor() {
    this.initialized = false;
    this.model = null;
    this.tokenTracker = createTokenTracker('gemini-2.5-flash-lite');
  }

  /**
   * Initialize the detector (uses Gemini AI service)
   */
  async initialize() {
    if (this.initialized) return;
    
    console.log('🔧 Initializing Image Type Detector (Gemini AI)...');
    
    try {
      // Initialize own Gemini model for detection
      const apiKey = process.env.REACT_APP_GEMINI_API_KEY;
      if (apiKey) {
        const genAI = new GoogleGenerativeAI(apiKey);
        this.model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
      }
      
      // Also initialize sub-services for detailed analysis
      await weightDetectionService.initialize();
      this.initialized = true;
      console.log('✅ Image Type Detector initialized with Gemini AI');
    } catch (error) {
      console.error('❌ Failed to initialize Gemini AI:', error);
      throw new Error('Failed to initialize image type detector');
    }
  }

  /**
   * Set current user for token tracking
   */
  setCurrentUser(userId, userEmail) {
    this.tokenTracker.setCurrentUser(userId, userEmail);
  }

  /**
   * Detect image type using TWO Gemini calls:
   * 1. Detection call - Identify image type (short prompt)
   * 2. Analysis call - Extract detailed data (type-specific prompt)
   */
  async detectImageType(image, imageFile = null) {
    const startTime = Date.now();
    
    try {
      

      // Initialize if not already done
      if (!this.initialized) {
        await this.initialize();
      }

      // Convert data URL to File if needed
      let imgFile = imageFile || image;
      if (typeof image === 'string' && image.startsWith('data:')) {
        imgFile = this.dataURLToFile(image);
      }

      const imageBase64 = await this.fileToBase64(imgFile);
      const imagePart = {
        inlineData: {
          data: imageBase64.split(',')[1] || imageBase64,
          mimeType: imgFile.type || 'image/jpeg'
        }
      };

      // ═══════════════════════════════════════════════════════════════════════
      // CALL 1: DETECTION - Short prompt to identify image type
      // ═══════════════════════════════════════════════════════════════════════
      const detectionPrompt = `Classify this image into ONE of these categories:

1. "education" - Virtual meeting screenshot (Google Meet, Zoom, MS Teams, WebEx)
2. "weight" - Weighing scale (bathroom scale, digital/analog scale showing weight)
3. "food" - Food, meal, or drink (default if not education or weight)

Return ONLY this JSON:
{
  "type": "education" or "weight" or "food",
  "confidence": 0.0 to 1.0,
  "reason": "brief 5-word explanation"
}`;

      
      const detectionResult = await this.model.generateContent([detectionPrompt, imagePart]);
      const detectionResponse = await detectionResult.response;
      const detectionText = detectionResponse.text();
      const detectionData = this.parseJsonResponse(detectionText);
      const detectionTime = Date.now() - startTime;

      

      // ═══════════════════════════════════════════════════════════════════════
      // CALL 2: ANALYSIS - Type-specific prompt for data extraction
      // ═══════════════════════════════════════════════════════════════════════
      const analysisStartTime = Date.now();
      let analysisPrompt;
      let operationType;

      if (detectionData.type === 'weight') {
        operationType = 'weight_detection';
        analysisPrompt = `Extract weight data from this weighing scale image.

Return ONLY this JSON:
{
  "weight": number (the weight reading),
  "unit": "kg" or "lbs",
  "bmi": number or null,
  "bodyFat": number or null,
  "muscleMass": number or null,
  "bmr": number or null
}

RULES:
- Weight range: 20-300 kg or 44-660 lbs
- Set null for values not visible`;

      } else if (detectionData.type === 'education') {
        operationType = 'education_detection';
        analysisPrompt = `Extract meeting details from this virtual meeting screenshot.

Return ONLY this JSON:
{
  "platform": "Google Meet" or "Zoom" or "MS Teams" or "WebEx" or "Online Meeting",
  "topic": "meeting title if visible, or null"
}`;

      } else {
        operationType = 'image_analysis';
        analysisPrompt = `Analyze this food image and extract nutrition data.

Return ONLY this JSON:
{
  "foods": [
    {
      "name": "food item name",
      "portion": "e.g. 2 idlis or 250ml juice",
      "weight_g": number (for solids),
      "volume_ml": number (for liquids),
      "unit": "g" or "ml",
      "isLiquid": boolean,
      "nutrition": {
        "calories": number,
        "protein": number,
        "carbs": number,
        "fat": number,
        "fiber": number
      }
    }
  ],
  "total": {
    "calories": number,
    "protein": number,
    "carbs": number,
    "fat": number,
    "fiber": number
  }
}

RULES:
- Identify ALL visible food items
- Estimate portions based on plate/container size
- Use standard nutrition values
- Liquids (juice, soup) use volume_ml, solids use weight_g`;
      }

      
      const analysisResult = await this.model.generateContent([analysisPrompt, imagePart]);
      const analysisResponse = await analysisResult.response;
      const analysisText = analysisResponse.text();
      const analysisData = this.parseJsonResponse(analysisText);
      const analysisTime = Date.now() - analysisStartTime;
      const totalTime = Date.now() - startTime;

      

      // ═══════════════════════════════════════════════════════════════════════
      // Track COMBINED token usage (both calls)
      // ═══════════════════════════════════════════════════════════════════════
      await trackCombinedTokenUsage({
        responses: [
          { response: detectionResponse, label: 'Detection' },
          { response: analysisResponse, label: 'Analysis' }
        ],
        operationType,
        modelName: 'gemini-2.5-flash-lite',
        userId: this.tokenTracker.getCurrentUserId(),
        userEmail: this.tokenTracker.getCurrentUserEmail(),
        processingTime: totalTime
      });

      // ═══════════════════════════════════════════════════════════════════════
      // Return result based on detected type
      // ═══════════════════════════════════════════════════════════════════════
      if (detectionData.type === 'education' && detectionData.confidence > 0.7) {
        return {
          type: 'education',
          confidence: detectionData.confidence,
          details: {
            isMeeting: true,
            platform: analysisData.platform || 'Online Meeting',
            topic: analysisData.topic || 'Education Meeting',
            aiAnalysis: true,
            reason: detectionData.reason
          }
        };
      }

      if (detectionData.type === 'weight' && detectionData.confidence > 0.6) {
        return {
          type: 'weight',
          confidence: detectionData.confidence,
          details: {
            isWeightScale: true,
            reason: detectionData.reason,
            aiAnalysis: true,
            weightValue: analysisData.weight || null,
            unit: analysisData.unit || 'kg',
            bmi: analysisData.bmi || null,
            bodyFat: analysisData.bodyFat || null,
            muscleMass: analysisData.muscleMass || null,
            bmr: analysisData.bmr || null
          }
        };
      }

      // Default to food
      return {
        type: 'food',
        confidence: detectionData.confidence || 0.5,
        details: {
          reason: detectionData.reason || 'Default classification',
          aiAnalysis: true,
          foods: analysisData.foods || [],
          total: analysisData.total || null
        }
      };

    } catch (error) {
      console.error('❌ Image type detection failed:', error);
      
      // Default to food on error (safer assumption)
      return {
        type: 'food',
        confidence: 0.3,
        details: {
          error: error.message,
          defaulted: true
        }
      };
    }
  }

  /**
   * Convert file to base64
   */
  async fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Parse JSON response safely
   */
  parseJsonResponse(text) {
    try {
      let cleanText = text.replace(/```json\n?|\n?```/g, '').trim();
      return JSON.parse(cleanText);
    } catch (e) {
      console.warn('⚠️ Failed to parse JSON response:', e.message);
      return { type: 'food', confidence: 0.3 };
    }
  }

  /**
   * Convert data URL to File object
   */
  dataURLToFile(dataURL, filename = 'image.jpg') {
    const arr = dataURL.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    
    return new File([u8arr], filename, { type: mime });
  }

  /**
   * Quick check - same as detectImageType
   */
  async quickCheck(image) {
    const result = await this.detectImageType(image);
    return {
      type: result.type,
      confidence: result.confidence
    };
  }

  /**
   * Cleanup resources
   */
  async terminate() {
    if (this.initialized) {
      await weightDetectionService.terminate();
      this.initialized = false;
    }
  }
}

// Export singleton instance
export const imageTypeDetector = new ImageTypeDetector();
