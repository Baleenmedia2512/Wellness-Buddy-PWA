import { getSupabaseClient } from "../../utils/supabaseClient.js";

/**
 * API: Reverse-Lookup Correction
 * Given a corrected food name, find what AI-detected name it came from
 * 
 * Use case: When loading a meal from database that was auto-corrected
 * but the originalAiName metadata was lost, we can reverse-lookup to find it.
 * 
 * Example:
 *   Input: "Herbal Tea" (current corrected name)
 *   Output: "black tea" (original AI detection)
 */
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { correctedName } = req.query;

    if (!correctedName) {
      res.status(400).json({
        error: "Missing required parameter: correctedName",
      });
      return;
    }

    console.log("🔍 [REVERSE-LOOKUP] Looking for original AI name for:", correctedName);

    const supabase = getSupabaseClient();

    // Find the most recent correction where UserCorrected matches the given name
    // This tells us what AI-detected name was corrected to this current name
    const { data: corrections, error } = await supabase
      .from("food_corrections_table")
      .select('"AiDetected", "UserCorrected", "LastCorrected", "UserId"')
      .eq('"UserCorrected"', correctedName)
      .order('"LastCorrected"', { ascending: false })
      .limit(1);

    if (error) throw error;

    if (!corrections || corrections.length === 0) {
      console.log("❌ [REVERSE-LOOKUP] No correction found for:", correctedName);
      res.status(200).json({
        success: false,
        found: false,
        correctedName: correctedName,
        originalAiName: null,
      });
      return;
    }

    const correction = corrections[0];
    console.log("✅ [REVERSE-LOOKUP] Found:", {
      correctedName: correctedName,
      originalAiName: correction.AiDetected,
      lastCorrectedBy: correction.UserId,
      lastCorrected: correction.LastCorrected,
    });

    res.status(200).json({
      success: true,
      found: true,
      correctedName: correctedName,
      originalAiName: correction.AiDetected,
      lastCorrectedBy: correction.UserId,
      lastCorrected: correction.LastCorrected,
    });
    return;
  } catch (error) {
    console.error("❌ [REVERSE-LOOKUP] Error:", error);
    res.status(500).json({
      error: "Failed to reverse-lookup correction",
      details: error.message,
    });
    return;
  }
}
