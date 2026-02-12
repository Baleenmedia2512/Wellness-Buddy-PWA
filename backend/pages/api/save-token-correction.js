import {
  getSupabaseClient,
  getISTTimestamp,
} from "../../utils/supabaseClient.js";

/**
 * API: Save Token Correction
 * Saves original and corrected token costs to token_correction_table
 */
export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, cache-control, pragma",
  );

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({
      success: false,
      message: "Method not allowed",
    });
    return;
  }

  const {
    email,
    originalInputCost,
    originalOutputCost,
    correctedInputCost,
    correctedOutputCost,
    inputPerMillion,
    outputPerMillion,
    timeRange,
    startDate,
    endDate,
    model,
  } = req.body;

  if (
    !email ||
    correctedInputCost === undefined ||
    correctedOutputCost === undefined
  ) {
    res.status(400).json({
      success: false,
      message:
        "Missing required fields: email, correctedInputCost, correctedOutputCost",
    });
    return;
  }

  try {
    // Use Supabase client
    const supabase = getSupabaseClient();

    console.log("💾 [save-token-correction] Using Supabase REST API");
    console.log(
      "💾 [save-token-correction] Saving token correction for:",
      email,
    );
    console.log("💾 [save-token-correction] Request data:", {
      originalInputCost,
      originalOutputCost,
      correctedInputCost,
      correctedOutputCost,
    });

    // Get UserId from team_table
    const { data: userRows, error: userError } = await supabase
      .from("team_table")
      .select('"UserId"')
      .eq('"Email"', email)
      .limit(1);

    if (userError) throw userError;

    console.log("💾 [save-token-correction] User lookup result:", userRows);

    if (!userRows || userRows.length === 0) {
      console.log("❌ [save-token-correction] User not found in team_table");
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    const userId = userRows[0].UserId;
    console.log("💾 [save-token-correction] Found UserId:", userId);

    // Calculate total cost
    const totalCost =
      parseFloat(correctedInputCost) + parseFloat(correctedOutputCost);

    console.log("💾 [save-token-correction] Calculated values:", {
      userId,
      inputTokenCost: correctedInputCost,
      outputTokenCost: correctedOutputCost,
      totalTokenCost: totalCost,
    });

    // Check if a correction already exists for this user and time range
    const { data: existingCorrection, error: checkError } = await supabase
      .from("token_correction_table")
      .select("*")
      .eq('"UserId"', userId)
      .eq('"TimeRange"', timeRange || 'all')
      .limit(1);

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('⚠️ [save-token-correction] Error checking existing:', checkError);
    }

    const currentTime = getISTTimestamp();
    const correctionData = {
      UserId: userId,
      InputTokenCost: correctedInputCost,
      OutputTokenCost: correctedOutputCost,
      TotalTokenCost: totalCost,
      TimeRange: timeRange || 'all',
      StartDate: startDate || null,
      EndDate: endDate || null,
      CreatedAt: currentTime,
    };

    if (existingCorrection && existingCorrection.length > 0) {
      // Update existing record for this time range
      console.log('💾 [save-token-correction] Updating existing correction for time range:', timeRange);
      const { error: updateError } = await supabase
        .from("token_correction_table")
        .update(correctionData)
        .eq('"UserId"', userId)
        .eq('"TimeRange"', timeRange || 'all');

      if (updateError) throw updateError;
    } else {
      // Insert a new record for this time range
      console.log('💾 [save-token-correction] Inserting new correction for time range:', timeRange);
      const { error: insertError } = await supabase
        .from("token_correction_table")
        .insert(correctionData);

      if (insertError) throw insertError;
    }

    console.log("✅ [save-token-correction] Saved record for time range:", {
      userId,
      timeRange: timeRange || 'all',
      totalCost,
    });

    // Save or update pricing configuration if provided
    if (inputPerMillion !== undefined && outputPerMillion !== undefined) {
      const modelName = model || "gemini-2.5-flash-lite"; // Use provided model or default
      console.log("💾 [save-token-correction] Creating NEW pricing record:", {
        modelName,
        inputPerMillion,
        outputPerMillion,
      });

      // Step 1: Deactivate ALL old pricing records for this model
      console.log("💾 [save-token-correction] Deactivating old pricing records for model:", modelName);
      const { error: deactivateError } = await supabase
        .from("token_pricing_table")
        .update({ IsActive: false })
        .eq('"ModelName"', modelName)
        .eq('"IsActive"', true);

      if (deactivateError) {
        console.error(
          "⚠️ [save-token-correction] Error deactivating old pricing:",
          deactivateError,
        );
        // Don't fail - continue to insert new record
      } else {
        console.log("✅ [save-token-correction] Old pricing records deactivated");
      }

      // Step 2: Insert NEW pricing record
      console.log("💾 [save-token-correction] Inserting NEW pricing record (history preserved)");
      const pricingResult = await supabase
        .from("token_pricing_table")
        .insert({
          ModelName: modelName,
          InputCostPer1M: parseFloat(inputPerMillion),
          OutputCostPer1M: parseFloat(outputPerMillion),
          Currency: "USD",
          IsActive: true,
          CreatedAt: getISTTimestamp(),
        })
        .select();

      const { data: savedPricing, error: pricingError } = pricingResult;

      if (pricingError) {
        console.error(
          "⚠️ [save-token-correction] Pricing config save failed:",
          pricingError,
        );
        // Return error response for pricing save failure
        res.status(500).json({
          success: false,
          message: "Token correction saved but pricing failed to save",
          error: pricingError.message,
          tokenCorrectionSaved: true,
        });
        return;
      } else {
        console.log(
          "✅ [save-token-correction] Pricing config saved successfully:",
          savedPricing,
        );
      }
    }

    res.status(200).json({
      success: true,
      message: "Token correction saved successfully",
      data: {
        userId,
        inputTokenCost: correctedInputCost,
        outputTokenCost: correctedOutputCost,
        totalTokenCost: totalCost,
      },
    });
    return;
  } catch (error) {
    console.error("❌ [save-token-correction] Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to save token correction",
      error:
        error.code === "ETIMEDOUT"
          ? "Database connection timeout. Please try again."
          : error.message,
    });
    return;
  }
}
