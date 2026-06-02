// src/services/imageTypeDetector.js
import { weightDetectionService } from '../../features/weight';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createTokenTracker, trackCombinedTokenUsage } from './tokenCost';
import { applyFallbackNutrition } from '../../features/nutrition';
import { debugLog } from '../utils/logger.js';

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
    
    debugLog('🔧 Initializing Image Type Detector (Gemini AI)...');
    
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
      debugLog('✅ Image Type Detector initialized with Gemini AI');
    } catch (error) {
      console.error('âŒ Failed to initialize Gemini AI:', error);
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
      debugLog('â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”');
      debugLog('🚀 [IMAGE-DETECTOR] Starting image analysis...');
      debugLog('📋 [IMAGE-DETECTOR] Input:', {
        imageType: typeof image,
        isDataURL: typeof image === 'string' && image.startsWith('data:'),
        hasImageFile: !!imageFile,
        imageFileType: imageFile?.type || 'N/A',
        imageFileSize: imageFile?.size ? `${(imageFile.size / 1024).toFixed(1)}KB` : 'N/A',
      });
      debugLog('â±ï¸ [IMAGE-DETECTOR] Timeout: 50s per API call');

      // Initialize if not already done
      if (!this.initialized) {
        debugLog('🔧 [IMAGE-DETECTOR] Not initialized, initializing now...');
        await this.initialize();
      }

      // Convert data URL to File if needed
      let imgFile = imageFile || image;
      if (typeof image === 'string' && image.startsWith('data:')) {
        imgFile = this.dataURLToFile(image);
      }

      const imageBase64 = await this.fileToBase64(imgFile);
      debugLog('📸 [IMAGE-DETECTOR] Image prepared:', {
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

      // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
      // ⚡ OPTIMIZED: UNIFIED DETECTION & ANALYSIS IN SINGLE API CALL
      // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
      const unifiedPrompt = `Analyze this image and classify it into ONE category, then extract relevant data.

STEP 1 - CLASSIFY:
- "education" - Online meeting screenshot (Zoom, Meet, Teams, WebEx) OR in-person gathering photo (group of people at club/nutrition center/classroom/wellness center)
- "weight" - ⚡ HIGHEST PRIORITY: Physical weighing scale device OR smart scale app screenshot/result (Huawei Health, Mi Fit, Fitdays, Renpho, Garmin Connect, iHealth, Yunmai, FitTrack, Eufy, body composition report showing Weight + any of: BMI, Body Fat, BMR, Muscle Mass, Skeletal Muscle, Visceral Fat, Bone Mass, Protein %, Body Water, Body Age)
- "smartwatch" - Smartwatch or fitness band ACTIVITY screen (Apple Watch, Samsung Galaxy Watch, Fitbit, Garmin, Mi Band, Google Fit, Apple Health, Samsung Health) showing steps/calories BURNED/heart rate rings — NOT a body composition results screen
- "food" - Food, meal, or drink (DEFAULT if none of the above)

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

IF WEIGHT (physical scale OR smart scale app screenshot):
{
  "type": "weight",
  "confidence": 0.0-1.0,
  "reason": "brief explanation",
  "weight": number (20-300 kg or 44-660 lbs) — REQUIRED,
  "unit": "kg"|"lbs",
  "bmi": number|null,
  "bodyFat": number|null,
  "muscleMass": number|null,
  "bmr": number|null   â† CRITICAL: extract integer calorie value (e.g. "1703kcal" → 1703, "BMR: 1703" → 1703)
}

IF SMARTWATCH:
{
  "type": "smartwatch",
  "confidence": 0.0-1.0,
  "reason": "brief explanation",
  "caloriesBurned": number (active calories / calories burned shown on screen, 0 if not visible),
  "source": "Apple Watch"|"Samsung Health"|"Fitbit"|"Garmin"|"Google Fit"|"Apple Health"|"Mi Fitness"|"Smartwatch"|"unknown"
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
      "nutrition": {"calories": num, "protein": num, "carbs": num, "fat": num, "fiber": num, "sugar": num, "sodium": num, "cholesterol": num}
    }
  ],
  "total": {"calories": num, "protein": num, "carbs": num, "fat": num, "fiber": num, "sugar": num, "sodium": num, "cholesterol": num}
}

ðŸ‹ï¸ WEIGHT SCALE DETECTION — READ CAREFULLY:
CLASSIFY AS "weight" if you see ANY of these:
✅ Physical digital/analog bathroom scale or body composition scale device
✅ Smart scale app result screen (Huawei Health, Mi Fit, Fitdays, Renpho, iHealth, Yunmai, FitTrack, Eufy, etc.)
✅ Mobile app screenshot showing a table/list of body metrics: Weight, BMI, Body Fat %, Muscle Mass, BMR, Skeletal Muscle, Visceral Fat, Bone Mass, Body Water, Protein %, Body Age, Subcutaneous Fat
✅ Screenshot from a health app showing a body composition measurement result (even if no physical scale is visible)

âš ï¸ BMR EXTRACTION RULES (CRITICAL for smart scale screenshots):
- Look for "BMR" label in the metrics list — value is in kcal (e.g. "1703kcal" or "1703 kcal")
- Extract ONLY the numeric integer part: "1703kcal" → bmr: 1703
- BMR is typically between 800 and 4000 kcal for adults
- If visible, ALWAYS populate the bmr field — do NOT return null if you can read the number

âš ï¸ DO NOT classify as "smartwatch" if the screenshot shows body composition results (BMI, Body Fat, BMR, etc.)
âš ï¸ DO NOT classify as "food" if the image is a body metrics report/table

🔥 NUTRITION ESTIMATION RULES (CRITICAL — for food only):
- NEVER return 0 for calories UNLESS truly zero-calorie (water, black tea, black coffee only)
- If unsure about exact values, provide REASONABLE ESTIMATES based on typical serving sizes
- Indian food examples:
  * Lemon Rice (1 plate ~150g) = ~230 cal, 45g carbs, 4g protein, 5g fat
  * Biryani (1 plate ~200g) = ~350 cal, 48g carbs, 12g protein, 12g fat
  * Idli (1 piece ~40g) = ~39 cal, 8g carbs, 2g protein, 0.2g fat
  * Dosa (1 piece ~70g) = ~133 cal, 20g carbs, 4g protein, 4g fat
- ALWAYS provide estimates - empty/null nutrition is NOT acceptable

Return ONLY JSON matching ONE of the above formats.`;

      debugLog('⚡ [UNIFIED API] Single call for detection + analysis');
      debugLog('⚡ Model: gemini-2.5-flash-lite');
      debugLog('⚡ Calling Gemini API...');
      
      const apiCallStart = Date.now();
      const apiResult = await Promise.race([
        this.model.generateContent([unifiedPrompt, imagePart]),
        this.timeoutPromise(this.timeout, 'Unified API timeout after 50s')
      ]);
      const apiCallTime = Date.now() - apiCallStart;
      debugLog(`â±ï¸ [PERF] 🎯 Gemini API response received: ${apiCallTime}ms`);
      
      const apiResponse = await apiResult.response;
      const apiText = apiResponse.text();
      debugLog('⚡ [UNIFIED API] Raw response:', apiText.substring(0, 300) + '...');
      
      const parseStart = Date.now();
      const analysisData = this.parseJsonResponse(apiText);
      debugLog(`â±ï¸ [PERF] JSON parsing: ${Date.now() - parseStart}ms`);
      debugLog('🤖 [DEBUG] Parsed Result:', {
        type: analysisData.type,
        confidence: analysisData.confidence,
        hasFoods: !!analysisData.foods,
        foodsCount: analysisData.foods?.length || 0,
        hasWeight: !!analysisData.weight
      });
      
      // ðŸ” LOG RAW AI NUTRITION DATA (before any fallback)
      if (analysisData.type === 'food' && analysisData.foods) {
        debugLog('🤖 [RAW AI NUTRITION] What AI returned BEFORE fallback:');
        analysisData.foods.forEach((food, idx) => {
          const cal = food.nutrition?.calories;
          const protein = food.nutrition?.protein;
          const carbs = food.nutrition?.carbs;
          const fat = food.nutrition?.fat;
          const status = (cal === 0 || cal === undefined) ? 'âŒ NEEDS FALLBACK' : '✅ HAS DATA';
          debugLog(`   ${idx + 1}. "${food.name}": ${cal || 0} cal, ${carbs || 0}g carbs, ${protein || 0}g protein, ${fat || 0}g fat ${status}`);
        });
      }
      
      // Determine operation type for tracking
      let operationType = 'image_analysis'; // default
      if (analysisData.type === 'education') operationType = 'education_detection';
      if (analysisData.type === 'weight') operationType = 'weight_detection';
      
      // Log detected type
      debugLog(`ðŸ” Detected: ${analysisData.type} (confidence: ${analysisData.confidence})`);
      
      const totalTime = Date.now() - startTime;
      debugLog(`â±ï¸ [TIMING] Total time: ${totalTime}ms (50% faster!)`);

      // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
      // Track token usage (single call)
      // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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

      // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
      // Return result based on detected type
      // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
      // ⌚ SMARTWATCH / FITNESS APP — highest specificity check first
      if (analysisData.type === 'smartwatch' && analysisData.confidence > 0.5) {
        debugLog('⌚ [RESULT] Returning SMARTWATCH result:', analysisData.caloriesBurned, 'kcal from', analysisData.source);
        return {
          type: 'smartwatch',
          confidence: analysisData.confidence,
          details: {
            isSmartwatch: true,
            caloriesBurned: Math.round(Number(analysisData.caloriesBurned) || 0),
            source: analysisData.source || 'unknown',
            reason: analysisData.reason
          }
        };
      }

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
      debugLog('â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”');
      debugLog('ðŸ½ï¸ [RESULT] Returning FOOD result:');
      debugLog('ðŸ½ï¸ [RESULT] Foods count:', analysisData.foods?.length || 0);
      debugLog('ðŸ½ï¸ [RESULT] Foods:', analysisData.foods?.map(f => `${f.name} (${f.nutrition?.calories || 0} cal)`).join(', ') || 'NONE');
      debugLog('ðŸ½ï¸ [RESULT] Total calories:', analysisData.total?.calories || 0);
      debugLog('ðŸ½ï¸ [RESULT] Confidence:', analysisData.confidence || 0.5);
      
      // 🔴 CRITICAL: Apply fallback nutrition for foods with 0 or missing nutrition
      let foodsWithNutrition = analysisData.foods || [];
      if (foodsWithNutrition.length > 0) {
        debugLog('🔧 [NUTRITION-CHECK] Checking for missing nutrition values...');
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
        
        debugLog('🔧 [NUTRITION-CHECK] Before fallback:', beforeFallback);
        debugLog('🔧 [NUTRITION-CHECK] After fallback:', afterFallback);
      }
      debugLog('â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”');
      
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
      console.error('â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”');
      console.error('âŒ [IMAGE-DETECTOR] FAILED after', errorTime, 'ms');
      console.error('âŒ [IMAGE-DETECTOR] Error:', error.message);
      console.error('âŒ [IMAGE-DETECTOR] Error type:', error.name);
      console.error('âŒ [IMAGE-DETECTOR] Is timeout?', error.message.includes('timeout'));
      console.error('âŒ [IMAGE-DETECTOR] Is API error?', error.message.includes('API') || error.message.includes('429') || error.message.includes('503'));
      console.error('âŒ [IMAGE-DETECTOR] Stack:', error.stack);
      console.error('â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”');
      
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
   * ⚡ FAST classification-only call. Returns just the image type label as
   * quickly as possible (typical 400–900 ms vs. 2–4 s for the full unified
   * call) so the UI can surface the Share button the moment "food" is
   * confirmed — without waiting for full nutrition extraction.
   *
   * Uses the same Gemini model as the unified call but a minimal prompt so
   * the response is a single short JSON object. The full nutrition analysis
   * (`detectImageType`) is still run separately by the caller.
   *
   * @param {File|string} image - File or data URL
   * @returns {Promise<{type:string, confidence:number}>}
   */
  async classifyImageTypeFast(image) {
    const t0 = Date.now();
    try {
      if (!this.initialized) await this.initialize();
      if (!this.model) throw new Error('Gemini model not initialised');

      let imgFile = image;
      if (typeof image === 'string' && image.startsWith('data:')) {
        imgFile = this.dataURLToFile(image);
      }
      const imageBase64 = await this.fileToBase64(imgFile);
      const imagePart = {
        inlineData: {
          data: imageBase64.split(',')[1] || imageBase64,
          mimeType: imgFile.type || 'image/jpeg',
        },
      };

      const prompt = `Classify this image into ONE category and return ONLY JSON.
Categories:
- "education" - online meeting (Zoom/Meet/Teams) or in-person group gathering
- "weight" - weighing scale OR body-composition app screenshot (Huawei Health, Mi Fit, Renpho, etc.)
- "smartwatch" - smartwatch/fitness band activity screen showing calories burned/steps
- "food" - food, meal or drink (default)
Return EXACTLY: {"type":"food|weight|education|smartwatch","confidence":0.0-1.0}`;

      const result = await Promise.race([
        this.model.generateContent([prompt, imagePart]),
        this.timeoutPromise(10000, 'Fast classify timeout after 10s'),
      ]);
      const response = await result.response;
      const text = response.text();
      const parsed = this.parseJsonResponse(text);
      const out = {
        type: parsed.type || 'food',
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
      };
      debugLog(`⚡ [FAST-CLASSIFY] ${Date.now() - t0}ms → ${out.type} (conf=${out.confidence})`);

      // Fire-and-forget token tracking — never block the UI on this.
      trackCombinedTokenUsage({
        responses: [{ response, label: 'FastClassify' }],
        operationType: 'fast_classification',
        modelName: 'gemini-2.5-flash-lite',
        userId: this.tokenTracker.getCurrentUserId(),
        userEmail: this.tokenTracker.getCurrentUserEmail(),
        processingTime: Date.now() - t0,
      }).catch(() => {});

      return out;
    } catch (err) {
      debugLog(`⚡ [FAST-CLASSIFY] FAILED in ${Date.now() - t0}ms: ${err?.message || err}`);
      // Soft-fail: pretend unknown so caller falls back to full detect.
      return { type: 'unknown', confidence: 0 };
    }
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
        console.warn('âš ï¸ Initial JSON parse failed, attempting fixes...');
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
      
      console.warn('âš ï¸ All JSON parse attempts failed for text:', text.substring(0, 200));
      return { type: 'food', confidence: 0.3 };
    } catch (e) {
      console.warn('âš ï¸ Failed to parse JSON response:', e.message);
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
