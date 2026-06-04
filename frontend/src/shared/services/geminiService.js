import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { getUserContext, formatContextForAI } from "./userIdentity";
import { debugLog } from '../utils/logger.js';

// ─── Structured-output schema for food image analysis ────────────────────────
// Gemini 2.5-flash-lite with temperature 0 has been observed to silently drop
// fields that are described only in the prompt text. Passing a `responseSchema`
// forces the SDK to validate the model output against this shape — every field
// listed in `required` MUST be present in every response.
//
// Source of truth for the 17 micronutrient keys: must match
// `frontend/src/features/nutrition/domain/micronutrientRules.js` (snake_case
// AI keys) and `backend/features/background-analysis/analysis.service.js`
// (MICRO_FIELDS table).
const NUMBER = { type: SchemaType.NUMBER };
const NUTRITION_FIELDS = {
  calories: NUMBER, protein: NUMBER, carbs: NUMBER, fat: NUMBER, fiber: NUMBER,
  sugar: NUMBER, sodium: NUMBER, cholesterol: NUMBER, glycemic_index: NUMBER,
  // Vitamins (fat-soluble + C, then B-complex)
  vitamin_a: NUMBER, vitamin_c: NUMBER, vitamin_d: NUMBER, vitamin_e: NUMBER, vitamin_k: NUMBER,
  vitamin_b1: NUMBER, vitamin_b2: NUMBER, vitamin_b3: NUMBER, vitamin_b6: NUMBER, vitamin_b9: NUMBER, vitamin_b12: NUMBER,
  // Minerals
  calcium: NUMBER, iron: NUMBER, magnesium: NUMBER, potassium: NUMBER, zinc: NUMBER, phosphorus: NUMBER,
};
const NUTRITION_REQUIRED = Object.keys(NUTRITION_FIELDS);

const FOOD_ANALYSIS_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    foods: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name: { type: SchemaType.STRING },
          portion: { type: SchemaType.STRING },
          weight_g: NUMBER,
          volume_ml: NUMBER,
          unit: { type: SchemaType.STRING },
          isLiquid: { type: SchemaType.BOOLEAN },
          nutrition: {
            type: SchemaType.OBJECT,
            properties: NUTRITION_FIELDS,
            required: NUTRITION_REQUIRED,
          },
        },
        required: ['name', 'portion', 'unit', 'isLiquid', 'nutrition'],
      },
    },
    total: {
      type: SchemaType.OBJECT,
      properties: NUTRITION_FIELDS,
      required: NUTRITION_REQUIRED,
    },
    confidence: { type: SchemaType.STRING },
  },
  required: ['foods', 'total', 'confidence'],
};
export { FOOD_ANALYSIS_SCHEMA, NUTRITION_REQUIRED };

/**
 * Ensure every nutrition object on the parsed Gemini response carries all 26
 * expected keys (9 macros + 17 micros). Gemini-2.5-flash-lite frequently omits
 * vitamin/mineral keys even with `responseSchema`, which leaves the UI
 * progress bars with `undefined` values that render as empty rather than 0%.
 *
 * Pure: takes a parsed object, returns a new object with defaults filled in.
 * Missing keys default to `0` (NOT a USDA fallback — that is the job of
 * `enrichMicronutrients`). If Gemini truly did not detect a vitamin, the bar
 * legitimately shows 0% rather than disappearing.
 */
function normalizeNutritionFields(data) {
  if (!data || typeof data !== 'object') return data;
  const fill = (obj) => {
    const out = { ...(obj || {}) };
    for (const key of NUTRITION_REQUIRED) {
      const v = out[key];
      out[key] = typeof v === 'number' && Number.isFinite(v) ? v : 0;
    }
    return out;
  };
  const next = { ...data };
  if (Array.isArray(next.foods)) {
    next.foods = next.foods.map((f) => ({ ...f, nutrition: fill(f?.nutrition) }));
  }
  if (next.total || Array.isArray(next.foods)) {
    next.total = fill(next.total);
  }
  return next;
}
export { normalizeNutritionFields };

// Comprehensive network debugging to catch ALL requests
const originalFetch = window.fetch;
const originalXMLHttpRequest = window.XMLHttpRequest;

// Override fetch
window.fetch = function (...args) {
  const url = args[0];

  // Check for unwanted API calls
  if (typeof url === "string") {
    if (
      url.includes("spoonacular") ||
      url.includes("calorieninjas") ||
      url.includes("rapidapi") ||
      url.includes("nutritionix") ||
      url.includes("edamam")
    ) {
      console.error("âŒ UNWANTED API CALL DETECTED:", url);
      console.trace("Call stack:");
      throw new Error(`BLOCKED: Unwanted API call to ${url}`);
    }
  }

  return originalFetch.apply(this, args);
};

// Override XMLHttpRequest
window.XMLHttpRequest = function () {
  const xhr = new originalXMLHttpRequest();
  const originalOpen = xhr.open;

  xhr.open = function (method, url, ...args) {
    debugLog("ðŸŒ XHR REQUEST:", {
      method: method,
      url: url,
      timestamp: new Date().toISOString(),
    });

    // Check for unwanted API calls
    if (typeof url === "string") {
      if (
        url.includes("spoonacular") ||
        url.includes("calorieninjas") ||
        url.includes("rapidapi") ||
        url.includes("nutritionix") ||
        url.includes("edamam")
      ) {
        console.error("âŒ UNWANTED XHR API CALL DETECTED:", url);
        console.trace("Call stack:");
        throw new Error(`BLOCKED: Unwanted XHR API call to ${url}`);
      }
    }

    return originalOpen.apply(this, [method, url, ...args]);
  };

  return xhr;
};

class GeminiService {
  constructor() {
    this.apiKey = process.env.REACT_APP_GEMINI_API_KEY;
    this.genAI = null;
    this.model = null;

    // Timeout configuration
    this.timeout = 30000; // 30 second timeout

    // Search cache for faster repeated searches
    this.searchCache = new Map();
    this.cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours

    // Session tracking for aggregate metrics
    this.sessionMetrics = {
      totalRequests: 0,
      totalTokens: 0,
      totalPromptTokens: 0,
      totalCompletionTokens: 0,
      totalCost: 0,
      totalProcessingTime: 0,
      requestsByType: {},
      errors: 0,
      startTime: new Date().toISOString(),
    };

    // Store last prompt for debugging
    this.lastPrompt = null;
    this.lastPromptTimestamp = null;

    if (this.apiKey) {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
      this.model = this.genAI.getGenerativeModel({
        model: "gemini-2.5-flash-lite",
        generationConfig: {
          temperature: 0, // 0 for maximum speed (deterministic)
          topK: 1,
          topP: 1.0, // Increased for faster, more confident predictions
          maxOutputTokens: 4096, // Reduced from 8192 (sufficient for nutrition data)
          candidateCount: 1,
          responseMimeType: "application/json",
        },
      });
    }
  }

  getApiInfo() {
    return {
      hasCredentials: !!this.apiKey,
      provider: "Google Gemini",
      dailyLimit: 1500,
      description: "Google Gemini AI for food image analysis",
    };
  }

  getSessionMetrics() {
    const sessionDuration =
      Date.now() - new Date(this.sessionMetrics.startTime).getTime();
    const avgTokensPerRequest =
      this.sessionMetrics.totalRequests > 0
        ? Math.round(
            this.sessionMetrics.totalTokens / this.sessionMetrics.totalRequests,
          )
        : 0;
    const avgCostPerRequest =
      this.sessionMetrics.totalRequests > 0
        ? this.sessionMetrics.totalCost / this.sessionMetrics.totalRequests
        : 0;

    return {
      ...this.sessionMetrics,
      sessionDuration: sessionDuration,
      sessionDurationFormatted: `${Math.round(sessionDuration / 1000)}s`,
      avgTokensPerRequest: avgTokensPerRequest,
      avgCostPerRequest: avgCostPerRequest,
      errorRate:
        this.sessionMetrics.totalRequests > 0
          ? (
              (this.sessionMetrics.errors / this.sessionMetrics.totalRequests) *
              100
            ).toFixed(2) + "%"
          : "0%",
    };
  }

  logError(error, requestType) {
    this.sessionMetrics.errors++;
    console.error(`âŒ Error [${requestType}]:`, {
      "Error Message": error.message,
      "Total Errors": this.sessionMetrics.errors,
      "Error Rate": `${(
        (this.sessionMetrics.errors /
          Math.max(this.sessionMetrics.totalRequests, 1)) *
        100
      ).toFixed(2)}%`,
    });
  }

  // ⚡ OPTIMIZED: Skip preprocessing - image already compressed by App.js
  async preprocessImage(imageFile) {
    // Images are now pre-compressed in App.js to 800px @ 60-70% quality
    // Skip duplicate compression to save 2-3 seconds
    const maxSize = 1024 * 1024; // 1MB threshold (very generous)
    const maxDimension = 800; // Max dimension for fallback compression

    // Only compress if somehow a large image got through
    if (imageFile.size <= maxSize) {
      debugLog('⚡ Skipping preprocessing (already compressed)');
      return imageFile;
    }

    // Fallback compression for oversized images
    return new Promise((resolve, reject) => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const img = new Image();

      img.onload = () => {
        // Calculate new dimensions
        let { width, height } = img;
        const ratio = Math.min(maxDimension / width, maxDimension / height);

        if (ratio < 1) {
          width *= ratio;
          height *= ratio;
        }

        canvas.width = width;
        canvas.height = height;

        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(new File([blob], imageFile.name, { type: "image/jpeg" }));
            } else {
              reject(new Error("Failed to compress image"));
            }
          },
          "image/jpeg",
          0.7,
        ); // 70% quality (faster processing, still accurate)
      };

      img.onerror = reject;
      img.src = URL.createObjectURL(imageFile);
    });
  }

  /**
   * Enrich micronutrients with USDA fallback values when Gemini returns zeros
   * @param {Object} nutritionData - The parsed Gemini response with foods array
   * @returns {Object} Enriched nutrition data
   */
  enrichMicronutrients(nutritionData) {
    if (!nutritionData.foods || !Array.isArray(nutritionData.foods)) {
      return nutritionData;
    }

    // USDA-based fallback values per 100g (source: USDA FoodData Central)
    const usdaDefaults = {
      // Indian foods
      dosa: { fiber: 1.5, sugar: 0.5, sodium: 250, cholesterol: 0 },
      idli: { fiber: 1.2, sugar: 0.5, sodium: 180, cholesterol: 0 },
      vada: { fiber: 2.0, sugar: 1.0, sodium: 300, cholesterol: 0 },
      paratha: { fiber: 2.5, sugar: 1.0, sodium: 350, cholesterol: 15 },
      roti: { fiber: 3.0, sugar: 1.0, sodium: 200, cholesterol: 0 },
      chapati: { fiber: 3.0, sugar: 1.0, sodium: 200, cholesterol: 0 },
      naan: { fiber: 2.0, sugar: 2.0, sodium: 400, cholesterol: 10 },
      sambar: { fiber: 3.0, sugar: 3.0, sodium: 450, cholesterol: 0 },
      rasam: { fiber: 1.0, sugar: 2.0, sodium: 500, cholesterol: 0 },
      'coconut chutney': { fiber: 2.0, sugar: 1.5, sodium: 300, cholesterol: 0 },
      'tomato chutney': { fiber: 2.5, sugar: 5.0, sodium: 400, cholesterol: 0 },
      'mint chutney': { fiber: 2.0, sugar: 1.0, sodium: 350, cholesterol: 0 },
      'coriander chutney': { fiber: 2.0, sugar: 1.0, sodium: 350, cholesterol: 0 },
      biryani: { fiber: 1.5, sugar: 1.0, sodium: 500, cholesterol: 30 },
      pulao: { fiber: 1.5, sugar: 1.0, sodium: 400, cholesterol: 10 },
      'fried rice': { fiber: 1.0, sugar: 1.0, sodium: 600, cholesterol: 30 },
      dal: { fiber: 7.6, sugar: 1.5, sodium: 400, cholesterol: 0 },
      'dal fry': { fiber: 7.6, sugar: 1.5, sodium: 450, cholesterol: 0 },
      'dal tadka': { fiber: 7.6, sugar: 1.5, sodium: 500, cholesterol: 0 },
      'dal makhani': { fiber: 6.5, sugar: 2.0, sodium: 550, cholesterol: 15 },
      'chickpea curry': { fiber: 6.0, sugar: 3.0, sodium: 400, cholesterol: 0 },
      'chana masala': { fiber: 6.0, sugar: 3.0, sodium: 450, cholesterol: 0 },
      'vegetable curry': { fiber: 3.5, sugar: 4.0, sodium: 400, cholesterol: 0 },
      'mixed vegetable curry': { fiber: 3.5, sugar: 4.0, sodium: 400, cholesterol: 0 },
      'paneer': { fiber: 0, sugar: 1.5, sodium: 350, cholesterol: 40 },
      'paneer tikka': { fiber: 0, sugar: 2.0, sodium: 450, cholesterol: 40 },
      'paneer butter masala': { fiber: 1.0, sugar: 3.0, sodium: 500, cholesterol: 50 },
      'butter chicken': { fiber: 1.0, sugar: 4.0, sodium: 600, cholesterol: 60 },
      'chicken curry': { fiber: 1.0, sugar: 3.0, sodium: 500, cholesterol: 70 },
      'chicken tikka': { fiber: 0.5, sugar: 2.0, sodium: 550, cholesterol: 75 },
      
      // Common foods (gi = USDA glycemic index)
      rice: { fiber: 0.4, sugar: 0.1, sodium: 5, cholesterol: 0, gi: 73 },
      bread: { fiber: 2.4, sugar: 4.0, sodium: 450, cholesterol: 0, gi: 75 },
      egg: { fiber: 0, sugar: 0.4, sodium: 124, cholesterol: 372, gi: 0 },
      chicken: { fiber: 0, sugar: 0, sodium: 70, cholesterol: 75, gi: 0 },
      fish: { fiber: 0, sugar: 0, sodium: 50, cholesterol: 55, gi: 0 },
      milk: { fiber: 0, sugar: 12, sodium: 107, cholesterol: 24, gi: 27 },
      yogurt: { fiber: 0, sugar: 11, sodium: 120, cholesterol: 13, gi: 35 },
      banana: { fiber: 2.6, sugar: 12, sodium: 1, cholesterol: 0, gi: 51 },
      apple: { fiber: 2.4, sugar: 10, sodium: 1, cholesterol: 0, gi: 38 },
      orange: { fiber: 2.4, sugar: 9, sodium: 0, cholesterol: 0, gi: 43 },

      // Fallback for unknown foods (medium GI default)
      default: { fiber: 1.0, sugar: 2.0, sodium: 150, cholesterol: 0, gi: 55 }
    };

    // USDA vitamin/mineral defaults per 100g (source: USDA FoodData Central).
    // Units: vitamin_a µg RAE, vitamin_c mg, vitamin_d µg, vitamin_e mg,
    //        vitamin_k µg, vitamin_b1..b6 mg, vitamin_b9 µg, vitamin_b12 µg,
    //        calcium/iron/magnesium/potassium/zinc/phosphorus mg.
    // Only fields present override missing-or-zero values from Gemini;
    // unspecified nutrients stay at whatever Gemini returned (likely 0).
    const usdaMicroDefaults = {
      // South-Indian staples
      idli:   { vitamin_b1: 0.12, vitamin_b9: 20, calcium: 20, iron: 1.0, magnesium: 30, potassium: 62, phosphorus: 88, zinc: 0.7 },
      dosa:   { vitamin_b1: 0.10, vitamin_b9: 12, calcium: 15, iron: 0.8, magnesium: 22, potassium: 50, phosphorus: 68, zinc: 0.5 },
      appam:  { vitamin_b1: 0.10, vitamin_b9: 15, calcium: 15, iron: 0.7, magnesium: 20, potassium: 150, phosphorus: 50, zinc: 0.5 },
      vada:   { vitamin_b1: 0.15, vitamin_b6: 0.10, vitamin_b9: 60, calcium: 25, iron: 2.0, magnesium: 40, potassium: 280, phosphorus: 110, zinc: 1.0 },
      sambar: { vitamin_a: 25, vitamin_c: 6, vitamin_k: 8, vitamin_b6: 0.10, vitamin_b9: 30, calcium: 35, iron: 1.4, magnesium: 25, potassium: 220, phosphorus: 85, zinc: 0.8 },
      rasam:  { vitamin_a: 30, vitamin_c: 12, vitamin_b6: 0.08, calcium: 18, iron: 0.8, magnesium: 14, potassium: 180, phosphorus: 35, zinc: 0.3 },

      // Breads
      roti:    { vitamin_b1: 0.18, vitamin_b3: 2.0, vitamin_b6: 0.10, vitamin_b9: 12, calcium: 22, iron: 1.6, magnesium: 50, potassium: 130, phosphorus: 120, zinc: 1.2 },
      chapati: { vitamin_b1: 0.18, vitamin_b3: 2.0, vitamin_b6: 0.10, vitamin_b9: 12, calcium: 22, iron: 1.6, magnesium: 50, potassium: 130, phosphorus: 120, zinc: 1.2 },
      paratha: { vitamin_a: 30, vitamin_b1: 0.18, vitamin_b3: 1.8, calcium: 25, iron: 1.5, magnesium: 45, potassium: 130, phosphorus: 110, zinc: 1.1 },
      naan:    { vitamin_b1: 0.20, vitamin_b3: 2.5, calcium: 30, iron: 1.8, magnesium: 25, potassium: 100, phosphorus: 100, zinc: 0.8 },

      // Legumes / curries
      dal:               { vitamin_a: 8,  vitamin_b1: 0.18, vitamin_b6: 0.20, vitamin_b9: 90, calcium: 35, iron: 3.3, magnesium: 50, potassium: 370, phosphorus: 140, zinc: 1.2 },
      'dal fry':         { vitamin_a: 12, vitamin_b1: 0.18, vitamin_b6: 0.20, vitamin_b9: 80, calcium: 40, iron: 3.0, magnesium: 48, potassium: 350, phosphorus: 135, zinc: 1.2 },
      'dal tadka':       { vitamin_a: 15, vitamin_b1: 0.18, vitamin_b6: 0.20, vitamin_b9: 80, calcium: 40, iron: 3.0, magnesium: 48, potassium: 350, phosphorus: 135, zinc: 1.2 },
      'dal makhani':     { vitamin_a: 30, vitamin_b1: 0.18, vitamin_b6: 0.18, vitamin_b9: 70, calcium: 60, iron: 2.8, magnesium: 45, potassium: 320, phosphorus: 140, zinc: 1.3 },
      'chickpea curry':  { vitamin_a: 15, vitamin_c: 4,  vitamin_k: 4,  vitamin_b6: 0.14, vitamin_b9: 55, calcium: 45, iron: 2.4, magnesium: 45, potassium: 290, phosphorus: 125, zinc: 1.3 },
      'chana masala':    { vitamin_a: 18, vitamin_c: 4,  vitamin_k: 4,  vitamin_b6: 0.14, vitamin_b9: 55, calcium: 45, iron: 2.4, magnesium: 45, potassium: 290, phosphorus: 125, zinc: 1.3 },
      'vegetable curry': { vitamin_a: 200, vitamin_c: 15, vitamin_k: 20, vitamin_b6: 0.12, vitamin_b9: 25, calcium: 35, iron: 1.2, magnesium: 22, potassium: 280, phosphorus: 55, zinc: 0.4 },
      'mixed vegetable curry': { vitamin_a: 200, vitamin_c: 15, vitamin_k: 20, vitamin_b6: 0.12, vitamin_b9: 25, calcium: 35, iron: 1.2, magnesium: 22, potassium: 280, phosphorus: 55, zinc: 0.4 },

      // Paneer / dairy curries
      paneer:                 { vitamin_a: 200, vitamin_b2: 0.30, vitamin_b12: 0.8, calcium: 480, magnesium: 17, potassium: 130, phosphorus: 340, zinc: 1.5 },
      'paneer tikka':         { vitamin_a: 180, vitamin_b2: 0.28, vitamin_b12: 0.7, calcium: 420, magnesium: 18, potassium: 180, phosphorus: 320, zinc: 1.4 },
      'paneer butter masala': { vitamin_a: 260, vitamin_c: 4, vitamin_b2: 0.25, vitamin_b12: 0.6, calcium: 280, magnesium: 18, potassium: 200, phosphorus: 220, zinc: 1.1 },

      // Chicken
      'butter chicken': { vitamin_a: 120, vitamin_b3: 8,  vitamin_b6: 0.4, vitamin_b12: 0.3, calcium: 60,  iron: 1.4, magnesium: 22, potassium: 240, phosphorus: 170, zinc: 1.4 },
      'chicken curry':  { vitamin_a: 60,  vitamin_b3: 9,  vitamin_b6: 0.5, vitamin_b12: 0.3, calcium: 30,  iron: 1.2, magnesium: 22, potassium: 260, phosphorus: 180, zinc: 1.4 },
      'chicken tikka':  { vitamin_b3: 12, vitamin_b6: 0.7, vitamin_b12: 0.4, calcium: 18, iron: 1.0, magnesium: 25, potassium: 280, phosphorus: 200, zinc: 1.5 },

      // Rice dishes
      biryani:      { vitamin_a: 40, vitamin_b1: 0.10, vitamin_b3: 2.5, vitamin_b6: 0.20, vitamin_b12: 0.2, calcium: 25, iron: 1.5, magnesium: 30, potassium: 180, phosphorus: 110, zinc: 1.0 },
      pulao:        { vitamin_a: 30, vitamin_b1: 0.10, vitamin_b3: 2.0, calcium: 18, iron: 1.0, magnesium: 25, potassium: 130, phosphorus: 80, zinc: 0.8 },
      'fried rice': { vitamin_a: 25, vitamin_b1: 0.08, vitamin_b3: 2.0, vitamin_b12: 0.1, calcium: 20, iron: 1.2, magnesium: 22, potassium: 130, phosphorus: 90, zinc: 0.7 },

      // Common foods
      rice:   { vitamin_b1: 0.02, vitamin_b3: 0.4, calcium: 10, iron: 0.2, magnesium: 12, potassium: 35,  phosphorus: 43, zinc: 0.5 },
      bread:  { vitamin_b1: 0.45, vitamin_b3: 4.5, vitamin_b9: 85, calcium: 144, iron: 3.6, magnesium: 24, potassium: 115, phosphorus: 95, zinc: 0.8 },
      egg:    { vitamin_a: 160, vitamin_d: 2.0, vitamin_b2: 0.50, vitamin_b12: 1.1, calcium: 56, iron: 1.8, magnesium: 12, potassium: 138, phosphorus: 198, zinc: 1.3 },
      chicken: { vitamin_b3: 13.7, vitamin_b6: 0.9, vitamin_b12: 0.34, calcium: 15, iron: 0.7, magnesium: 29, potassium: 256, phosphorus: 210, zinc: 1.0 },
      fish:    { vitamin_a: 50, vitamin_d: 8.0, vitamin_b3: 8.0, vitamin_b6: 0.4, vitamin_b12: 2.4, calcium: 12, iron: 0.5, magnesium: 30, potassium: 380, phosphorus: 240, zinc: 0.5 },
      milk:    { vitamin_a: 46, vitamin_d: 1.2, vitamin_b2: 0.18, vitamin_b12: 0.55, calcium: 125, magnesium: 11, potassium: 152, phosphorus: 95, zinc: 0.4 },
      yogurt:  { vitamin_a: 27, vitamin_b2: 0.27, vitamin_b12: 0.75, calcium: 121, magnesium: 12, potassium: 155, phosphorus: 95, zinc: 0.6 },
      banana:  { vitamin_a: 3,  vitamin_c: 8.7, vitamin_b6: 0.37, vitamin_b9: 20, calcium: 5, iron: 0.3, magnesium: 27, potassium: 358, phosphorus: 22, zinc: 0.2 },
      apple:   { vitamin_c: 4.6, vitamin_k: 2.2, vitamin_b6: 0.04, calcium: 6, magnesium: 5, potassium: 107, phosphorus: 11 },
      orange:  { vitamin_a: 11, vitamin_c: 53.2, vitamin_b9: 30, calcium: 40, magnesium: 10, potassium: 181, phosphorus: 14 },
    };

    let enrichedCount = 0;

    nutritionData.foods = nutritionData.foods.map(food => {
      const nutrition = food.nutrition || {};
      
      // Check which specific micronutrients are missing
      const missingSugar = !nutrition.sugar || nutrition.sugar === 0;
      const missingSodium = !nutrition.sodium || nutrition.sodium === 0;
      const missingCholesterol = !nutrition.cholesterol || nutrition.cholesterol === 0;
      const missingFiber = !nutrition.fiber || nutrition.fiber === 0;
      const missingGI = nutrition.glycemic_index == null;

      // Enrich if ANY critical micronutrient is missing (sugar/sodium/cholesterol/GI are invisible in photos)
      const needsEnrichment = missingSugar || missingSodium || missingCholesterol || missingFiber || missingGI;

      if (needsEnrichment && food.name) {
        // Find matching USDA defaults (case-insensitive, partial match)
        const foodNameLower = food.name.toLowerCase();
        let defaults = null;

        // Try exact match first
        if (usdaDefaults[foodNameLower]) {
          defaults = usdaDefaults[foodNameLower];
        } else {
          // Try partial match (e.g., "masala dosa" matches "dosa")
          for (const [key, value] of Object.entries(usdaDefaults)) {
            if (key !== 'default' && foodNameLower.includes(key)) {
              defaults = value;
              break;
            }
          }
        }

        // Fallback to default if no match
        if (!defaults) {
          defaults = usdaDefaults.default;
        }

        // Calculate actual values based on weight/volume
        const weightInGrams = food.weight_g || food.volume_ml || 100;
        const scaleFactor = weightInGrams / 100;

        // Apply enriched values ONLY for missing fields (preserve Gemini's good values)
        food.nutrition = {
          ...nutrition,
          fiber: missingFiber ? Math.round((defaults.fiber * scaleFactor) * 10) / 10 : nutrition.fiber,
          sugar: missingSugar ? Math.round((defaults.sugar * scaleFactor) * 10) / 10 : nutrition.sugar,
          sodium: missingSodium ? Math.round(defaults.sodium * scaleFactor) : nutrition.sodium,
          cholesterol: missingCholesterol ? Math.round(defaults.cholesterol * scaleFactor) : nutrition.cholesterol,
          // GI is intrinsic to the food, NOT scaled by weight
          glycemic_index: missingGI ? (defaults.gi ?? null) : nutrition.glycemic_index,
        };

        enrichedCount++;

        const enrichedFields = [];
        if (missingFiber) enrichedFields.push(`fiber: ${food.nutrition.fiber}g`);
        if (missingSugar) enrichedFields.push(`sugar: ${food.nutrition.sugar}g`);
        if (missingSodium) enrichedFields.push(`sodium: ${food.nutrition.sodium}mg`);
        if (missingCholesterol) enrichedFields.push(`cholesterol: ${food.nutrition.cholesterol}mg`);
        if (missingGI) enrichedFields.push(`glycemic_index: ${food.nutrition.glycemic_index}`);
        
        debugLog(`🔧 USDA Enrichment Applied to "${food.name}":`, {
          weight: weightInGrams + 'g',
          enriched: enrichedFields.join(', '),
          preserved: Object.entries(nutrition)
            .filter(([key]) => ['fiber', 'sugar', 'sodium', 'cholesterol'].includes(key) && nutrition[key] > 0)
            .map(([key, val]) => `${key}: ${val}`)
            .join(', ') || 'none'
        });
      }

      return food;
    });

    // Recalculate totals if any foods were enriched
    if (enrichedCount > 0) {
      const totalsBase = nutritionData.foods.reduce(
        (acc, food) => ({
          calories: (acc.calories || 0) + (food.nutrition.calories || 0),
          protein: (acc.protein || 0) + (food.nutrition.protein || 0),
          carbs: (acc.carbs || 0) + (food.nutrition.carbs || 0),
          fat: (acc.fat || 0) + (food.nutrition.fat || 0),
          fiber: (acc.fiber || 0) + (food.nutrition.fiber || 0),
          sugar: (acc.sugar || 0) + (food.nutrition.sugar || 0),
          sodium: (acc.sodium || 0) + (food.nutrition.sodium || 0),
          cholesterol: (acc.cholesterol || 0) + (food.nutrition.cholesterol || 0),
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0, cholesterol: 0 }
      );

      // Carb-weighted GI across foods
      let giCarbProduct = 0, giTotalCarbs = 0;
      nutritionData.foods.forEach((food) => {
        const gi = food.nutrition?.glycemic_index;
        const carbs = food.nutrition?.carbs || 0;
        if (gi != null && carbs > 0) {
          giCarbProduct += gi * carbs;
          giTotalCarbs += carbs;
        }
      });
      totalsBase.glycemic_index = giTotalCarbs > 0
        ? Math.round(giCarbProduct / giTotalCarbs)
        : null;

      nutritionData.total = totalsBase;

      debugLog(`✅ USDA Enrichment Complete: ${enrichedCount} foods enriched`);
    }

    // 🛡️ DEFENSIVE BACKFILL: guarantee every food has a numeric GI.
    // If any food still has glycemic_index == null after the primary enrichment
    // (edge case: food.name missing, or it slipped through the `needsEnrichment`
    // gate), assign a sensible per-food default from the USDA table.
    let backfilledGI = false;
    nutritionData.foods.forEach((food) => {
      if (!food || !food.nutrition) return;
      if (food.nutrition.glycemic_index != null) return;
      const name = (food.name || '').toLowerCase();
      let gi = null;
      if (usdaDefaults[name]) {
        gi = usdaDefaults[name].gi;
      } else {
        for (const [key, val] of Object.entries(usdaDefaults)) {
          if (key !== 'default' && name && name.includes(key) && val.gi != null) {
            gi = val.gi;
            break;
          }
        }
      }
      if (gi == null) {
        // Carb-aware default: high-carb foods → medium GI (55), low/zero-carb → 0
        const carbs = food.nutrition.carbs || 0;
        gi = carbs > 5 ? 55 : 0;
      }
      food.nutrition.glycemic_index = gi;
      backfilledGI = true;
    });

    // Re-compute carb-weighted total GI if we backfilled OR total is still null
    if (backfilledGI || nutritionData.total?.glycemic_index == null) {
      let giCarbProduct = 0, giTotalCarbs = 0;
      nutritionData.foods.forEach((food) => {
        const gi = food.nutrition?.glycemic_index;
        const carbs = food.nutrition?.carbs || 0;
        if (gi != null && carbs > 0) {
          giCarbProduct += gi * carbs;
          giTotalCarbs += carbs;
        }
      });
      if (!nutritionData.total) nutritionData.total = {};
      nutritionData.total.glycemic_index = giTotalCarbs > 0
        ? Math.round(giCarbProduct / giTotalCarbs)
        : 0;
    }

    // ─── Micronutrient backfill ──────────────────────────────────────────────
    // Gemini-2.5-flash-lite frequently returns 0 for every vitamin/mineral.
    // For known foods, fill in any missing-or-zero micronutrient from the USDA
    // table, scaled by portion weight. Values Gemini provided that are > 0 are
    // preserved (trust the model when it bothered to estimate).
    const MICRO_KEYS = Object.freeze([
      'vitamin_a','vitamin_c','vitamin_d','vitamin_e','vitamin_k',
      'vitamin_b1','vitamin_b2','vitamin_b3','vitamin_b6','vitamin_b9','vitamin_b12',
      'calcium','iron','magnesium','potassium','zinc','phosphorus',
    ]);
    const roundMicro = (v) => Math.round(v * 100) / 100;
    let microBackfilled = false;
    nutritionData.foods.forEach((food) => {
      if (!food || !food.name) return;
      const n = food.nutrition || (food.nutrition = {});
      const nameLower = food.name.toLowerCase();
      let micros = usdaMicroDefaults[nameLower];
      if (!micros) {
        for (const [key, val] of Object.entries(usdaMicroDefaults)) {
          if (nameLower.includes(key)) { micros = val; break; }
        }
      }
      if (!micros) return; // unknown food — leave as-is (0 or whatever AI gave)
      const grams = food.weight_g || food.volume_ml || 100;
      const scale = grams / 100;
      for (const key of MICRO_KEYS) {
        const existing = n[key];
        if (typeof existing === 'number' && existing > 0) continue;
        if (typeof micros[key] === 'number') {
          n[key] = roundMicro(micros[key] * scale);
          microBackfilled = true;
        }
      }
    });

    // Recompute total micros if we backfilled any food, so dashboard sums match.
    if (microBackfilled) {
      if (!nutritionData.total) nutritionData.total = {};
      for (const key of MICRO_KEYS) {
        const sum = nutritionData.foods.reduce(
          (acc, f) => acc + (Number(f?.nutrition?.[key]) || 0),
          0,
        );
        nutritionData.total[key] = roundMicro(sum);
      }
    }

    return nutritionData;
  }

  /**
   * Build personalized prompt with user context
   * @param {Object} userContext - User's personalization context
   * @returns {string} Personalized prompt for Gemini
   */
  buildPersonalizedPrompt(userContext) {
    const promptParts = [];

    // Add personalization context if available
    if (userContext) {
      const contextText = formatContextForAI(userContext);

      if (contextText) {
        promptParts.push("=== USER PERSONALIZATION CONTEXT ===");
        promptParts.push(contextText);
        promptParts.push("");
        promptParts.push(
          "IMPORTANT: This context is for REFERENCE ONLY, not absolute rules.",
        );
        promptParts.push("");
        promptParts.push("USE THIS CONTEXT AS SUGGESTIONS TO:");
        promptParts.push(
          "1. Break ties ONLY when the image is ambiguous or unclear",
        );
        promptParts.push(
          "2. Consider diet preferences ONLY when food type is uncertain",
        );
        promptParts.push(
          "3. Use corrections as hints, but ALWAYS prioritize what you SEE in the image",
        );
        promptParts.push("");
        promptParts.push("CRITICAL VISUAL-FIRST RULES:");
        promptParts.push(
          "1. COLOR MATTERS: Yellow shake = likely Mango/Banana, Pink = Strawberry, Brown = Chocolate",
        );
        promptParts.push(
          "   Even if user previously corrected Mango→Strawberry, trust the COLOR you see now",
        );
        promptParts.push(
          "2. TEXTURE MATTERS: Plain white idly ≠ Rava idly (which has visible grains)",
        );
        promptParts.push(
          "3. SHAPE/FORM MATTERS: Round roti ≠ triangular paratha",
        );
        promptParts.push("");
        promptParts.push(
          "Apply corrections ONLY when visual evidence is insufficient or matches the correction.",
        );
        promptParts.push(
          'Example: If you see a YELLOW shake, detect "Mango Shake" even if past correction was Mango→Strawberry.',
        );
        promptParts.push(
          "Example: If you see PINK/RED shake, then apply the Strawberry correction.",
        );
        promptParts.push("");
        promptParts.push(
          "PRIORITY ORDER: Visual Evidence > User Corrections > Diet Preferences > Global Patterns",
        );
        promptParts.push("");
        promptParts.push("===================================");
        promptParts.push("");

        debugLog("ðŸ“ [AI Personalization] Context injected into prompt:", {
          corrections: userContext.personalCorrections?.length || 0,
          diet: userContext.dietPreference,
          globalPatterns: userContext.globalPatterns?.length || 0,
        });
      }
    }

    // Standard analysis prompt (optimized for speed)
    promptParts.push(
      "Analyze food image, return JSON. Quick, accurate estimates.",
    );
    promptParts.push("");
    promptParts.push("RULES:");
    promptParts.push("1. Estimate portions by visual cues");
    promptParts.push("2. Use standard USDA values");
    promptParts.push("3. Liquids: use ml/L; Solids: use grams");
    promptParts.push("4. For SOLID foods, continue using weight in grams/kg");
    promptParts.push("");
    promptParts.push("⚠️ CRITICAL NUTRITION REQUIREMENTS (VIOLATIONS REJECTED):");
    promptParts.push("5. You MUST provide ALL 9 nutrition fields: calories, protein, carbs, fat, fiber, sugar, sodium, cholesterol, glycemic_index");
    promptParts.push("6. sugar/sodium/cholesterol/glycemic_index are INVISIBLE in photos - you MUST look them up in USDA database");
    promptParts.push("   Examples:");
    promptParts.push("   • 2 idlis (180g) = sugar: 1g, sodium: 180mg, cholesterol: 0mg");
    promptParts.push("   • 1 cup milk (240ml) = sugar: 12g, sodium: 107mg, cholesterol: 24mg");
    promptParts.push("   • 1 egg (50g) = sugar: 0g, sodium: 62mg, cholesterol: 186mg");
    promptParts.push("   • 1 banana (120g) = sugar: 14g, sodium: 1mg, cholesterol: 0mg");
    promptParts.push("7. DO NOT return 0 for sugar/sodium/cholesterol unless food genuinely contains none");
    promptParts.push("8. ALSO provide MICRONUTRIENTS (vitamins + minerals) — invisible in photos, use USDA values:");
    promptParts.push("   Vitamins: vitamin_a (µg RAE), vitamin_c (mg), vitamin_d (µg), vitamin_e (mg), vitamin_k (µg),");
    promptParts.push("             vitamin_b1 (mg), vitamin_b2 (mg), vitamin_b3 (mg), vitamin_b6 (mg), vitamin_b9 (µg), vitamin_b12 (µg)");
    promptParts.push("   Minerals: calcium (mg), iron (mg), magnesium (mg), potassium (mg), zinc (mg), phosphorus (mg)");
    promptParts.push("   ⛔ RETURNING ALL ZEROS IS A FAILURE. Almost every food contains SOME minerals (potassium, magnesium, phosphorus) and some vitamins.");
    promptParts.push("   Concrete per-serving reference values (use these and adjust by portion):");
    promptParts.push("   • 1 idli (40g):         vitamin_b1=0.05, vitamin_b9=8,  calcium=8,   iron=0.4, magnesium=12, potassium=25,  phosphorus=35, zinc=0.3");
    promptParts.push("   • 1 dosa (80g):         vitamin_b1=0.08, vitamin_b9=10, calcium=12,  iron=0.6, magnesium=18, potassium=40,  phosphorus=55, zinc=0.4");
    promptParts.push("   • 1 appam (40g):        vitamin_b1=0.04, vitamin_b9=6,  calcium=6,   iron=0.3, magnesium=8,  potassium=60,  phosphorus=20, zinc=0.2");
    promptParts.push("   • chickpea curry (100g): vitamin_a=15, vitamin_c=4, vitamin_k=4, vitamin_b6=0.14, vitamin_b9=55, calcium=45, iron=2.4, magnesium=45, potassium=290, phosphorus=125, zinc=1.3");
    promptParts.push("   • 1 cup milk (240ml):   vitamin_a=112, vitamin_d=2.9, vitamin_b2=0.4, vitamin_b12=1.3, calcium=300, magnesium=27, potassium=366, phosphorus=232, zinc=1.0");
    promptParts.push("   • 1 banana (120g):      vitamin_c=10, vitamin_b6=0.43, vitamin_b9=24, potassium=430, magnesium=33, phosphorus=26");
    promptParts.push("   • 100g chicken breast:  vitamin_b3=13, vitamin_b6=0.9, vitamin_b12=0.3, potassium=256, phosphorus=210, zinc=1.0, iron=0.7");
    promptParts.push("   • 100g cooked rice:     vitamin_b1=0.02, vitamin_b3=0.4, magnesium=12, potassium=35, phosphorus=43, zinc=0.5");
    promptParts.push("   Scale these by actual portion. Only return 0 for a SPECIFIC nutrient when the food genuinely lacks it");
    promptParts.push("   (e.g. plant foods → vitamin_b12=0; pure fat/oil → most vitamins=0). NEVER return all-zero micronutrients.");
    promptParts.push("9. Return concise JSON only");
    promptParts.push("");
    promptParts.push("FORMAT:");
    promptParts.push("{");
    promptParts.push('  "foods": [');
    promptParts.push("    {");
    promptParts.push('      "name": "food name",');
    promptParts.push(
      "      \"portion\": \"description like '2 idlis' or '250ml juice' or '1 cup soup'\",",
    );
    promptParts.push('      "weight_g": number (for solid foods),');
    promptParts.push('      "volume_ml": number (for liquid foods),');
    promptParts.push('      "unit": "g" or "ml",');
    promptParts.push('      "isLiquid": boolean,');
    promptParts.push('      "nutrition": {');
    promptParts.push('        "calories": number,');
    promptParts.push('        "protein": number,');
    promptParts.push('        "carbs": number,');
    promptParts.push('        "fat": number,');
    promptParts.push('        "fiber": number,');
    promptParts.push('        "sugar": number (REQUIRED - use USDA database value for this food type),');
    promptParts.push('        "sodium": number (REQUIRED - use USDA database value, in mg),');
    promptParts.push('        "cholesterol": number (REQUIRED - use USDA database value, in mg),');
    promptParts.push('        "glycemic_index": number (⚠️ NEVER null. Required USDA GI 0-100. apple=38, banana=51, white rice=72, brown rice=68, bread=75, oats=55, milk=27, yogurt=35, potato=78, sweet potato=63, walnuts=15, almonds=15, cranberries dried=64, celery=15. For pure protein/fat foods (chicken, eggs, fish, oil, butter, cheese) use 0. Estimate if uncertain — NEVER return null),');
    promptParts.push('        "vitamin_a": number, "vitamin_c": number, "vitamin_d": number, "vitamin_e": number, "vitamin_k": number,');
    promptParts.push('        "vitamin_b1": number, "vitamin_b2": number, "vitamin_b3": number, "vitamin_b6": number, "vitamin_b9": number, "vitamin_b12": number,');
    promptParts.push('        "calcium": number, "iron": number, "magnesium": number, "potassium": number, "zinc": number, "phosphorus": number');
    promptParts.push("      }");
    promptParts.push("    }");
    promptParts.push("  ],");
    promptParts.push('  "total": {');
    promptParts.push('    "calories": number,');
    promptParts.push('    "protein": number,');
    promptParts.push('    "carbs": number,');
    promptParts.push('    "fat": number,');
    promptParts.push('    "fiber": number,');
    promptParts.push('    "sugar": number (REQUIRED - sum of all foods),');
    promptParts.push('    "sodium": number (REQUIRED - sum of all foods, in mg),');
    promptParts.push('    "cholesterol": number (REQUIRED - sum of all foods, in mg),');
    promptParts.push('    "glycemic_index": number (⚠️ NEVER null. Carb-weighted average of all foods\' GI values, formula: sum(food.gi * food.carbs) / sum(food.carbs). If meal has no carbs, return 0),');
    promptParts.push('    "vitamin_a": number, "vitamin_c": number, "vitamin_d": number, "vitamin_e": number, "vitamin_k": number,');
    promptParts.push('    "vitamin_b1": number, "vitamin_b2": number, "vitamin_b3": number, "vitamin_b6": number, "vitamin_b9": number, "vitamin_b12": number,');
    promptParts.push('    "calcium": number, "iron": number, "magnesium": number, "potassium": number, "zinc": number, "phosphorus": number');
    promptParts.push("  },");
    promptParts.push('  "confidence": "high/medium/low"');
    promptParts.push("}");
    promptParts.push("");
    promptParts.push("⛔ BEFORE YOU RESPOND - VERIFY:");
    promptParts.push("✓ Every food has 9 nutrition fields (no missing sugar/sodium/cholesterol/glycemic_index)");
    promptParts.push("✓ Every food AND total includes all 17 micronutrient fields (vitamin_a..vitamin_b12, calcium..phosphorus) — use USDA values, 0 only if truly absent");
    promptParts.push("✓ sugar/sodium/cholesterol/glycemic_index values come from USDA database, NOT visual guesses");
    promptParts.push("✓ Total nutrition is SUM of all foods (all 8 fields + 17 micros); total.glycemic_index is carb-weighted average");
    promptParts.push("✓ If you don't know USDA values, provide reasonable estimates based on food type");
    promptParts.push("");
    promptParts.push(
      '🚨 REJECTION CRITERIA: Missing sugar/sodium/cholesterol/glycemic_index OR missing any of the 17 micronutrients OR all zeros OR values not from database',
    );
    promptParts.push("");
    promptParts.push(
      'IMPORTANT: Liquids like water, juice, milk, coffee, tea, soup, smoothies should use volume_ml and unit="ml". Solids like rice, bread, meat should use weight_g and unit="g".',
    );
    promptParts.push("");
    promptParts.push("Return valid JSON only, no markdown.");

    const fullPrompt = promptParts.join("\n");

    // Store for debugging (accessible via geminiService.getLastPrompt())
    this.lastPrompt = fullPrompt;
    this.lastPromptTimestamp = new Date().toISOString();

    return fullPrompt;
  }

  /**
   * Get the last prompt sent to Gemini (for debugging)
   * @returns {Object} { prompt: string, timestamp: string }
   */
  getLastPrompt() {
    return {
      prompt: this.lastPrompt,
      timestamp: this.lastPromptTimestamp,
    };
  }

  async analyzeImageForNutrition(imageFile, userId = null, userContext = null) {
    const startTime = Date.now();
    // debugLog('ðŸ” GeminiService: Starting optimized image analysis...');
    // debugLog('📸 Original image:', imageFile.name, imageFile.type, imageFile.size);

    if (!this.model) {
      throw new Error("Gemini API key is not configured");
    }

    try {
      // Use provided context or fetch if userId given but no context
      if (!userContext && userId) {
        try {
          debugLog(
            "🎯 [AI Personalization] Fetching user context for userId:",
            userId,
          );
          userContext = await getUserContext(userId);
          debugLog("✅ [AI Personalization] Context fetched:", {
            corrections: userContext?.personalCorrections?.length || 0,
            diet: userContext?.dietPreference,
            patterns: userContext?.globalPatterns?.length || 0,
          });
        } catch (error) {
          console.warn(
            "âš ï¸ [AI Personalization] Failed to load context, continuing without:",
            error,
          );
        }
      } else if (userContext) {
        debugLog("✅ [AI Personalization] Using pre-loaded context:", {
          corrections: userContext?.personalCorrections?.length || 0,
          diet: userContext?.dietPreference,
          patterns: userContext?.globalPatterns?.length || 0,
        });
      }

      // Preprocess image for faster processing
      const processedImage = await this.preprocessImage(imageFile);
      // debugLog('📸 Processed image size:', processedImage.size);

      // Convert to base64 with timeout
      const imageBase64 = await Promise.race([
        this.fileToBase64(processedImage),
        this.timeoutPromise(10000, "Image processing timeout"),
      ]);

      // debugLog('📋 Image converted to base64, length:', imageBase64.length);

      // Build personalized prompt with user context
      const prompt = this.buildPersonalizedPrompt(userContext);

      const imagePart = {
        inlineData: {
          data: imageBase64,
          mimeType: processedImage.type,
        },
      };

      // Make API call with timeout. Pass `responseSchema` per-call so the
      // model is forced to emit all macros + 17 micronutrient fields (text
      // instructions alone were silently dropped by gemini-2.5-flash-lite).
      const result = await Promise.race([
        this.model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }, imagePart] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: FOOD_ANALYSIS_SCHEMA,
          },
        }),
        this.timeoutPromise(
          this.timeout,
          `API timeout after ${this.timeout}ms`,
        ),
      ]);

      const response = await result.response;
      const text = response.text();

      // Parse response
      let nutritionData = this.parseJsonResponse(text);
      // Guarantee all 26 nutrition keys exist on every food + total (Gemini
      // flash-lite drops vitamin/mineral keys even with responseSchema).
      nutritionData = normalizeNutritionFields(nutritionData);
      const processingTime = Date.now() - startTime;

      // Log token usage
      this.logTokenUsage(response, "image_analysis", processingTime);

      // 🚫 AUTO-CORRECTION DISABLED (product decision 2026-05-29)
      // if (nutritionData.foods && Array.isArray(nutritionData.foods)) {
      //   nutritionData.foods = await applyGlobalAutoCorrections(
      //     nutritionData.foods,
      //     userId,
      //   );
      // }

      // ðŸ” LOG AI DETECTION RESULTS (AFTER AUTO-CORRECTIONS FOR ACCURACY)
      debugLog("🤖 ========== AI DETECTION RESULTS ==========");
      if (nutritionData.foods && Array.isArray(nutritionData.foods)) {
        nutritionData.foods.forEach((food, index) => {
          debugLog(`ðŸ” AI Detected Food ${index + 1}:`, {
            originalAiDetected: food.originalAiName || food.name,
            currentDisplayName: food.name,
            wasAutoCorrected: food.wasAutoCorrected || false,
            correctionSource: food.correctionSource || 'None',
            portion: food.portion,
            weight: food.weight_g || food.volume_ml,
            unit: food.unit,
          });
        });
      }
      debugLog("============================================");

      // 🔧 Enrich micronutrients with USDA fallback values when Gemini returns zeros
      nutritionData = this.enrichMicronutrients(nutritionData);

      // 🔍 DEBUG: Log enriched data structure
      debugLog('🔍 [After Enrichment] Nutrition data:', {
        foodCount: nutritionData.foods?.length || 0,
        total: nutritionData.total,
        firstFood: nutritionData.foods?.[0],
        allFoodsNutrition: nutritionData.foods?.map(f => ({
          name: f.name,
          nutrition: f.nutrition
        }))
      });

      return this.transformOptimizedResponse(nutritionData, "image");
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logError(error, "image_analysis");
      console.error(`âŒ Analysis failed after ${processingTime}ms:`, error);
      throw new Error(`Analysis failed: ${error.message}`);
    }
  }

  async analyzeTextForNutrition(foodText) {
    const startTime = Date.now();
    // debugLog('ðŸ” GeminiService: Starting text analysis for:', foodText);

    if (!this.model) {
      throw new Error("Gemini API key is not configured");
    }

    try {
      // Optimized prompt for speed
      const prompt = `Nutrition for "${foodText}" standard serving. JSON only.

FORMAT:
{
  "name": "${foodText}",
  "serving": "description",
  "weight_g": number (solids),
  "volume_ml": number (liquids),
  "unit": "g" or "ml",
  "isLiquid": boolean,
  "nutrition": {"calories":num,"protein":num,"carbs":num,"fat":num,"fiber":num,"sugar":num,"sodium":num,"cholesterol":num,"glycemic_index":num}
}

⚠️ MANDATORY: ALL 9 nutrition fields required. sugar/sodium/cholesterol/glycemic_index MUST come from USDA database.
Examples: milk (240ml) = sugar:12g, sodium:107mg, cholesterol:24mg, glycemic_index:27 | banana = sugar:14g, sodium:1mg, cholesterol:0mg, glycemic_index:51
DO NOT return 0 unless food genuinely contains none.
Liquids: use volume_ml+ml. Solids: use weight_g+g.
JSON only.`;

      // Make API call with timeout
      const result = await Promise.race([
        this.model.generateContent(prompt),
        this.timeoutPromise(
          this.timeout,
          `API timeout after ${this.timeout}ms`,
        ),
      ]);

      const response = await result.response;
      const text = response.text();

      const nutritionData = this.parseJsonResponse(text);
      const processingTime = Date.now() - startTime;

      // Log token usage
      this.logTokenUsage(response, "text_analysis", processingTime);

      // debugLog(`✅ Text analysis completed in ${processingTime}ms`);

      // 🔧 Enrich micronutrients for text analysis (wrap single food for processing)
      const wrappedData = {
        foods: [{
          name: nutritionData.name,
          portion: nutritionData.serving,
          weight_g: nutritionData.weight_g,
          volume_ml: nutritionData.volume_ml,
          unit: nutritionData.unit,
          isLiquid: nutritionData.isLiquid,
          nutrition: nutritionData.nutrition
        }],
        total: nutritionData.nutrition
      };
      const enrichedData = this.enrichMicronutrients(wrappedData);
      // Unwrap back to single food format
      nutritionData.nutrition = enrichedData.foods[0].nutrition;

      return this.transformOptimizedResponse(nutritionData, "text");
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logError(error, "text_analysis");
      console.error(
        `âŒ Text analysis failed after ${processingTime}ms:`,
        error,
      );
      throw new Error(`Analysis failed: ${error.message}`);
    }
  }

  /**
   * Get cached search results if available and not expired
   * @param {string} query - The search query
   * @returns {Object|null} Cached results or null
   */
  getCachedSearch(query) {
    if (!query || typeof query !== "string") return null;

    const cacheKey = query.toLowerCase().trim();
    const cached = this.searchCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.data;
    }

    // Remove expired cache entry
    if (cached) {
      this.searchCache.delete(cacheKey);
    }

    return null;
  }

  /**
   * Search for food items using Gemini AI
   * Returns multiple food variations with serving options
   * @param {string} foodQuery - The food name to search for
   * @returns {Promise<Object>} Search results with nutrition data
   */
  async searchFood(foodQuery) {
    const startTime = Date.now();
    debugLog("ðŸ” GeminiService: Starting food search for:", foodQuery);

    if (!this.model) {
      throw new Error("Gemini API key is not configured");
    }

    if (!foodQuery || foodQuery.trim().length < 2) {
      console.warn("âŒ Search query too short:", foodQuery);
      throw new Error("Search query must be at least 2 characters");
    }

    // Check cache first
    const cacheKey = foodQuery.toLowerCase().trim();
    const cached = this.searchCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      const cacheTime = Date.now() - startTime;
      debugLog(`💾 Using cached result (${cacheTime}ms)`);
      debugLog(`✅ Food search completed in ${cacheTime}ms (CACHED)`);
      return cached.data;
    }

    try {
      const prompt = `"${foodQuery}" - Return 2 DIFFERENT variations:
[{"name":"str","category":"str","isLiquid":bool,"unit":"g|ml","defaultServing":{"description":"str","grams":num,"nutrition":{"calories":num,"protein":num,"carbs":num,"fat":num,"fiber":num,"sugar":num,"sodium":num,"cholesterol":num}},"per100g":{"calories":num,"protein":num,"carbs":num,"fat":num,"fiber":num,"sugar":num,"sodium":num,"cholesterol":num}}]

RULES:
1. Return 2 DISTINCT variations (e.g., "Coconut Chutney", "Spicy Coconut Chutney")
2. Use standard serving with quantity (e.g., "1/2 cup", "2 tbsp", "1 piece")
3. Liquids: unit="ml", grams=ml value. Solids: unit="g", grams=weight
4. Return defaultServing nutrition + per100g nutrition (ALL 8 fields required)
5. ⚠️ sugar/sodium/cholesterol MUST come from USDA database - these are INVISIBLE in photos
6. Example: idli (90g) = sugar:0.5g, sodium:90mg, cholesterol:0mg | milk (240ml) = sugar:12g, sodium:107mg, cholesterol:24mg
7. DO NOT return 0 for sugar/sodium/cholesterol unless food genuinely contains none
Note: Serving options generated locally, don't include servingOptions array.`;

      debugLog("📤 Sending search request to Gemini...");

      // Make API call with timeout
      const result = await Promise.race([
        this.model.generateContent(prompt),
        this.timeoutPromise(
          this.timeout,
          `API timeout after ${this.timeout}ms`,
        ),
      ]);

      const response = await result.response;
      const text = response.text();

      debugLog("📥 Received response from Gemini, parsing...");

      const searchResults = this.parseJsonResponse(text);
      const processingTime = Date.now() - startTime;

      // Log token usage
      this.logTokenUsage(response, "food_search", processingTime);

      debugLog(`✅ Food search completed in ${processingTime}ms`);
      debugLog(
        `📊 Found ${
          searchResults.results?.length || 0
        } results for "${foodQuery}"`,
      );

      // Validate results structure
      if (!searchResults.results || !Array.isArray(searchResults.results)) {
        console.error("âŒ Invalid search results structure:", searchResults);
        throw new Error("Invalid search results format");
      }

      // Log first result for debugging
      if (searchResults.results.length > 0) {
        debugLog("🔎 First result:", {
          name: searchResults.results[0].name,
          category: searchResults.results[0].category,
          defaultCalories:
            searchResults.results[0].defaultServing?.nutrition?.calories,
        });
      }

      // Cache the results for future use
      this.searchCache.set(cacheKey, {
        data: searchResults,
        timestamp: Date.now(),
      });
      debugLog(`💾 Cached results for "${cacheKey}" (expires in 24h)`);

      return searchResults;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logError(error, "food_search");
      console.error(`âŒ Food search failed after ${processingTime}ms:`, error);
      throw new Error(`Food search failed: ${error.message}`);
    }
  }

  // Utility methods
  timeoutPromise(ms, message) {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    });
  }

  parseJsonResponse(text) {
    try {
      // Clean the response text
      let cleanText = text.replace(/```json\n?|\n?```/g, "").trim();

      // Try to parse the JSON
      let parsed;
      try {
        parsed = JSON.parse(cleanText);
      } catch (firstError) {
        // If parsing fails, it might be truncated - try to fix common issues
        console.warn("âš ï¸ Initial JSON parse failed, attempting fixes...");

        // Check if it's an incomplete array - try to close it
        if (cleanText.includes("[") && !cleanText.endsWith("]")) {
          console.warn("âš ï¸ Detected incomplete array, attempting to close");
          // Count opening and closing brackets to determine how many to add
          const openBrackets = (cleanText.match(/\[/g) || []).length;
          const closeBrackets = (cleanText.match(/\]/g) || []).length;
          const openBraces = (cleanText.match(/\{/g) || []).length;
          const closeBraces = (cleanText.match(/\}/g) || []).length;

          // Add missing closing characters
          for (let i = 0; i < openBraces - closeBraces; i++) cleanText += "}";
          for (let i = 0; i < openBrackets - closeBrackets; i++)
            cleanText += "]";

          debugLog("🔧 Attempted fix, trying parse again...");
          parsed = JSON.parse(cleanText);
        } else {
          throw firstError;
        }
      }

      // Handle both formats: {results: [...]} or directly [...]
      if (Array.isArray(parsed)) {
        debugLog("✅ Parsed array format, wrapping in results object");
        return { results: parsed };
      }

      // If already has results property, return as-is
      if (parsed.results) {
        debugLog("✅ Parsed object with results property");
        return parsed;
      }

      // If it has foods property (nutrition analysis format), return as-is
      if (parsed.foods) {
        debugLog("✅ Parsed nutrition analysis with foods property");
        return parsed;
      }

      // Unknown format - return as-is without warning (could be valid response)
      return parsed;
    } catch (parseError) {
      console.error("âŒ Failed to parse response. Length:", text.length);
      console.error("âŒ First 500 chars:", text.substring(0, 500));
      console.error("âŒ Last 500 chars:", text.substring(text.length - 500));
      console.error("âŒ Parse error:", parseError.message);
      throw new Error("Invalid JSON response from API");
    }
  }

  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  logTokenUsage(response, requestType, processingTime) {
    try {
      // Extract usage metadata from Gemini API response
      const usageMetadata = response.usageMetadata || {};

      // Extract all available response data
      const candidates = response.candidates || [];
      const firstCandidate = candidates[0] || {};

      const tokenData = {
        // Token metrics
        promptTokens: usageMetadata.promptTokenCount || 0,
        completionTokens: usageMetadata.candidatesTokenCount || 0,
        totalTokens: usageMetadata.totalTokenCount || 0,

        // Request metadata
        requestType: requestType,
        timestamp: new Date().toISOString(),
        processingTime: processingTime,

        // Response quality metrics
        finishReason: firstCandidate.finishReason || "unknown",
        safetyRatings: firstCandidate.safetyRatings || [],

        // Model info
        modelUsed: "gemini-2.5-flash-lite",

        // Additional metadata
        candidateCount: candidates.length,
        responseLength: response.text ? response.text().length : 0,
      };

      // Calculate cost estimate (for gemini-2.5-flash-lite)
      // Pricing from: https://ai.google.dev/pricing (Jan 2026)
      const inputCost = (tokenData.promptTokens / 1000000) * 0.1; // $0.10 per 1M input tokens
      const outputCost = (tokenData.completionTokens / 1000000) * 0.4; // $0.40 per 1M output tokens
      const totalCost = inputCost + outputCost;

      // Update session metrics
      this.sessionMetrics.totalRequests++;
      this.sessionMetrics.totalTokens += tokenData.totalTokens;
      this.sessionMetrics.totalPromptTokens += tokenData.promptTokens;
      this.sessionMetrics.totalCompletionTokens += tokenData.completionTokens;
      this.sessionMetrics.totalCost += totalCost;
      this.sessionMetrics.totalProcessingTime += processingTime;

      if (!this.sessionMetrics.requestsByType[requestType]) {
        this.sessionMetrics.requestsByType[requestType] = 0;
      }
      this.sessionMetrics.requestsByType[requestType]++;

      // Log to console with nice formatting
      debugLog(`📊 Token Usage [${requestType}]:`, {
        "🔤 Prompt Tokens": tokenData.promptTokens,
        "💬 Response Tokens (Output)": tokenData.completionTokens,
        "📈 Total Tokens": tokenData.totalTokens,
        "â±ï¸ Processing Time": `${processingTime}ms`,
        "💰 Cost Estimate": `$${totalCost.toFixed(6)}`,
      });

      // Log response quality
      debugLog(`ðŸ” Response Quality [${requestType}]:`, {
        "✅ Finish Reason": tokenData.finishReason,
        "ðŸ›¡ï¸ Safety Ratings":
          tokenData.safetyRatings.length > 0 ? "Passed" : "N/A",
        "ðŸ“ Response Length": `${tokenData.responseLength} chars`,
        "🎯 Candidates": tokenData.candidateCount,
      });

      // // Log safety ratings detail
      // if (tokenData.safetyRatings.length > 0) {
      //   debugLog('ðŸ›¡ï¸ Safety Details:', tokenData.safetyRatings);
      // }

      // // Log session summary
      // debugLog(`📈 Session Summary:`, {
      //   'Total Requests': this.sessionMetrics.totalRequests,
      //   'Total Tokens': this.sessionMetrics.totalTokens,
      //   'Total Cost': `$${this.sessionMetrics.totalCost.toFixed(6)}`,
      //   'Avg Processing Time': `${Math.round(this.sessionMetrics.totalProcessingTime / this.sessionMetrics.totalRequests)}ms`,
      //   'Requests by Type': this.sessionMetrics.requestsByType
      // });

      // Log structured data for Cloud Logging compatibility
      // const structuredLog = {
      //   ...tokenData,
      //   costEstimate: {
      //     inputCost: inputCost,
      //     outputCost: outputCost,
      //     totalCost: totalCost,
      //     currency: 'USD'
      //   },
      //   session: this.sessionMetrics
      // };

      // debugLog('📋 Structured Token Data:', JSON.stringify(structuredLog));
    } catch (error) {
      console.warn("âš ï¸ Could not extract token usage:", error.message);
    }
  }

  transformOptimizedResponse(data, type) {
    if (type === "image") {
      if (!data || !data.foods || data.foods.length === 0) {
        throw new Error("No food items detected in the image. Try a clearer, well-lit photo of a single dish.");
      }

      const totalNutrition =
        data.total ||
        data.foods.reduce(
          (acc, food) => {
            const nutrition = food.nutrition;
            return {
              calories: (acc.calories || 0) + (nutrition.calories || 0),
              protein: (acc.protein || 0) + (nutrition.protein || 0),
              carbs: (acc.carbs || 0) + (nutrition.carbs || 0),
              fat: (acc.fat || 0) + (nutrition.fat || 0),
              fiber: (acc.fiber || 0) + (nutrition.fiber || 0),
              sugar: (acc.sugar || 0) + (nutrition.sugar || 0),
              sodium: (acc.sodium || 0) + (nutrition.sodium || 0),
              cholesterol: (acc.cholesterol || 0) + (nutrition.cholesterol || 0),
            };
          },
          { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0, cholesterol: 0 },
        );

      // Match the formatFoodsTitle helper logic
      let categoryName = "";
      const foods = data.foods || [];
      const count = foods.length || 0;
      if (count === 0) {
        categoryName = "Unknown Food";
      } else if (count === 1) {
        categoryName = (foods[0]?.name || "Unknown Food").trim();
      } else if (count === 2) {
        const first = (foods[0]?.name || "Unknown Food").trim();
        const second = (foods[1]?.name || "another item").trim();
        categoryName = `${first} & ${second}`;
      } else {
        const first = (foods[0]?.name || "Unknown Food").trim();
        const others = count - 1;
        categoryName = `${first} + ${others} more`;
      }
      return {
        nutrition: {
          calories: Math.round(totalNutrition.calories || 0),
          protein: Math.round(totalNutrition.protein || 0),
          carbs: Math.round(totalNutrition.carbs || 0),
          fat: Math.round(totalNutrition.fat || 0),
          fiber: Math.round((totalNutrition.fiber || 0) * 10) / 10, // 1 decimal
          sugar: Math.round((totalNutrition.sugar || 0) * 10) / 10, // 1 decimal
          sodium: Math.round(totalNutrition.sodium || 0), // whole mg
          cholesterol: Math.round(totalNutrition.cholesterol || 0), // whole mg
          // GI is a carb-weighted average, not a sum — preserve as-is
          glycemic_index: totalNutrition.glycemic_index != null
            ? Math.round(totalNutrition.glycemic_index)
            : null,
        },
        category: {
          name: categoryName,
        },
        source: "Google Gemini AI - Fast Analysis",
        isRealData: true,
        itemCount: data.foods.length,
        confidence: data.confidence || "medium",
        detailedItems: data.foods.map((food) => ({
          name: food.name,
          portionDescription: food.portion || "Unknown portion",
          estimatedWeight: food.weight_g || food.volume_ml || "Unknown",
          unit: food.unit || (food.volume_ml ? "ml" : "g"),
          isLiquid: food.isLiquid || false,
          // 🔴 CRITICAL: Preserve volume_ml for water discipline tracking
          volume_ml: food.volume_ml || null,
          weight_g: food.weight_g || null,
          calories: Math.round(food.nutrition.calories || 0),
          protein: Math.round(food.nutrition.protein || 0),
          carbs: Math.round(food.nutrition.carbs || 0),
          fat: Math.round(food.nutrition.fat || 0),
          fiber: Math.round((food.nutrition.fiber || 0) * 10) / 10, // 1 decimal for fiber
          sugar: Math.round((food.nutrition.sugar || 0) * 10) / 10, // 1 decimal for sugar
          sodium: Math.round(food.nutrition.sodium || 0), // whole mg for sodium
          cholesterol: Math.round(food.nutrition.cholesterol || 0), // whole mg for cholesterol
          glycemic_index: food.nutrition.glycemic_index != null
            ? Math.round(food.nutrition.glycemic_index)
            : null,
          // 🔴 CRITICAL: Preserve correction metadata for UI display
          originalAiName: food.originalAiName || food.name,
          wasAutoCorrected: food.wasAutoCorrected || false,
          correctionSource: food.correctionSource || null,
          correctionMetadata: food.correctionMetadata || null,
        })),
      };
    } else {
      // Text analysis
      if (!data || !data.nutrition) {
        throw new Error("No nutrition data found");
      }

      return {
        nutrition: {
          calories: Math.round(data.nutrition.calories || 0),
          protein: Math.round(data.nutrition.protein || 0),
          carbs: Math.round(data.nutrition.carbs || 0),
          fat: Math.round(data.nutrition.fat || 0),
          fiber: Math.round((data.nutrition.fiber || 0) * 10) / 10,
          sugar: Math.round((data.nutrition.sugar || 0) * 10) / 10,
          sodium: Math.round(data.nutrition.sodium || 0),
          cholesterol: Math.round(data.nutrition.cholesterol || 0),
          glycemic_index: data.nutrition.glycemic_index != null
            ? Math.round(data.nutrition.glycemic_index)
            : null,
        },
        category: {
          name: data.name,
        },
        source: "Google Gemini AI - Fast Analysis",
        isRealData: true,
        itemCount: 1,
        servingInfo: {
          description: data.serving,
          weight: data.weight_g || data.volume_ml,
          unit: data.unit || (data.volume_ml ? "ml" : "g"),
          isLiquid: data.isLiquid || false,
        },
        detailedItems: [
          {
            name: data.name,
            portionDescription: data.serving || "Unknown portion",
            estimatedWeight: data.weight_g || data.volume_ml || "Unknown",
            unit: data.unit || (data.volume_ml ? "ml" : "g"),
            isLiquid: data.isLiquid || false,
            calories: Math.round(data.nutrition.calories || 0),
            protein: Math.round(data.nutrition.protein || 0),
            carbs: Math.round(data.nutrition.carbs || 0),
            fat: Math.round(data.nutrition.fat || 0),
            fiber: Math.round((data.nutrition.fiber || 0) * 10) / 10,
            sugar: Math.round((data.nutrition.sugar || 0) * 10) / 10,
            sodium: Math.round(data.nutrition.sodium || 0),
            cholesterol: Math.round(data.nutrition.cholesterol || 0),
            glycemic_index: data.nutrition.glycemic_index != null
              ? Math.round(data.nutrition.glycemic_index)
              : null,
          },
        ],
      };
    }
  }

  // Legacy methods for backward compatibility
  transformGeminiResponse(geminiData) {
    console.warn(
      "Using legacy method. Consider updating to use the optimized version.",
    );
    return this.transformOptimizedResponse(geminiData, "image");
  }

  transformTextResponse(geminiData) {
    console.warn(
      "Using legacy method. Consider updating to use the optimized version.",
    );
    return this.transformOptimizedResponse(geminiData, "text");
  }

  transformGeminiResponseForServings(geminiData) {
    console.warn(
      "Using legacy method. Consider updating to use the optimized version.",
    );
    return this.transformOptimizedResponse(geminiData, "image");
  }

  transformTextResponseForServings(geminiData) {
    console.warn(
      "Using legacy method. Consider updating to use the optimized version.",
    );
    return this.transformOptimizedResponse(geminiData, "text");
  }

  /**
   * Analyzes a smartwatch / health-app screenshot and extracts calories burned.
   *
   * Supports: Apple Health, Samsung Health, Google Fit, Garmin Connect,
   * Fitbit, Mi Fitness, and generic fitness app UIs.
   *
   * @param {File} imageFile  — The screenshot image file (JPEG / PNG / WEBP)
   * @returns {{ caloriesBurned: number, confidence: string, source: string }}
   */
  async analyzeWatchScreenshot(imageFile) {
    if (!this.model) {
      throw new Error("Gemini API key not configured.");
    }

    const toBase64 = (file) =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

    const base64 = await toBase64(imageFile);
    const mimeType = imageFile.type || "image/jpeg";

    const prompt = `You are a fitness data extraction assistant.

The user has uploaded a screenshot from a smartwatch or health/fitness app.

Your ONLY task is to find and return the number of CALORIES BURNED (active energy / exercise calories / calories out) shown on screen.

Common labels to look for (any of these count):
- "Calories", "Cal", "kcal", "Active Calories", "Active Energy", "Calories Burned",
  "Exercise Calories", "Calories Out", "Move", "Energy Burned", "Total Burn", "Burn"

Rules:
1. Return ONLY the single best numeric value for total calories burned today (or for the workout shown).
2. Do NOT return "calories in" or "calories consumed" values — only calories BURNED / active energy.
3. If there are multiple calorie values, prefer the one labeled "Active Calories", "Calories Burned", or "Total".
4. If NO calorie-burned value is visible, return 0.
5. Round to the nearest whole number.
6. Identify the app/device if visible (Apple Health, Samsung Health, Fitbit, Garmin, Google Fit, etc.).

Respond with ONLY valid JSON in this exact format:
{
  "caloriesBurned": <number>,
  "confidence": "high" | "medium" | "low",
  "source": "<app or device name, or 'unknown'>"
}`;

    const result = await this.model.generateContent([
      prompt,
      { inlineData: { data: base64, mimeType } },
    ]);

    const raw = result?.response?.text?.() ?? "";
    let parsed;
    try {
      // Strip any markdown fences Gemini may wrap around the JSON
      const cleaned = raw.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      console.warn("[analyzeWatchScreenshot] Could not parse Gemini response:", raw);
      return { caloriesBurned: 0, confidence: "low", source: "unknown" };
    }

    return {
      caloriesBurned: Math.round(Number(parsed.caloriesBurned) || 0),
      confidence: parsed.confidence || "low",
      source: parsed.source || "unknown",
    };
  }
}

export const geminiService = new GeminiService();

export async function analyzeImageFromPlugin({ imagePath }) {
  try {
    // Load image as File object
    const response = await fetch(imagePath);
    const blob = await response.blob();
    const file = new File([blob], imagePath.split("/").pop(), {
      type: blob.type,
    });
    const gemini = new GeminiService();
    const result = await gemini.analyzeImageForNutrition(file);
    // Send result back to plugin (native)
    if (
      window.Capacitor &&
      window.Capacitor.Plugins &&
      window.Capacitor.Plugins.FoodImageAnalysis
    ) {
      window.Capacitor.Plugins.FoodImageAnalysis.notifyAnalysisResult({
        imagePath,
        result,
      });
    }
    return result;
  } catch (err) {
    console.error("Error analyzing image from plugin:", err);
    return null;
  }
}
