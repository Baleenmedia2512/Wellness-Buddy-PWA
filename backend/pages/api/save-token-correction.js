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

    // Always insert a new record (no update - track all changes)
    const currentTime = getISTTimestamp();
    const { error: insertError } = await supabase
      .from("token_correction_table")
      .insert({
        UserId: userId,
        InputTokenCost: correctedInputCost,
        OutputTokenCost: correctedOutputCost,
        TotalTokenCost: totalCost,
        CreatedAt: currentTime,
      });

    if (insertError) throw insertError;

    console.log("✅ [save-token-correction] Inserted new record:", {
      userId,
      totalCost,
    });

    // Save or update pricing configuration if provided
    if (inputPerMillion !== undefined && outputPerMillion !== undefined) {
      console.log("💾 [save-token-correction] Saving pricing config:", {
        inputPerMillion,
        outputPerMillion,
      });

      // First, check if the record exists
      const { data: existingPricing, error: checkError } = await supabase
        .from("token_pricing_table")
        .select("*")
        .eq('"ModelName"', "gemini-2.5-flash-lite")
        .single();

      if (checkError && checkError.code !== "PGRST116") {
        // PGRST116 = not found, which is okay
        console.error(
          "⚠️ [save-token-correction] Error checking existing pricing:",
          checkError,
        );
      }

      let pricingResult;
      if (existingPricing) {
        // Update existing record
        console.log(
          "💾 [save-token-correction] Updating existing pricing record",
        );
        pricingResult = await supabase
          .from("token_pricing_table")
          .update({
            InputCostPer1M: parseFloat(inputPerMillion),
            OutputCostPer1M: parseFloat(outputPerMillion),
          })
          .eq('"ModelName"', "gemini-2.5-flash-lite")
          .select();
      } else {
        // Insert new record
        console.log("💾 [save-token-correction] Inserting new pricing record");
        pricingResult = await supabase
          .from("token_pricing_table")
          .insert({
            ModelName: "gemini-2.5-flash-lite",
            InputCostPer1M: parseFloat(inputPerMillion),
            OutputCostPer1M: parseFloat(outputPerMillion),
            Currency: "USD",
            IsActive: true,
          })
          .select();
      }

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
