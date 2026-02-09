import {
  getSupabaseClient,
  getISTTimestamp,
} from "../../utils/supabaseClient.js";

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
    const { userId, aiDetected, userCorrected } = req.body;

    // Validate input
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
    console.log("   User Corrected:", userCorrected);

    // Database connection
    const supabase = getSupabaseClient();
    const currentTime = getISTTimestamp();

    // 🔍 Check if this exact correction already exists for this user
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
      
      const { data: updatedData, error: updateError } = await supabase
        .from("food_corrections_table")
        .update({
          TimesCorrected: newCount,
          LastCorrected: currentTime,
        })
        .eq('"Id"', existingCorrection.Id)
        .select()
        .single();

      if (updateError) throw updateError;

      result = { insertId: updatedData?.Id };
      action = "updated";

      console.log("♻️ BACKEND: UPDATED Existing Correction");
      console.log("   → Record ID:", updatedData?.Id);
      console.log("   → Times Corrected:", newCount);
      console.log("   → AI Detected:", aiDetected);
      console.log("   → User Corrected:", userCorrected);

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
      const { data: insertedData, error: insertError } = await supabase
        .from("food_corrections_table")
        .insert({
          UserId: userId,
          AiDetected: aiDetected,
          UserCorrected: userCorrected,
          TimesCorrected: 1,
          CreatedAt: currentTime,
          LastCorrected: currentTime,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      result = { insertId: insertedData?.Id };
      action = "created";

      console.log("✅ BACKEND: NEW Correction SAVED to database");
      console.log("   → New Correction ID:", insertedData?.Id);
      console.log("   → AI Detected:", aiDetected);
      console.log("   → User Corrected:", userCorrected);

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
