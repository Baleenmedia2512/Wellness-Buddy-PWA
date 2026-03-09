import {
  getSupabaseClient,
  getISTTimestamp,
} from "../../utils/supabaseClient.js";
import { cache, cacheKeys } from "../../utils/cache.js";
import { largeBodyConfig as config } from "../../utils/apiConfig.js";

export { config };

export default async function handler(req, res) {
  // 📸 FORMATTED REQUEST LOG
  console.log("\n" + "━".repeat(80));
  console.log("📸 [NEW IMAGE UPLOAD] Request received:", {
    method: req.method,
    timestamp: new Date().toISOString(),
  });
  console.log("━".repeat(80));

  // Handle CORS
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    console.log(
      "❌ [save-background-analysis] Method not allowed:",
      req.method,
    );
    res.status(405).json({ message: "Method not allowed" });
    return;
  }

  // Check if request body is too large or malformed
  if (!req.body) {
    console.log(
      "❌ [save-background-analysis] Request body is missing or too large",
    );
    res.status(400).json({
      message: "Request body is missing or too large. Maximum size is 10MB.",
    });
    return;
  }

  const {
    userId,
    imagePath,
    analysisResult,
    timestamp,
    deviceInfo,
    ImageBase64,
    userEmail,
    clientTimestamp, // User's actual upload time from their device  
    clientTimezoneOffset // User's timezone offset in minutes
  } = req.body;

  // Extract food names from analysis for logging
  let detectedFoodNames = [];
  try {
    const analysis =
      typeof analysisResult === "string"
        ? JSON.parse(analysisResult)
        : analysisResult;
    if (analysis.foods && Array.isArray(analysis.foods)) {
      detectedFoodNames = analysis.foods.map((f) => f.name || "Unknown");
    }
  } catch (e) {
    // Ignore parsing errors for now
  }

  // 👤 FORMATTED USER INFO
  console.log("👤 [CURRENT USER]");
  console.log("   📧 Email:", userEmail || "N/A");
  console.log("   🆔 User ID:", userId);
  console.log("   📱 Device:", deviceInfo || "Manual App");
  console.log("   📁 Image:", imagePath);
  console.log("   📦 Has Base64:", !!ImageBase64);
  console.log("   ✅ Has Analysis:", !!analysisResult);
  console.log("━".repeat(80));

  // 🍽️ LOG USER + DETECTED FOODS
  if (detectedFoodNames.length > 0) {
    console.log(
      `🍽️ [USER-UPLOAD] ${userEmail || userId} uploaded image with AI-detected foods: ${detectedFoodNames.join(", ")}`,
    );
  }

  if (!userId || !imagePath || !analysisResult) {
    console.log("❌ [save-background-analysis] Missing required fields:", {
      userId: !!userId,
      imagePath: !!imagePath,
      analysisResult: !!analysisResult,
    });
    res.status(400).json({
      message: "Missing required fields: userId, imagePath, analysisResult",
    });
    return;
  }

  try {
    // Parse analysis result to extract nutrition values
    let totalCalories = null,
      totalProtein = null,
      totalCarbs = null,
      totalFat = null,
      totalFiber = null;
    let confidenceScore = null;
    let processedBy = "manual_app"; // Default for manual saves (matches DB enum)

    // Function to convert confidence string to numeric value
    const convertConfidenceToNumeric = (confidence) => {
      if (typeof confidence === "number") return confidence;
      if (typeof confidence === "string") {
        switch (confidence.toLowerCase()) {
          case "high":
            return 0.9;
          case "medium":
            return 0.7;
          case "low":
            return 0.5;
          case "very_high":
            return 0.95;
          case "very_low":
            return 0.3;
          default:
            return 0.7; // Default to medium confidence
        }
      }
      return null;
    };

    try {
      const analysis =
        typeof analysisResult === "string"
          ? JSON.parse(analysisResult)
          : analysisResult;

      // Extract food names for detailed logging
      const foodNames = analysis.foods?.map((f) => f.name) || [];

      console.log("📊 [save-background-analysis] Parsed analysis:", {
        hasFoods: !!analysis.foods,
        foodsLength: analysis.foods?.length,
        hasTotal: !!analysis.total,
        hasNutrition: !!analysis.nutrition,
        confidence: analysis.confidence,
      });

      // 🤖 FORMATTED AI DETECTION LOG
      if (foodNames.length > 0) {
        console.log(
          "🤖 [AI DETECTION] Detected",
          foodNames.length,
          "food item(s):",
        );
        foodNames.forEach((name, index) => {
          const food = analysis.foods[index];
          const originalAiDetected = food.originalAiName || name; // The very first AI detection
          const currentName = name; // Current food name (could be auto-corrected)
          const userCorrected = food.userCorrectedName; // If user manually corrected it
          const wasAutoCorrected = food.wasAutoCorrected || false; // Auto-correction flag
          const correctionSource = food.correctionSource; // Correction source details
          const calories = food.nutrition?.calories || 0;
          const portion = food.portion || "portion unknown";

          // Show the full chain: Original AI → Auto-corrected → User correction
          if (userCorrected) {
            // User manually corrected it
            if (wasAutoCorrected || originalAiDetected !== currentName) {
              // Has both auto-correction and user correction
              console.log(
                `   ${index + 1}. 🔄 AI: "${originalAiDetected}" → Auto: "${currentName}" → User: "${userCorrected}"`,
              );
              if (correctionSource) {
                console.log(`      ℹ️ ${correctionSource}`);
              }
              
              // ============================================
              // 📋 DETAILED CORRECTION LOG (FULL CHAIN)
              // ============================================
              console.log(`
╔════════════════════════════════════════════════════════════════
║ 🔄 FOOD CORRECTION FLOW (FULL CHAIN)
╠════════════════════════════════════════════════════════════════
║ 🤖 AI Detected Name:      "${originalAiDetected}"
║ 🔄 Auto-Corrected To:     "${currentName}"
║ 👤 User Corrected To:     "${userCorrected}"
║ 📊 Final Display Name:    "${userCorrected}"
╠════════════════════════════════════════════════════════════════
║ 📈 Stats:
║    - Auto-Correction: ${correctionSource || 'Applied'}
║    - User Override: Yes (manual correction)
║    - Portion: ${portion}
║    - Calories: ${calories} cal
╚════════════════════════════════════════════════════════════════
              `);
              
              console.log(`🤖 [AI-DETECTED] Original: ${originalAiDetected}`);
              console.log(`🔄 [AUTO-CORRECTED] First mapped to: ${currentName}`);
              console.log(`👤 [USER-CORRECTED] Then user changed to: ${userCorrected}`);
              console.log(`📊 [FINAL-DISPLAY] Will show: ${userCorrected}`);
              console.log(`📦 [PORTION] ${portion}`);
              console.log(`🔥 [CALORIES] ${calories} cal`);
              
              console.log('[CORRECTION-DATA]', {
                aiDetected: originalAiDetected,
                autoCorrected: currentName,
                userCorrected: userCorrected,
                finalDisplay: userCorrected,
                source: correctionSource,
                portion: portion,
                calories: calories,
                timestamp: new Date().toISOString()
              });
            } else {
              // Only user correction (no auto-correction)
              console.log(
                `   ${index + 1}. 🔄 AI: "${originalAiDetected}" → User: "${userCorrected}"`,
              );
              
              console.log(`
╔════════════════════════════════════════════════════════════════
║ 🔄 FOOD CORRECTION FLOW
╠════════════════════════════════════════════════════════════════
║ 🤖 AI Detected Name:     "${originalAiDetected}"
║ 👤 User Corrected To:    "${userCorrected}"
║ 📊 Final Display Name:   "${userCorrected}"
╠════════════════════════════════════════════════════════════════
║ 📈 Stats:
║    - Auto-Correction: No
║    - User Override: Yes (manual correction)
║    - Portion: ${portion}
║    - Calories: ${calories} cal
╚════════════════════════════════════════════════════════════════
              `);
              
              console.log(`🤖 [AI-DETECTED] Original: ${originalAiDetected}`);
              console.log(`👤 [USER-CORRECTED] User changed to: ${userCorrected}`);
              console.log(`📊 [FINAL-DISPLAY] Will show: ${userCorrected}`);
              console.log(`📦 [PORTION] ${portion}`);
              console.log(`🔥 [CALORIES] ${calories} cal`);
              
              console.log('[CORRECTION-DATA]', {
                aiDetected: originalAiDetected,
                userCorrected: userCorrected,
                finalDisplay: userCorrected,
                portion: portion,
                calories: calories,
                timestamp: new Date().toISOString()
              });
            }
          } else if (wasAutoCorrected && originalAiDetected !== currentName) {
            // Only auto-corrected (no user correction)
            console.log(
              `   ${index + 1}. 🔄 AI: "${originalAiDetected}" → ✅ Auto-Corrected: "${currentName}"`,
            );
            if (correctionSource) {
              console.log(`      ℹ️ ${correctionSource}`);
            }
            
            // ============================================
            // 📋 DETAILED BACKEND CORRECTION LOG
            // ============================================
            console.log(`
╔════════════════════════════════════════════════════════════════
║ 🔄 FOOD CORRECTION FLOW
╠════════════════════════════════════════════════════════════════
║ 🤖 AI Detected Name:    "${originalAiDetected}"
║ 👤 User Corrected To:   "${currentName}"
║ 📊 Final Display Name:  "${currentName}"
╠════════════════════════════════════════════════════════════════
║ 📈 Stats:
║    - Correction Source: ${correctionSource || 'Auto-correction applied'}
║    - Portion: ${portion}
║    - Calories: ${calories} cal
╚════════════════════════════════════════════════════════════════
            `);
            
            console.log(`🤖 [AI-DETECTED] Original: ${originalAiDetected}`);
            console.log(`👤 [USER-CORRECTED] Mapped to: ${currentName}`);
            console.log(`📊 [FINAL-DISPLAY] Will show: ${currentName}`);
            console.log(`📦 [PORTION] ${portion}`);
            console.log(`🔥 [CALORIES] ${calories} cal`);
            
            // Additional metadata if available
            if (food.correctionMetadata) {
              console.log(`🔗 [CHAIN-INFO] Length: ${food.correctionMetadata.chainLength || 1} step(s)`);
              console.log(`👥 [USER-COUNT] Corrected by: ${food.correctionMetadata.userCount || 1} user(s)`);
            }
            
            console.log('[CORRECTION-DATA]', {
              aiDetected: originalAiDetected,
              userCorrected: currentName,
              finalDisplay: currentName,
              source: correctionSource,
              portion: portion,
              calories: calories,
              timestamp: new Date().toISOString()
            });
          } else {
            // No corrections at all
            console.log(`   ${index + 1}. ✅ ${currentName} (No auto-correction)`);
            console.log(`      🤖 [AI-DETECTED] Name: ${currentName} (no corrections found in database)`);
          }
          console.log(`      📊 ${portion} | ${calories} cal`);
        });
        console.log("━".repeat(80));
        
        // 📊 AUTO-CORRECTION SUMMARY TABLE (matching frontend format)
        const correctedItems = analysis.foods.filter(food => {
          const originalAiDetected = food.originalAiName || food.name;
          const currentName = food.name;
          return food.wasAutoCorrected || originalAiDetected !== currentName;
        });
        
        if (correctedItems.length > 0) {
          console.log(`🎯 [GLOBAL-AUTO] ✓ ${correctedItems.length}/${foodNames.length} items auto-corrected`);
          console.log('\n📊 [CORRECTION-SUMMARY] Auto-correction results:');
          console.table(
            correctedItems.map((food) => ({
              'AI Detected': food.originalAiName || food.name,
              'User Corrected': food.name,
              'Final Display': food.name,
              'User Count': food.correctionMetadata?.userCount || 'N/A',
              'Chain Length': food.correctionMetadata?.chainLength || 'N/A'
            }))
          );
        } else {
          console.log(`⚪ [GLOBAL-AUTO] ℹ No auto-corrections applied (0/${foodNames.length} items)`);
        }
      }

      // Check if this is from background service (has foods array with total)
      if (analysis.foods && analysis.foods.length > 0 && analysis.total) {
        // This is the standard format (both background service and manual save now use this)
        totalCalories = analysis.total.calories || null;
        totalProtein = analysis.total.protein || null;
        totalCarbs = analysis.total.carbs || null;
        totalFat = analysis.total.fat || null;
        totalFiber = analysis.total.fiber || null;
        confidenceScore = convertConfidenceToNumeric(analysis.confidence);
        // Determine source based on deviceInfo - only actual Android Background Service should be background_service
        processedBy =
          deviceInfo && deviceInfo.includes("Android Background Service")
            ? "background_service"
            : "manual_app";
        console.log(
          "✅ [save-background-analysis] Using standard format (foods + total)",
        );
      } else if (analysis.nutrition) {
        // Legacy manual save format - use nutrition object (keeping for backwards compatibility)
        totalCalories = analysis.nutrition.calories || null;
        totalProtein = analysis.nutrition.protein || null;
        totalCarbs = analysis.nutrition.carbs || null;
        totalFat = analysis.nutrition.fat || null;
        totalFiber = analysis.nutrition.fiber || null;
        confidenceScore = convertConfidenceToNumeric(analysis.confidence);
        processedBy = "manual_app";
        console.log(
          "✅ [save-background-analysis] Using legacy format (nutrition object)",
        );
      } else if (analysis.foods && analysis.foods.length > 0) {
        // Fallback: extract from first food item (legacy format)
        const firstFood = analysis.foods[0];
        if (firstFood.nutrition) {
          totalCalories = firstFood.nutrition.calories || null;
          totalProtein = firstFood.nutrition.protein || null;
          totalCarbs = firstFood.nutrition.carbs || null;
          totalFat = firstFood.nutrition.fat || null;
          totalFiber = firstFood.nutrition.fiber || null;
        }
        confidenceScore = convertConfidenceToNumeric(
          firstFood.confidence || analysis.confidence,
        );
        processedBy = "background_service";
        console.log(
          "✅ [save-background-analysis] Using fallback format (first food item)",
        );
      }

      console.log("📊 [save-background-analysis] Extracted nutrition:", {
        totalCalories,
        totalProtein,
        totalCarbs,
        totalFat,
        totalFiber,
        confidenceScore,
        processedBy,
      });
    } catch (parseError) {
      console.warn(
        "⚠️ [save-background-analysis] Could not parse nutrition data:",
        parseError,
      );
    }

    // Database connection - Use Supabase REST API
    const supabase = getSupabaseClient();

    // If ImageBase64 is empty string, store as null
    const imageBase64ToSave =
      ImageBase64 && ImageBase64.trim() !== "" ? ImageBase64 : null;

    const analysisDataJson =
      typeof analysisResult === "string"
        ? analysisResult
        : JSON.stringify(analysisResult);

    console.log(
      "💾 [save-background-analysis] Preparing to insert into Supabase:",
      {
        UserID: userId.toString(),
        ImagePath: imagePath.substring(0, 50) + "...",
        hasImageBase64: !!imageBase64ToSave,
        TotalCalories: totalCalories,
        ProcessedBy: processedBy,
      },
    );

    // Insert using Supabase - use PascalCase column names as they exist in Supabase
    // Store everything in IST (Indian Standard Time)
    const currentTime = getISTTimestamp();
    
    // 🔍 DEBUG: Log food analysis upload details with client time comparison
    const clientLocalTime = clientTimestamp ? new Date(clientTimestamp) : null;
    console.log('🍽️ Food Analysis Upload:', {
      userId,
      totalCalories,
      processedBy,
      clientUploaded: clientTimestamp || 'Not provided',
      clientLocalTime: clientLocalTime ? clientLocalTime.toLocaleString('en-US', { hour12: true }) : 'N/A',
      clientTimezoneOffset,
      serverUTC: new Date().toISOString(),
      storedIST: currentTime,
      timeDifference: clientTimestamp ? `${Math.round((new Date() - clientLocalTime) / 1000)}s` : 'N/A',
      note: 'Compare client upload time vs stored IST - this affects meal categorization!'
    });
    
    const { data, error } = await supabase
      .from("food_nutrition_data_table")
      .insert({
        UserID: userId.toString(),
        ImagePath: imagePath,
        AnalysisData: analysisDataJson,
        ConfidenceScore: confidenceScore,
        TotalCalories: totalCalories,
        TotalProtein: totalProtein,
        TotalCarbs: totalCarbs,
        TotalFat: totalFat,
        TotalFiber: totalFiber,
        ProcessedBy: processedBy,
        DeviceInfo:
          deviceInfo ||
          (processedBy === "background_service"
            ? "Android Background Service"
            : "Wellness Valley Web App"),
        ImageBase64: imageBase64ToSave,
        CreatedAt: currentTime,
        UpdatedAt: currentTime,
      })
      .select()
      .single();

    if (error) {
      console.error(
        "❌ [save-background-analysis] Database save error:",
        error,
      );
      console.error("❌ [save-background-analysis] Error code:", error.code);
      console.error(
        "❌ [save-background-analysis] Error details:",
        error.details,
      );
      console.error("❌ [save-background-analysis] Error hint:", error.hint);
      throw error;
    }

    console.log(
      "✅ [save-background-analysis] Successfully saved to database, ID:",
      data?.ID,
    );

    // 🎉 FORMATTED SUCCESS LOG
    console.log("🎉 [SAVE SUCCESS]");
    console.log("   ✅ Database ID:", data?.ID);
    console.log("   👤 User:", userEmail || userId);
    if (detectedFoodNames.length > 0) {
      console.log("   🍽️ Foods:", detectedFoodNames.join(", "));
    }
    console.log("   📊 Nutrition:");
    console.log("      🔥 Calories:", totalCalories || 0);
    console.log("      💪 Protein:", totalProtein || 0, "g");
    console.log("      🍚 Carbs:", totalCarbs || 0, "g");
    console.log("      🧈 Fat:", totalFat || 0, "g");
    console.log("   📱 Source:", processedBy);
    console.log("━".repeat(80));
    
    // 📊 FINAL CORRECTION SUMMARY TABLE (for Vercel logs)
    try {
      const parsedAnalysis = typeof analysisResult === "string" 
        ? JSON.parse(analysisResult) 
        : analysisResult;
      
      if (parsedAnalysis.foods) {
        const correctedFoods = parsedAnalysis.foods.filter(food => {
          const originalAiDetected = food.originalAiName || food.name;
          const currentName = food.name;
          return food.wasAutoCorrected || originalAiDetected !== currentName;
        });
        
        if (correctedFoods.length > 0) {
          console.log('\n📊 [FINAL-CORRECTION-TABLE] Runtime Log Summary:');
          console.table(
            correctedFoods.map((food) => ({
              'AI Detected': food.originalAiName || food.name,
              'User Corrected': food.name,
              'Final Display': food.name,
              'User Count': food.correctionMetadata?.userCount || 1,
              'Chain Length': food.correctionMetadata?.chainLength || 1
            }))
          );
          console.log(`\n✅ [CORRECTION-COMPLETE] ${correctedFoods.length} item(s) auto-corrected and saved\n`);
        }
      }
    } catch (e) {
      // Skip if parsing fails
    }

    res.status(200).json({
      success: true,
      id: data?.ID || data?.id,
      message: "Analysis saved successfully",
      data: {
        userId,
        imagePath: imagePath.substring(imagePath.lastIndexOf("/") + 1),
        nutrition: {
          calories: totalCalories,
          protein: totalProtein,
          carbs: totalCarbs,
          fat: totalFat,
          fiber: totalFiber,
        },
        confidence: confidenceScore,
        timestamp: new Date().toISOString(),
      },
    });

    // Clear nutrition cache only (education is separate domain)
    cache.delete(cacheKeys.nutritionMeals(userId));
    console.log(
      "🗑️ [save-background-analysis] Nutrition cache cleared for user:",
      userId,
    );
    console.log("✅ [save-background-analysis] Response sent successfully");
  } catch (error) {
    console.error("❌ [save-background-analysis] Caught error:", error);
    console.error("❌ [save-background-analysis] Error code:", error.code);
    console.error(
      "❌ [save-background-analysis] Error message:",
      error.message,
    );
    console.error("❌ [save-background-analysis] Error stack:", error.stack);

    // Enhanced error messages for different error types
    let errorMessage = "Failed to save analysis";

    if (error.code === "ETIMEDOUT" || error.message?.includes("timeout")) {
      errorMessage = "Database connection timeout. Please try again.";
    } else if (error.message?.includes("Connection terminated")) {
      errorMessage = "Database connection was terminated. Retrying...";
    } else if (error.code === "ECONNREFUSED") {
      errorMessage =
        "Database connection refused. Please check if database is accessible.";
    } else if (error.code === "23505") {
      errorMessage =
        "Duplicate key error: The database sequence needs to be reset. Please contact support.";
      console.error(
        "❌ [save-background-analysis] DUPLICATE KEY ERROR - Sequence out of sync!",
      );
      console.error(
        "❌ [save-background-analysis] Run this SQL in Supabase: SELECT setval(pg_get_serial_sequence('food_nutrition_data_table', 'ID'), (SELECT MAX(\"ID\") FROM food_nutrition_data_table));",
      );
    }

    console.error(
      "❌ [save-background-analysis] Sending error response:",
      errorMessage,
    );

    res.status(500).json({
      success: false,
      message: errorMessage,
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}
