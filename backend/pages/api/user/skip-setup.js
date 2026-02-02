/**
 * Skip Setup Wizard
 * POST /api/user/skip-setup
 *
 * Marks user as having skipped the setup wizard
 * This persists the skip status in the database so it works across sessions/devices
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

  // Only allow POST requests
  if (req.method !== "POST") {
    res.status(405).json({
      success: false,
      error: "Method not allowed",
    });
    return;
  }

  try {
    const { email, coachId } = req.body;

    if (!email) {
      res.status(400).json({
        success: false,
        error: "Email is required",
      });
      return;
    }

    console.log(`📝 Skip setup request for ${email}, coachId: ${coachId || 'none'}`);

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
      console.log(`👥 Saving coach relationship: User → Coach (${coachId})`);
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
}
