import {
  getSupabaseClient,
  getISTTimestamp,
} from "../../utils/supabaseClient.js";
import { cache, cacheKeys } from "../../utils/cache.js";
import { largeBodyConfig as config } from "../../utils/apiConfig.js";

export { config };

export default async function handler(req, res) {
  // Set CORS headers for all requests
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ message: "Method not allowed" });
    return;
  }

  const { email, name, height, bmr, dietType, profileImage, phoneNumber } =
    req.body;

  console.log("👤 [update-user-profile] Request received:", {
    email,
    name,
    height,
    bmr,
    dietType,
    phoneNumber,
    hasProfileImage: !!profileImage,
  });

  // Validate required field
  if (!email) {
    console.log("❌ [update-user-profile] Missing required field: email");
    res.status(400).json({
      success: false,
      message: "Missing required field: email",
    });
    return;
  }

  try {
    const supabase = getSupabaseClient();

    console.log("📊 [update-user-profile] Using Supabase REST API");

    // First, get the user to verify they exist and get their UserId
    const { data: user, error: userError } = await supabase
      .from("team_table")
      .select("UserId")
      .eq("Email", email)
      .maybeSingle();

    if (userError || !user) {
      console.log("❌ [update-user-profile] User not found:", email);
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    const userId = user.UserId;
    console.log("✅ [update-user-profile] User found:", { userId });

    // Build update data object for team_table
    const updateData = {};
    let cleanedPhoneNumber;

    if (name !== undefined && name !== null) {
      updateData.UserName = name;
    }

    if (height !== undefined && height !== null) {
      updateData.Height = parseFloat(height);
    }

    if (dietType !== undefined && dietType !== null) {
      // Validate diet type
      const validDietTypes = [
        "Vegetarian",
        "Non-Vegetarian",
        "Vegan",
        "Pescatarian",
      ];
      if (validDietTypes.includes(dietType)) {
        updateData.DietType = dietType;
      } else {
        console.log("⚠️ [update-user-profile] Invalid diet type:", dietType);
      }
    }

    if (
      phoneNumber !== undefined &&
      phoneNumber !== null &&
      phoneNumber.trim() !== ""
    ) {
      // Basic validation: 10-15 digits, optional leading +
      const cleaned = phoneNumber.trim().replace(/[\s\-()]/g, "");
      if (/^\+?[0-9]{10,15}$/.test(cleaned)) {
        updateData.PhoneNumber = cleaned;
        cleanedPhoneNumber = cleaned;
      } else {
        console.log(
          "⚠️ [update-user-profile] Invalid phone number:",
          phoneNumber,
        );
      }
    }

    // Handle profile image update
    if (profileImage !== undefined && profileImage !== null) {
      // Validate base64 image format
      if (profileImage.startsWith("data:image/")) {
        updateData.ProfileImage = profileImage;
        console.log("✅ [update-user-profile] Profile image will be updated");
      } else {
        console.log("⚠️ [update-user-profile] Invalid profile image format");
      }
    }

    // Update team_table if there are fields to update
    if (Object.keys(updateData).length > 0) {
      console.log("📝 [update-user-profile] Updating team_table:", updateData);
      const { data: updatedRows, error: updateError } = await supabase
        .from("team_table")
        .update(updateData)
        .eq("UserId", userId)
        .select('UserId');

      if (updateError) throw updateError;
      if (!updatedRows || updatedRows.length === 0) {
        throw new Error(`Profile update matched 0 rows for UserId ${userId}`);
      }

      console.log(
        "✅ [update-user-profile] team_table updated successfully, rows affected:",
        updatedRows.length,
      );

      // Update LastActiveAt to track user activity
      try {
        const { error: activityUpdateError } = await supabase
          .from('team_table')
          .update({ LastActiveAt: getISTTimestamp() })
          .eq('UserId', userId);
        
        if (activityUpdateError) {
          console.warn('⚠️ [update-user-profile] Failed to update LastActiveAt:', activityUpdateError);
        } else {
          console.log('✅ [update-user-profile] Updated LastActiveAt for user:', userId);
        }
      } catch (err) {
        console.warn('⚠️ [update-user-profile] Error updating LastActiveAt:', err);
      }

      // Verify persisted values to prevent false success responses.
      const { data: verifyRow, error: verifyError } = await supabase
        .from("team_table")
        .select('UserId, Height, DietType, PhoneNumber')
        .eq('UserId', userId)
        .maybeSingle();

      if (verifyError) throw verifyError;
      if (!verifyRow) {
        throw new Error(`Unable to verify profile update for UserId ${userId}`);
      }

      if (cleanedPhoneNumber && verifyRow.PhoneNumber !== cleanedPhoneNumber) {
        throw new Error("Phone number was not saved. Please try again.");
      }

      if (height !== undefined && height !== null) {
        const reqHeight = parseFloat(height);
        const savedHeight = verifyRow.Height
          ? parseFloat(verifyRow.Height)
          : null;
        if (!Number.isNaN(reqHeight) && savedHeight !== reqHeight) {
          throw new Error("Height was not saved. Please try again.");
        }
      }

      if (dietType !== undefined && dietType !== null && updateData.DietType) {
        if (verifyRow.DietType !== updateData.DietType) {
          throw new Error("Diet preference was not saved. Please try again.");
        }
      }
    }

    // Update BMR directly in team_table if provided
    let savedBmr = null;
    if (bmr !== undefined && bmr !== null) {
      const bmrValue = parseFloat(bmr);
      if (!isNaN(bmrValue) && bmrValue > 0) {
        const { error: bmrUpdateError } = await supabase
          .from("team_table")
          .update({ Bmr: bmrValue })
          .eq("UserId", userId);

        if (bmrUpdateError) throw bmrUpdateError;
        console.log("✅ [update-user-profile] BMR updated in team_table:", bmrValue);
        savedBmr = bmrValue;
      }
    }

    console.log("✅ [update-user-profile] Profile updated successfully");

    // PERFORMANCE OPTIMIZATION: Clear cached profile data
    // This ensures users see updated data immediately on next load
    try {
      cache.delete(cacheKeys.userProfile(email));
      console.log("🗑️ [update-user-profile] Cache cleared for:", email);
    } catch (cacheError) {
      // Don't fail the request if cache clear fails
      console.warn(
        "⚠️ [update-user-profile] Cache clear failed:",
        cacheError.message,
      );
    }

    const responseData = {
      success: true,
      message: "User profile updated successfully",
      data: {
        email,
        name: name || undefined,
        height: height ? parseFloat(height) : undefined,
        bmr: savedBmr || undefined,
        dietType: dietType || undefined,
        phoneNumber: cleanedPhoneNumber || undefined,
        profileImageUpdated: !!profileImage,
      },
    };

    console.log(
      "📦 [update-user-profile] Response:",
      JSON.stringify(responseData, null, 2),
    );

    res.status(200).json(responseData);
  } catch (error) {
    console.error("❌ [update-user-profile] Database error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update user profile",
      error: error.message,
    });
  }
}
