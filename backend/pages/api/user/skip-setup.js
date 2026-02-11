/**
 * Skip Setup Wizard - DISABLED
 * POST /api/user/skip-setup
 *
 * This functionality has been commented out and disabled
 */

import { getSupabaseClient } from "../../../utils/supabaseClient.js";

export default async function handler(req, res) {
  // Handle CORS
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, authorization",
    );
    res.status(200).end();
    return;
  }

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, authorization");

  // Skip functionality is disabled
  res.status(403).json({
    success: false,
    error: "Skip setup functionality is currently disabled",
  });
  return;

  /* COMMENTED OUT - Skip setup functionality disabled
  // Only allow POST requests
  if (req.method !== "POST") {
    res.status(405).json({
      success: false,
      error: "Method not allowed",
    });
    return;
  }

  try {
    const { email, coachId, coachName } = req.body;

    if (!email) {
      res.status(400).json({
        success: false,
        error: "Email is required",
      });
      return;
    }

    console.log(`📝 Skip setup request for ${email}, coachId: ${coachId || 'none'}, coachName: ${coachName || 'none'}`);

    const supabase = getSupabaseClient();

    // Check if user exists
    const { data: user, error: userError } = await supabase
      .from("team_table")
      .select("UserId, SetupSkipped")
      .eq("Email", email)
      .maybeSingle();

    if (userError) {
      console.error("❌ Error finding user:", userError);
      throw userError;
    }

    if (!user) {
      res.status(404).json({
        success: false,
        error: "User not found",
      });
      return;
    }

    // Prepare update data
    const updateData = { SetupSkipped: true };
    
    // If coach was selected (coachId provided), save the coach relationship
    if (coachId) {
      updateData.UplineCoachId = coachId;
      if (coachName) {
        updateData.CoachName = coachName;
      }
      console.log(`👥 Saving coach relationship: User → Coach (${coachName || coachId})`);
    }

    // Update SetupSkipped flag (and optionally UplineCoachId)
    const { error: updateError } = await supabase
      .from("team_table")
      .update(updateData)
      .eq("Email", email);

    if (updateError) {
      console.error("❌ Error updating skip status:", updateError);
      throw updateError;
    }

    console.log(`✅ Setup skip recorded for user: ${email}${coachId ? ' with coach' : ''}`);

    res.status(200).json({
      success: true,
      message: "Setup skip recorded successfully",
      coachSaved: !!coachId,
    });
  } catch (error) {
    console.error("❌ Error in skip-setup:", error);
    res.status(500).json({
      success: false,
      error: "Failed to record setup skip",
      details: error.message,
    });
  }
  */
}
