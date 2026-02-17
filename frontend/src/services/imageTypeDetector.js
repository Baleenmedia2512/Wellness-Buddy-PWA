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
    this.timeout = 50000; // 50 second timeout per API call
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
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🚀 [IMAGE-DETECTOR] Starting image analysis...');
      console.log('📋 [IMAGE-DETECTOR] Input:', {
        imageType: typeof image,
        isDataURL: typeof image === 'string' && image.startsWith('data:'),
        hasImageFile: !!imageFile,
        imageFileType: imageFile?.type || 'N/A',
        imageFileSize: imageFile?.size ? `${(imageFile.size / 1024).toFixed(1)}KB` : 'N/A',
      });
      console.log('⏱️ [IMAGE-DETECTOR] Timeout: 50s per API call');

      // Initialize if not already done
      if (!this.initialized) {
        console.log('🔧 [IMAGE-DETECTOR] Not initialized, initializing now...');
        await this.initialize();
      }

      // Convert data URL to File if needed
      let imgFile = imageFile || image;
      if (typeof image === 'string' && image.startsWith('data:')) {
        imgFile = this.dataURLToFile(image);
      }

      const imageBase64 = await this.fileToBase64(imgFile);
      console.log('📸 [IMAGE-DETECTOR] Image prepared:', {
        mimeType: imgFile.type || 'image/jpeg',
        base64Length: imageBase64.length,
        sizeKB: `${(imageBase64.length / 1024).toFixed(1)}KB`,
      });
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

      console.log('🔵 [API CALL 1/2] DETECTION API');
      console.log('🔵 Model: gemini-2.5-flash-lite');
      console.log('🔵 Sending detection request...');
      
      const detectionResult = await Promise.race([
        this.model.generateContent([detectionPrompt, imagePart]),
        this.timeoutPromise(this.timeout, 'Detection API timeout after 50s')
      ]);
      const detectionResponse = await detectionResult.response;
      const detectionText = detectionResponse.text();
      console.log('🔵 [API CALL 1/2] Raw response:', detectionText);
      const detectionData = this.parseJsonResponse(detectionText);
      console.log('🤖 [DEBUG] Parsed Detection Data:', detectionData);
      
      // Log detected image type
      console.log(`🔍 Image type detected - ${detectionData.type}`);
      console.log(`🔍 Confidence: ${detectionData.confidence}`);
      console.log(`🔍 Reason: ${detectionData.reason}`);
      
      const detectionTime = Date.now() - startTime;
      console.log(`⏱️ [TIMING] Detection took ${detectionTime}ms`);

      

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

        console.log('🟢 [API CALL 2/2] WEIGHT ANALYSIS API');
        console.log('🟢 Model: gemini-2.5-flash-lite');
        console.log('🟢 Operation: weight_detection');
        console.log('🟢 Prompt:', analysisPrompt);
        console.log('🟢 Calling Gemini API for weight analysis...');

      } else if (detectionData.type === 'education') {
        operationType = 'education_detection';
        analysisPrompt = `Extract meeting details from this virtual meeting screenshot.

Return ONLY this JSON:
{
  "platform": "Google Meet" or "Zoom" or "MS Teams" or "WebEx" or "Online Meeting",
  "topic": "meeting title if visible, or null"
}`;

        console.log('🟢 [API CALL 2/2] EDUCATION ANALYSIS API');
        console.log('🟢 Model: gemini-2.5-flash-lite');
        console.log('🟢 Operation: education_detection');
        console.log('🟢 Prompt:', analysisPrompt);
        console.log('🟢 Calling Gemini API for education analysis...');

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

CRITICAL RULES:
- You MUST return at least ONE food item in the "foods" array - NEVER return an empty array
- If you cannot identify specific dishes, describe what you see (e.g. "Rice dish", "Curry", "Mixed meal")
- For complex plates with multiple curries/sides, list each visible portion separately
- Regional/cultural dishes: identify by appearance (color, texture, consistency) even if unsure of exact name
- If image is blurry or unclear, still provide your BEST GUESS with approximate nutrition values
- Identify ALL visible food items
- Estimate portions based on plate/container size
- Use standard nutrition values
- Liquids (juice, soup) use volume_ml, solids use weight_g`;

        console.log('🟢 [API CALL 2/2] FOOD ANALYSIS API');
        console.log('🟢 Model: gemini-2.5-flash-lite');
        console.log('🟢 Operation: image_analysis (FOOD)');
        console.log('🟢 Prompt length:', analysisPrompt.length, 'chars');
        console.log('🟢 Sending food analysis request...');
      }

      
      let analysisResult = await Promise.race([
        this.model.generateContent([analysisPrompt, imagePart]),
        this.timeoutPromise(this.timeout, 'Food analysis API timeout after 50s')
      ]);
      let analysisResponse = await analysisResult.response;
      let analysisText = analysisResponse.text();
      console.log('🟢 [API CALL 2/2] Raw response:', analysisText);
      let analysisData = this.parseJsonResponse(analysisText);
      console.log('🤖 [DEBUG] Parsed Analysis Data:', analysisData);
      console.log('🤖 [DEBUG] Foods array:', analysisData.foods);
      console.log('🤖 [DEBUG] Foods count:', analysisData.foods?.length || 0);
      console.log('🤖 [DEBUG] Total nutrition:', analysisData.total);
      
      // ═══════════════════════════════════════════════════════════════════════
      // RETRY: If food analysis returned empty foods, retry with enhanced prompt
      // ═══════════════════════════════════════════════════════════════════════
      if (operationType === 'image_analysis' && (!analysisData.foods || analysisData.foods.length === 0)) {
        console.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.warn('⚠️ [RETRY] AI returned empty foods array!');
        console.warn('⚠️ [RETRY] analysisData.foods:', analysisData.foods);
        console.warn('⚠️ [RETRY] Full analysisData:', JSON.stringify(analysisData, null, 2));
        console.warn('⚠️ [RETRY] Retrying with enhanced prompt...');
        console.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        const retryPrompt = `Look at this food image very carefully. I need you to identify ANY food items visible.

Even if the image is blurry, dark, or shows complex plating:
- Describe what you SEE on the plate/container
- If you see rice, say "Rice"
- If you see curry/gravy, say "Curry" or describe its color (e.g. "Yellow Dal", "Brown Gravy")
- If you see bread/roti, say "Roti" or "Flatbread"
- If you see any drink, describe it
- Be as specific as possible, but GENERIC names are acceptable

You MUST return at least 1 food item. DO NOT return an empty foods array.

Return ONLY this JSON:
{
  "foods": [
    {
      "name": "food item name",
      "portion": "estimated portion",
      "weight_g": number,
      "volume_ml": null,
      "unit": "g",
      "isLiquid": false,
      "nutrition": { "calories": number, "protein": number, "carbs": number, "fat": number, "fiber": number }
    }
  ],
  "total": { "calories": number, "protein": number, "carbs": number, "fat": number, "fiber": number }
}`;
        
        try {
          console.log('🔄 [RETRY] Sending retry request...');
          const retryResult = await Promise.race([
            this.model.generateContent([retryPrompt, imagePart]),
            this.timeoutPromise(this.timeout, 'Retry API timeout after 50s')
          ]);
          const retryResponse = await retryResult.response;
          const retryText = retryResponse.text();
          console.log('🔄 [RETRY] Raw response:', retryText);
          const retryData = this.parseJsonResponse(retryText);
          console.log('🔄 [RETRY] Parsed result:', retryData);
          console.log('🔄 [RETRY] Foods count:', retryData.foods?.length || 0);
          
          if (retryData.foods && retryData.foods.length > 0) {
            console.log('✅ [RETRY] Successfully detected foods on retry:', retryData.foods.map(f => f.name).join(', '));
            analysisData = retryData;
            // Use retry response for token tracking
            analysisResponse = retryResponse;
          } else {
            console.warn('⚠️ [RETRY] Retry also returned empty foods');
            console.warn('⚠️ [RETRY] retryData.foods:', retryData.foods);
            console.warn('⚠️ [RETRY] Full retryData:', JSON.stringify(retryData, null, 2));
          }
        } catch (retryError) {
          console.error('❌ [RETRY] Retry failed:', retryError.message);
        }
      }
      
      // Log detected food items
      if (analysisData.foods && analysisData.foods.length > 0) {
        const foodNames = analysisData.foods.map(food => food.name).join(', ');
        console.log(`🍽️ AI detected - ${foodNames}`);
      }
      
      const analysisTime = Date.now() - analysisStartTime;
      const totalTime = Date.now() - startTime;
      console.log(`⏱️ [TIMING] Analysis took ${analysisTime}ms`);
      console.log(`⏱️ [TIMING] Total time: ${totalTime}ms`);

      

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
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🍽️ [RESULT] Returning FOOD result:');
      console.log('🍽️ [RESULT] Foods count:', analysisData.foods?.length || 0);
      console.log('🍽️ [RESULT] Foods:', analysisData.foods?.map(f => `${f.name} (${f.nutrition?.calories || 0} cal)`).join(', ') || 'NONE');
      console.log('🍽️ [RESULT] Total calories:', analysisData.total?.calories || 0);
      console.log('🍽️ [RESULT] Confidence:', detectionData.confidence || 0.5);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      // 🔴 CRITICAL: Set originalAiName for each food BEFORE returning
      // This ensures debug logging shows the correct AI detected name
      const foodsWithOriginalName = (analysisData.foods || []).map(food => ({
        ...food,
        originalAiName: food.name,  // Preserve the AI detected name
        wasAutoCorrected: false,    // Not corrected yet
        correctionSource: null
      }));
      
      return {
        type: 'food',
        confidence: detectionData.confidence || 0.5,
        details: {
          reason: detectionData.reason || 'Default classification',
          aiAnalysis: true,
          foods: foodsWithOriginalName,
          total: analysisData.total || null
        }
      };

    } catch (error) {
      const errorTime = Date.now() - startTime;
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('❌ [IMAGE-DETECTOR] FAILED after', errorTime, 'ms');
      console.error('❌ [IMAGE-DETECTOR] Error:', error.message);
      console.error('❌ [IMAGE-DETECTOR] Error type:', error.name);
      console.error('❌ [IMAGE-DETECTOR] Is timeout?', error.message.includes('timeout'));
      console.error('❌ [IMAGE-DETECTOR] Is API error?', error.message.includes('API') || error.message.includes('429') || error.message.includes('503'));
      console.error('❌ [IMAGE-DETECTOR] Stack:', error.stack);
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
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
   * Timeout helper - rejects after specified ms
   */
  timeoutPromise(ms, message) {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    });
  }

  /**
   * Parse JSON response safely
   */
  parseJsonResponse(text) {
    try {
      let cleanText = text.replace(/```json\n?|\n?```/g, '').trim();
      
      // Try direct parse first
      try {
        return JSON.parse(cleanText);
      } catch (firstError) {
        // Attempt to fix truncated JSON (missing closing brackets)
        console.warn('⚠️ Initial JSON parse failed, attempting fixes...');
        const openBraces = (cleanText.match(/\{/g) || []).length;
        const closeBraces = (cleanText.match(/\}/g) || []).length;
        const openBrackets = (cleanText.match(/\[/g) || []).length;
        const closeBrackets = (cleanText.match(/\]/g) || []).length;
        
        for (let i = 0; i < openBraces - closeBraces; i++) cleanText += '}';
        for (let i = 0; i < openBrackets - closeBrackets; i++) cleanText += ']';
        
        try {
          return JSON.parse(cleanText);
        } catch (secondError) {
          // Try extracting JSON from the text using regex
          const jsonMatch = text.match(/\{[\s\S]*\}/);  
          if (jsonMatch) {
            try {
              return JSON.parse(jsonMatch[0]);
            } catch (thirdError) {
              // Fall through to default
            }
          }
        }
      }
      
      console.warn('⚠️ All JSON parse attempts failed for text:', text.substring(0, 200));
      return { type: 'food', confidence: 0.3 };
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
