import {
  getSupabaseClient,
  getISTTimestamp,
} from "../../utils/supabaseClient.js";
import { identifyFoodType } from "../../utils/foodTypeDetection.js";

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Cache-Control, Pragma");

  // Handle preflight request
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  // Only allow POST requests
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { 
      userId, 
      aiDetected, 
      userCorrected,
      // Corrected values only (AI values are already in meals table)
      correctedQuantity,
      correctedUnit,
      correctedCalories,
      correctedCarbs,
      correctedProtein,
      correctedFat,
      correctedFiber
    } = req.body;

    // Validate required fields
    if (!userId || !aiDetected || !userCorrected) {
      res.status(400).json({
        error: "Missing required fields",
        required: ["userId", "aiDetected", "userCorrected"],
      });
      return;
    }

    console.log("💾 [SAVE CORRECTION] Request received:");
    console.log("   User ID:", userId);
    console.log("   AI Detected:", aiDetected);
    console.log("   User Corrected:", userCorrected, correctedQuantity, correctedUnit);
    console.log("   Nutrition:", { correctedCalories, correctedCarbs });

    // Auto-detect food type from corrected values
    const correctedFoodType = identifyFoodType({ name: userCorrected, unit: correctedUnit });

    console.log("   Corrected Food Type:", correctedFoodType);
    
    // Validate unit matches food type
    if (correctedUnit) {
      const unitSuggestedType = identifyFoodType({ name: '', unit: correctedUnit });
      const nameSuggestedType = identifyFoodType({ name: userCorrected, unit: '' });
      
      if (unitSuggestedType !== 'unknown' && nameSuggestedType !== 'unknown' && 
          unitSuggestedType !== nameSuggestedType) {
        console.warn(`   ⚠️ [VALIDATION] Unit mismatch detected!`);
        console.warn(`      Name suggests: ${nameSuggestedType}`);
        console.warn(`      Unit suggests: ${unitSuggestedType}`);
        console.warn(`      Using type: ${correctedFoodType} (prioritized name)`);
      }
    }

    // Database connection
    const supabase = getSupabaseClient();
    const currentTime = getISTTimestamp();

    // 🔍 Check if this exact correction already exists for this user
    // Match by userId, aiDetected, userCorrected, and aiUnit (to differentiate solid vs liquid)
    const { data: existingCorrection, error: selectError } = await supabase
      .from("food_corrections_table")
      .select("*")
      .eq('"UserId"', userId)
      .eq('"AiDetected"', aiDetected)
      .eq('"UserCorrected"', userCorrected)
      .maybeSingle();

    if (selectError) throw selectError;

    let result;
    let action;

    if (existingCorrection) {
      // ♻️ UPDATE: Same user making the same correction again
      const newCount = existingCorrection.TimesCorrected + 1;
      
      const updateData = {
        TimesCorrected: newCount,
        LastCorrected: currentTime,
      };

      // Update corrected nutrition values if provided
      if (correctedQuantity !== undefined) updateData.CorrectedQuantity = correctedQuantity;
      if (correctedUnit !== undefined) updateData.CorrectedUnit = correctedUnit;
      if (correctedFoodType !== undefined) updateData.CorrectedFoodType = correctedFoodType;
      if (correctedCalories !== undefined) updateData.CorrectedCalories = correctedCalories;
      if (correctedCarbs !== undefined) updateData.CorrectedCarbs = correctedCarbs;
      if (correctedProtein !== undefined) updateData.CorrectedProtein = correctedProtein;
      if (correctedFat !== undefined) updateData.CorrectedFat = correctedFat;
      if (correctedFiber !== undefined) updateData.CorrectedFiber = correctedFiber;
      
      console.log("\n📊 ============ DATABASE UPDATE ============");
      console.log("📋 TABLE: food_corrections_table");
      console.log("🔄 ACTION: UPDATE");
      console.log("🆔 Record ID:", existingCorrection.Id);
      console.log("\n📝 BEFORE (existing values):");
      console.log("   - CorrectedQuantity:", existingCorrection.CorrectedQuantity);
      console.log("   - CorrectedUnit:", existingCorrection.CorrectedUnit);
      console.log("   - CorrectedCalories:", existingCorrection.CorrectedCalories);
      console.log("   - TimesCorrected:", existingCorrection.TimesCorrected);
      console.log("\n📝 AFTER (new values):");
      console.log("   - CorrectedQuantity:", correctedQuantity);
      console.log("   - CorrectedUnit:", correctedUnit);
      console.log("   - CorrectedCalories:", correctedCalories);
      console.log("   - TimesCorrected:", newCount);
      console.log("\n💾 Executing UPDATE query...");
      
      const { data: updatedData, error: updateError } = await supabase
        .from("food_corrections_table")
        .update(updateData)
        .eq('"Id"', existingCorrection.Id)
        .select()
        .single();

      if (updateError) throw updateError;

      result = { insertId: updatedData?.Id };
      action = "updated";

      console.log("✅ UPDATE SUCCESS!");
      console.log("   → Record ID:", updatedData?.Id);
      console.log("   → Times Corrected:", newCount);
      console.log("   → AI Detected:", aiDetected);
      console.log("   → User Corrected:", userCorrected);
      console.log("   → Weight/Volume:", correctedQuantity, correctedUnit);
      console.log("==========================================\n");

      res.status(200).json({
        success: true,
        message: "Correction count updated",
        data: {
          id: result.insertId,
          times_corrected: newCount,
          action: action,
        },
      });
    } else {
      // ➕ INSERT: New correction (different user or different target)
      console.log("\n📊 ============ DATABASE INSERT ============");
      console.log("📋 TABLE: food_corrections_table");
      console.log("🆕 ACTION: INSERT (New Correction)");
      console.log("\n📝 Data to be inserted:");
      console.log("   - UserId:", userId);
      console.log("   - AiDetected:", aiDetected);
      console.log("   - UserCorrected:", userCorrected);
      console.log("   - CorrectedQuantity:", correctedQuantity);
      console.log("   - CorrectedUnit:", correctedUnit);
      console.log("   - CorrectedCalories:", correctedCalories);
      console.log("   - CorrectedProtein:", correctedProtein);
      console.log("   - CorrectedCarbs:", correctedCarbs);
      console.log("   - CorrectedFat:", correctedFat);
      console.log("   - CorrectedFiber:", correctedFiber);
      console.log("\n💾 Executing INSERT query...");
      
      const insertData = {
        UserId: userId,
        AiDetected: aiDetected,
        UserCorrected: userCorrected,
        TimesCorrected: 1,
        CreatedAt: currentTime,
        LastCorrected: currentTime,
      };

      // Add corrected nutrition and quantity fields if provided
      if (correctedQuantity !== undefined) insertData.CorrectedQuantity = correctedQuantity;
      if (correctedUnit !== undefined) insertData.CorrectedUnit = correctedUnit;
      if (correctedFoodType !== undefined) insertData.CorrectedFoodType = correctedFoodType;
      if (correctedCalories !== undefined) insertData.CorrectedCalories = correctedCalories;
      if (correctedCarbs !== undefined) insertData.CorrectedCarbs = correctedCarbs;
      if (correctedProtein !== undefined) insertData.CorrectedProtein = correctedProtein;
      if (correctedFat !== undefined) insertData.CorrectedFat = correctedFat;
      if (correctedFiber !== undefined) insertData.CorrectedFiber = correctedFiber;
      
      const { data: insertedData, error: insertError } = await supabase
        .from("food_corrections_table")
        .insert(insertData)
        .select()
        .single();

      if (insertError) throw insertError;

      result = { insertId: insertedData?.Id };
      action = "created";

      console.log("✅ INSERT SUCCESS!");
      console.log("   → New Record ID:", insertedData?.Id);
      console.log("   → AI Detected:", aiDetected);
      console.log("   → User Corrected:", userCorrected);
      console.log("   → Weight/Volume:", correctedQuantity, correctedUnit);
      console.log("   → Calories:", correctedCalories);
      console.log("   → Protein:", correctedProtein);
      console.log("   → Carbs:", correctedCarbs);
      console.log("   → Fat:", correctedFat);
      console.log("   → Fiber:", correctedFiber);
      console.log("==========================================\n");

      res.status(201).json({
        success: true,
        message: "Correction saved",
        data: {
          id: result.insertId,
          times_corrected: 1,
          action: action,
        },
      });
    }
    return;
  } catch (error) {
    console.error("Error saving food correction:", error);
    res.status(500).json({
      error: "Failed to save correction",
      details: error.message,
    });
    return;
  }
}
