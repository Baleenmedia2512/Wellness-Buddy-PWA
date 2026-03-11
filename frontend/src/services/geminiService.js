import { GoogleGenerativeAI } from "@google/generative-ai";
import { getUserContext, formatContextForAI } from "./userContextService";
import { applyGlobalAutoCorrections } from "./foodCorrectionService";

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
      console.error("❌ UNWANTED API CALL DETECTED:", url);
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
    console.log("🌐 XHR REQUEST:", {
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
        console.error("❌ UNWANTED XHR API CALL DETECTED:", url);
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
    console.error(`❌ Error [${requestType}]:`, {
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
      console.log('⚡ Skipping preprocessing (already compressed)');
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

        console.log("📝 [AI Personalization] Context injected into prompt:", {
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
    promptParts.push("5. Return concise JSON only");
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
    promptParts.push('        "fiber": number');
    promptParts.push("      }");
    promptParts.push("    }");
    promptParts.push("  ],");
    promptParts.push('  "total": {');
    promptParts.push('    "calories": number,');
    promptParts.push('    "protein": number,');
    promptParts.push('    "carbs": number,');
    promptParts.push('    "fat": number,');
    promptParts.push('    "fiber": number');
    promptParts.push("  },");
    promptParts.push('  "confidence": "high/medium/low"');
    promptParts.push("}");
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
    // console.log('🔍 GeminiService: Starting optimized image analysis...');
    // console.log('📸 Original image:', imageFile.name, imageFile.type, imageFile.size);

    if (!this.model) {
      throw new Error("Gemini API key is not configured");
    }

    try {
      // Use provided context or fetch if userId given but no context
      if (!userContext && userId) {
        try {
          console.log(
            "🎯 [AI Personalization] Fetching user context for userId:",
            userId,
          );
          userContext = await getUserContext(userId);
          console.log("✅ [AI Personalization] Context fetched:", {
            corrections: userContext?.personalCorrections?.length || 0,
            diet: userContext?.dietPreference,
            patterns: userContext?.globalPatterns?.length || 0,
          });
        } catch (error) {
          console.warn(
            "⚠️ [AI Personalization] Failed to load context, continuing without:",
            error,
          );
        }
      } else if (userContext) {
        console.log("✅ [AI Personalization] Using pre-loaded context:", {
          corrections: userContext?.personalCorrections?.length || 0,
          diet: userContext?.dietPreference,
          patterns: userContext?.globalPatterns?.length || 0,
        });
      }

      // Preprocess image for faster processing
      const processedImage = await this.preprocessImage(imageFile);
      // console.log('📸 Processed image size:', processedImage.size);

      // Convert to base64 with timeout
      const imageBase64 = await Promise.race([
        this.fileToBase64(processedImage),
        this.timeoutPromise(10000, "Image processing timeout"),
      ]);

      // console.log('📋 Image converted to base64, length:', imageBase64.length);

      // Build personalized prompt with user context
      const prompt = this.buildPersonalizedPrompt(userContext);

      const imagePart = {
        inlineData: {
          data: imageBase64,
          mimeType: processedImage.type,
        },
      };

      // Make API call with timeout
      const result = await Promise.race([
        this.model.generateContent([prompt, imagePart]),
        this.timeoutPromise(
          this.timeout,
          `API timeout after ${this.timeout}ms`,
        ),
      ]);

      const response = await result.response;
      const text = response.text();

      // Parse response
      const nutritionData = this.parseJsonResponse(text);
      const processingTime = Date.now() - startTime;

      // Log token usage
      this.logTokenUsage(response, "image_analysis", processingTime);

      // 🎯 APPLY GLOBAL AUTO-CORRECTIONS (NEW FEATURE)
      // If ANY user corrected 'A' to 'B', next time AI detects 'A' → auto-corrects to 'B' ✨
      if (nutritionData.foods && Array.isArray(nutritionData.foods)) {
        nutritionData.foods = await applyGlobalAutoCorrections(
          nutritionData.foods,
        );
      }

      // 🔍 LOG AI DETECTION RESULTS (AFTER AUTO-CORRECTIONS FOR ACCURACY)
      console.log("🤖 ========== AI DETECTION RESULTS ==========");
      if (nutritionData.foods && Array.isArray(nutritionData.foods)) {
        nutritionData.foods.forEach((food, index) => {
          console.log(`🔍 AI Detected Food ${index + 1}:`, {
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
      console.log("============================================");

      return this.transformOptimizedResponse(nutritionData, "image");
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logError(error, "image_analysis");
      console.error(`❌ Analysis failed after ${processingTime}ms:`, error);
      throw new Error(`Analysis failed: ${error.message}`);
    }
  }

  async analyzeTextForNutrition(foodText) {
    const startTime = Date.now();
    // console.log('🔍 GeminiService: Starting text analysis for:', foodText);

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
  "nutrition": {"calories":num,"protein":num,"carbs":num,"fat":num,"fiber":num}
}

Liquids: use volume_ml+ml. Solids: use weight_g+g.
USDA values. JSON only.`;

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

      // console.log(`✅ Text analysis completed in ${processingTime}ms`);

      return this.transformOptimizedResponse(nutritionData, "text");
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logError(error, "text_analysis");
      console.error(
        `❌ Text analysis failed after ${processingTime}ms:`,
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
    console.log("🔍 GeminiService: Starting food search for:", foodQuery);

    if (!this.model) {
      throw new Error("Gemini API key is not configured");
    }

    if (!foodQuery || foodQuery.trim().length < 2) {
      console.warn("❌ Search query too short:", foodQuery);
      throw new Error("Search query must be at least 2 characters");
    }

    // Check cache first
    const cacheKey = foodQuery.toLowerCase().trim();
    const cached = this.searchCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      const cacheTime = Date.now() - startTime;
      console.log(`💾 Using cached result (${cacheTime}ms)`);
      console.log(`✅ Food search completed in ${cacheTime}ms (CACHED)`);
      return cached.data;
    }

    try {
      const prompt = `"${foodQuery}" - Return 2 DIFFERENT variations:
[{"name":"str","category":"str","isLiquid":bool,"unit":"g|ml","defaultServing":{"description":"str","grams":num,"nutrition":{"calories":num,"protein":num,"carbs":num,"fat":num,"fiber":num}},"per100g":{"calories":num,"protein":num,"carbs":num,"fat":num,"fiber":num}}]

RULES:
1. Return 2 DISTINCT variations (e.g., "Coconut Chutney", "Spicy Coconut Chutney")
2. Use standard serving with quantity (e.g., "1/2 cup", "2 tbsp", "1 piece")
3. Liquids: unit="ml", grams=ml value. Solids: unit="g", grams=weight
4. Return defaultServing nutrition + per100g nutrition
Note: Serving options generated locally, don't include servingOptions array.`;

      console.log("📤 Sending search request to Gemini...");

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

      console.log("📥 Received response from Gemini, parsing...");

      const searchResults = this.parseJsonResponse(text);
      const processingTime = Date.now() - startTime;

      // Log token usage
      this.logTokenUsage(response, "food_search", processingTime);

      console.log(`✅ Food search completed in ${processingTime}ms`);
      console.log(
        `📊 Found ${
          searchResults.results?.length || 0
        } results for "${foodQuery}"`,
      );

      // Validate results structure
      if (!searchResults.results || !Array.isArray(searchResults.results)) {
        console.error("❌ Invalid search results structure:", searchResults);
        throw new Error("Invalid search results format");
      }

      // Log first result for debugging
      if (searchResults.results.length > 0) {
        console.log("🔎 First result:", {
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
      console.log(`💾 Cached results for "${cacheKey}" (expires in 24h)`);

      return searchResults;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logError(error, "food_search");
      console.error(`❌ Food search failed after ${processingTime}ms:`, error);
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
        console.warn("⚠️ Initial JSON parse failed, attempting fixes...");

        // Check if it's an incomplete array - try to close it
        if (cleanText.includes("[") && !cleanText.endsWith("]")) {
          console.warn("⚠️ Detected incomplete array, attempting to close");
          // Count opening and closing brackets to determine how many to add
          const openBrackets = (cleanText.match(/\[/g) || []).length;
          const closeBrackets = (cleanText.match(/\]/g) || []).length;
          const openBraces = (cleanText.match(/\{/g) || []).length;
          const closeBraces = (cleanText.match(/\}/g) || []).length;

          // Add missing closing characters
          for (let i = 0; i < openBraces - closeBraces; i++) cleanText += "}";
          for (let i = 0; i < openBrackets - closeBrackets; i++)
            cleanText += "]";

          console.log("🔧 Attempted fix, trying parse again...");
          parsed = JSON.parse(cleanText);
        } else {
          throw firstError;
        }
      }

      // Handle both formats: {results: [...]} or directly [...]
      if (Array.isArray(parsed)) {
        console.log("✅ Parsed array format, wrapping in results object");
        return { results: parsed };
      }

      // If already has results property, return as-is
      if (parsed.results) {
        console.log("✅ Parsed object with results property");
        return parsed;
      }

      // If it has foods property (nutrition analysis format), return as-is
      if (parsed.foods) {
        console.log("✅ Parsed nutrition analysis with foods property");
        return parsed;
      }

      // Unknown format - return as-is without warning (could be valid response)
      return parsed;
    } catch (parseError) {
      console.error("❌ Failed to parse response. Length:", text.length);
      console.error("❌ First 500 chars:", text.substring(0, 500));
      console.error("❌ Last 500 chars:", text.substring(text.length - 500));
      console.error("❌ Parse error:", parseError.message);
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
      console.log(`📊 Token Usage [${requestType}]:`, {
        "🔤 Prompt Tokens": tokenData.promptTokens,
        "💬 Response Tokens (Output)": tokenData.completionTokens,
        "📈 Total Tokens": tokenData.totalTokens,
        "⏱️ Processing Time": `${processingTime}ms`,
        "💰 Cost Estimate": `$${totalCost.toFixed(6)}`,
      });

      // Log response quality
      console.log(`🔍 Response Quality [${requestType}]:`, {
        "✅ Finish Reason": tokenData.finishReason,
        "🛡️ Safety Ratings":
          tokenData.safetyRatings.length > 0 ? "Passed" : "N/A",
        "📝 Response Length": `${tokenData.responseLength} chars`,
        "🎯 Candidates": tokenData.candidateCount,
      });

      // // Log safety ratings detail
      // if (tokenData.safetyRatings.length > 0) {
      //   console.log('🛡️ Safety Details:', tokenData.safetyRatings);
      // }

      // // Log session summary
      // console.log(`📈 Session Summary:`, {
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

      // console.log('📋 Structured Token Data:', JSON.stringify(structuredLog));
    } catch (error) {
      console.warn("⚠️ Could not extract token usage:", error.message);
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
            };
          },
          { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
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
          fiber: Math.round(totalNutrition.fiber || 0),
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
          calories: Math.round(food.nutrition.calories || 0),
          protein: Math.round(food.nutrition.protein || 0),
          carbs: Math.round(food.nutrition.carbs || 0),
          fat: Math.round(food.nutrition.fat || 0),
          fiber: Math.round(food.nutrition.fiber || 0),
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
          fiber: Math.round(data.nutrition.fiber || 0),
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
            fiber: Math.round(data.nutrition.fiber || 0),
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
