// src/services/imageTypeDetector.js
import { weightDetectionService } from './weightDetectionService';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createTokenTracker, trackCombinedTokenUsage } from './tokenCost';
import { applyFallbackNutrition } from './nutritionFallback';

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
      // ⚡ OPTIMIZED: UNIFIED DETECTION & ANALYSIS IN SINGLE API CALL
      // ═══════════════════════════════════════════════════════════════════════
      const unifiedPrompt = `Analyze this image and classify it into ONE category, then extract relevant data.

STEP 1 - CLASSIFY:
- "education" - Online meeting screenshot (Zoom, Meet, Teams, WebEx) OR in-person gathering photo (group of people at club/nutrition center/classroom/wellness center)
- "weight" - Weighing scale showing body weight
- "food" - Food, meal, or drink (DEFAULT if neither education nor weight)

STEP 2 - EXTRACT DATA based on classification:

IF EDUCATION:
{
  "type": "education",
  "confidence": 0.0-1.0,
  "reason": "brief explanation",
  "platform": "Google Meet"|"Zoom"|"MS Teams"|"WebEx"|"Online Meeting"|"Club Meeting"|"In-Person",
  "topic": "meeting title or 'Education Meeting' or null",
  "participantCount": number of visible people (for in-person gatherings)
}

IF WEIGHT:
{
  "type": "weight",
  "confidence": 0.0-1.0,
  "reason": "brief explanation",
  "weight": number (20-300 kg or 44-660 lbs),
  "unit": "kg"|"lbs",
  "bmi": number|null,
  "bodyFat": number|null,
  "muscleMass": number|null,
  "bmr": number|null
}

IF FOOD (default):
{
  "type": "food",
  "confidence": 0.0-1.0,
  "reason": "brief explanation",
  "foods": [
    {
      "name": "food item name",
      "portion": "e.g. 2 idlis, 250ml juice",
      "weight_g": number (solids),
      "volume_ml": number (liquids),
      "unit": "g"|"ml",
      "isLiquid": boolean,
      "nutrition": {"calories": num, "protein": num, "carbs": num, "fat": num, "fiber": num}
    }
  ],
  "total": {"calories": num, "protein": num, "carbs": num, "fat": num, "fiber": num}
}

CRITICAL RULES:
- If you see a WEIGHING SCALE (bathroom scale, body composition scale) with digital/analog display showing numbers = "weight" (HIGHEST PRIORITY)
- If you see MULTIPLE PEOPLE gathered together (not eating, not on a scale) = "education"
- If you see food/meals on plates/bowls = "food"
- For FOOD: MUST return at least ONE food item - NEVER empty array
- For FOOD: If unclear, describe what you see (Rice, Curry, Mixed meal)

⚠️ WEIGHT SCALE DETECTION:
- Look for: digital displays with numbers, scale platform, feet on scale, bathroom scale design
- Common scale types: digital scales, smart scales (with BF%, BMI), analog scales with dial
- If ANY scale-like device is visible with weight measurement = classify as "weight"
- Do NOT confuse scales with phones, tablets, or meeting screens

🔥 NUTRITION ESTIMATION RULES (CRITICAL):
- NEVER return 0 for calories UNLESS truly zero-calorie (water, black tea, black coffee only)
- If unsure about exact values, provide REASONABLE ESTIMATES based on:
  * Typical serving size for that food type
  * Visual portion size in the image
  * Standard nutrition for that cuisine/category
- Indian food examples:
  * Lemon Rice (1 plate ~150g) = ~230 cal, 45g carbs, 4g protein, 5g fat
  * Biryani (1 plate ~200g) = ~350 cal, 48g carbs, 12g protein, 12g fat
  * Idli (1 piece ~40g) = ~39 cal, 8g carbs, 2g protein, 0.2g fat
  * Dosa (1 piece ~70g) = ~133 cal, 20g carbs, 4g protein, 4g fat
- If genuinely cannot estimate, use category averages (rice dish ~200 cal/100g, curry ~80 cal/100g)
- ALWAYS provide estimates - empty/null nutrition is NOT acceptable

Return ONLY JSON matching ONE of the above formats.`;

      console.log('⚡ [UNIFIED API] Single call for detection + analysis');
      console.log('⚡ Model: gemini-2.5-flash-lite');
      console.log('⚡ Calling Gemini API...');
      
      const apiCallStart = Date.now();
      const apiResult = await Promise.race([
        this.model.generateContent([unifiedPrompt, imagePart]),
        this.timeoutPromise(this.timeout, 'Unified API timeout after 50s')
      ]);
      const apiCallTime = Date.now() - apiCallStart;
      console.log(`⏱️ [PERF] 🎯 Gemini API response received: ${apiCallTime}ms`);
      
      const apiResponse = await apiResult.response;
      const apiText = apiResponse.text();
      console.log('⚡ [UNIFIED API] Raw response:', apiText.substring(0, 300) + '...');
      
      const parseStart = Date.now();
      const analysisData = this.parseJsonResponse(apiText);
      console.log(`⏱️ [PERF] JSON parsing: ${Date.now() - parseStart}ms`);
      console.log('🤖 [DEBUG] Parsed Result:', {
        type: analysisData.type,
        confidence: analysisData.confidence,
        hasFoods: !!analysisData.foods,
        foodsCount: analysisData.foods?.length || 0,
        hasWeight: !!analysisData.weight
      });
      
      // 🔍 LOG RAW AI NUTRITION DATA (before any fallback)
      if (analysisData.type === 'food' && analysisData.foods) {
        console.log('🤖 [RAW AI NUTRITION] What AI returned BEFORE fallback:');
        analysisData.foods.forEach((food, idx) => {
          const cal = food.nutrition?.calories;
          const protein = food.nutrition?.protein;
          const carbs = food.nutrition?.carbs;
          const fat = food.nutrition?.fat;
          const status = (cal === 0 || cal === undefined) ? '❌ NEEDS FALLBACK' : '✅ HAS DATA';
          console.log(`   ${idx + 1}. "${food.name}": ${cal || 0} cal, ${carbs || 0}g carbs, ${protein || 0}g protein, ${fat || 0}g fat ${status}`);
        });
      }
      
      // Determine operation type for tracking
      let operationType = 'image_analysis'; // default
      if (analysisData.type === 'education') operationType = 'education_detection';
      if (analysisData.type === 'weight') operationType = 'weight_detection';
      
      // Log detected type
      console.log(`🔍 Detected: ${analysisData.type} (confidence: ${analysisData.confidence})`);
      
      const totalTime = Date.now() - startTime;
      console.log(`⏱️ [TIMING] Total time: ${totalTime}ms (50% faster!)`);

      // ═══════════════════════════════════════════════════════════════════════
      // Track token usage (single call)
      // ═══════════════════════════════════════════════════════════════════════
      await trackCombinedTokenUsage({
        responses: [
          { response: apiResponse, label: 'Unified' }
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
      if (analysisData.type === 'education' && analysisData.confidence > 0.7) {
        return {
          type: 'education',
          confidence: analysisData.confidence,
          details: {
            isMeeting: true,
            platform: analysisData.platform || 'Online Meeting',
            topic: 'Education Meeting',
            aiAnalysis: true,
            reason: analysisData.reason
          }
        };
      }

      if (analysisData.type === 'weight' && analysisData.confidence > 0.6) {
        return {
          type: 'weight',
          confidence: analysisData.confidence,
          details: {
            isWeightScale: true,
            reason: analysisData.reason,
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
      console.log('🍽️ [RESULT] Confidence:', analysisData.confidence || 0.5);
      
      // 🔴 CRITICAL: Apply fallback nutrition for foods with 0 or missing nutrition
      let foodsWithNutrition = analysisData.foods || [];
      if (foodsWithNutrition.length > 0) {
        console.log('🔧 [NUTRITION-CHECK] Checking for missing nutrition values...');
        const beforeFallback = foodsWithNutrition.map(f => ({
          name: f.name,
          calories: f.nutrition?.calories || 0
        }));
        
        foodsWithNutrition = applyFallbackNutrition(foodsWithNutrition);
        
        const afterFallback = foodsWithNutrition.map(f => ({
          name: f.name,
          calories: f.nutrition?.calories || f.calories || 0,
          source: f.nutritionSource || 'ai'
        }));
        
        console.log('🔧 [NUTRITION-CHECK] Before fallback:', beforeFallback);
        console.log('🔧 [NUTRITION-CHECK] After fallback:', afterFallback);
      }
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      // 🔴 CRITICAL: Set originalAiName for each food BEFORE returning
      // This ensures debug logging shows the correct AI detected name
      const foodsWithOriginalName = foodsWithNutrition.map(food => ({
        ...food,
        originalAiName: food.name,  // Preserve the AI detected name
        wasAutoCorrected: false,    // Not corrected yet
        correctionSource: null
      }));
      
      return {
        type: 'food',
        confidence: analysisData.confidence || 0.5,
        details: {
          reason: analysisData.reason || 'Default classification',
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
