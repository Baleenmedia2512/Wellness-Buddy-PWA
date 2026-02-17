import { getSupabaseClient } from "../../utils/supabaseClient.js";

/**
 * API: Get Token Pricing Configuration
 * Fetches user-specific token pricing configuration (USD per million tokens)
 */
export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, cache-control, pragma",
  );

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({
      success: false,
      message: "Method not allowed",
    });
    return;
  }

  const { email, modelName = "gemini-2.5-flash-lite" } = req.query;

  if (!email) {
    res.status(400).json({
      success: false,
      message: "Missing required parameter: email",
    });
    return;
  }

  try {
    const supabase = getSupabaseClient();

    console.log(
      "📊 [get-token-pricing] Fetching pricing config for:",
      email,
      modelName,
    );

    // Fetch pricing configuration directly by ModelName (no UserId required)
    const { data: pricingRows, error: pricingError } = await supabase
      .from("token_pricing_table")
      .select("*")
      .eq('"ModelName"', modelName)
      .eq('"IsActive"', true)
      .order('"UpdatedAt"', { ascending: false })
      .limit(1);

    if (pricingError) throw pricingError;

    if (pricingRows && pricingRows.length > 0) {
      const pricing = pricingRows[0];
      console.log("✅ [get-token-pricing] Found custom pricing:", pricing);

      res.status(200).json({
        success: true,
        data: {
          inputPerMillion: parseFloat(pricing.InputCostPer1M),
          outputPerMillion: parseFloat(pricing.OutputCostPer1M),
          modelName: pricing.ModelName,
          updatedAt: pricing.UpdatedAt,
          isDefault: false,
        },
      });
      return;
    }

    // No custom pricing found - return defaults
    console.log(
      "📊 [get-token-pricing] No custom pricing found, returning defaults",
    );
    res.status(200).json({
      success: true,
      data: {
        inputPerMillion: 0.1,
        outputPerMillion: 0.4,
        modelName,
        isDefault: true,
      },
    });
  } catch (error) {
    console.error("❌ [get-token-pricing] Error:", error);

    // Return default pricing on error
    res.status(200).json({
      success: true,
      data: {
        inputPerMillion: 0.1,
        outputPerMillion: 0.4,
        modelName: req.query.modelName || "gemini-2.5-flash-lite",
        isDefault: true,
        error: error.message,
      },
    });
  }
}
