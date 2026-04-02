import {
  getSupabaseClient,
  getISTTimestamp,
  convertToIST,
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

  // Check if request body is too large or malformed
  // Check
  if (!req.body) {
    res.status(400).json({
      message: "Request body is missing or too large. Maximum size is 10MB.",
    });
    return;
  }

  const {
    userId,
    weightValue,
    unit = "kg", // Default to kg if not provided
    bmi,
    bodyFat,
    muscleMass,
    bmr,
    imageBase64ToSave: WeightImageBase64,
    clientTimestamp, // User's actual upload time from their device
    clientTimezoneOffset, // User's timezone offset in minutes
    entryId // If provided, overwrite existing entry instead of inserting
  } = req.body;

  // Validate required fields
  if (!userId || !weightValue) {
    res.status(400).json({
      message: "Missing required fields: userId, weightValue",
    });
    return;
  }

  // Validate weight value
  const weight = parseFloat(weightValue);
  if (isNaN(weight) || weight <= 0 || weight > 500) {
    res.status(400).json({
      message: "Invalid weight value. Must be between 0 and 500.",
    });
    return;
  }

  // Validate unit
  if (unit !== "kg" && unit !== "lbs") {
    res.status(400).json({
      message: 'Invalid unit. Must be "kg" or "lbs".',
    });
    return;
  }

  try {
    const supabase = getSupabaseClient();

    // If ImageBase64 is empty string, store as null
    const imageBase64ToSave =
      WeightImageBase64 && WeightImageBase64.trim() !== ""
        ? WeightImageBase64
        : null;

    // Parse optional metrics and convert to null if not provided or invalid
    const bmiValue = bmi && !isNaN(parseFloat(bmi)) ? parseFloat(bmi) : null;
    const bodyFatValue =
      bodyFat && !isNaN(parseFloat(bodyFat)) ? parseFloat(bodyFat) : null;
    const muscleMassValue =
      muscleMass && !isNaN(parseFloat(muscleMass))
        ? parseFloat(muscleMass)
        : null;

    // ⚖️ WEIGHT VALIDATION & AUTO-CORRECTION
    // Validate ALL weight changes (both new entries and edits)
    let finalWeight = weight;
    let correctionInfo = null;

    // Build query to get previous weight entry
    let query = supabase
      .from("weight_records_table")
      .select("ID, Weight, CreatedAt")
      .eq("UserId", parseInt(userId))
      .or('IsDeleted.is.null,IsDeleted.eq.0')
      .order("CreatedAt", { ascending: false });

    // If editing an existing entry, exclude it from comparison
    // Get the entry BEFORE the one being edited
    if (entryId) {
      query = query.neq('ID', entryId);
      console.log(`✏️ [Manual Edit] Validating weight change for entry ${entryId}, comparing against previous entry`);
    }

    const { data: lastWeightEntry } = await query.limit(1).maybeSingle();

    if (lastWeightEntry && lastWeightEntry.Weight) {
      // Validate and auto-correct weight
      const validation = validateAndCorrectWeight(
        weight,
        parseFloat(lastWeightEntry.Weight),
        lastWeightEntry.CreatedAt,
        unit
      );

      if (!validation.valid) {
        // Weight change is too large even after correction - reject
        console.log(`❌ [Weight Validation Failed] User ${userId}:`, {
          entryType: entryId ? 'Edit' : 'New',
          entryId: entryId || 'N/A',
          detectedWeight: weight,
          previousWeight: lastWeightEntry.Weight,
          correctedWeight: validation.finalWeight,
          wasCorrected: validation.wasCorrected,
          message: validation.message
        });

        return res.status(400).json({
          success: false,
          message: validation.message,
          validation: {
            previousWeight: parseFloat(lastWeightEntry.Weight),
            detectedWeight: weight,
            correctedWeight: validation.finalWeight,
            difference: validation.difference,
            hoursSinceLastEntry: validation.hoursSinceLastEntry,
            maxAllowed: validation.maxAllowed
          }
        });
      }

      // Use corrected weight for saving (only for AI uploads, not manual edits)
      // For manual edits, user explicitly chose this value, so don't auto-correct
      finalWeight = entryId ? weight : validation.finalWeight;

      if (validation.wasCorrected || validation.message) {
        correctionInfo = {
          originalWeight: validation.originalWeight,
          correctedWeight: validation.finalWeight,
          wasCorrected: validation.wasCorrected && !entryId, // Only mark as corrected for AI uploads
          message: validation.message,
          previousWeight: parseFloat(lastWeightEntry.Weight)
        };

        if (entryId) {
          console.log(`✅ [Manual Edit Validated] User ${userId}:`, {
            weight: finalWeight,
            previousWeight: lastWeightEntry.Weight,
            difference: validation.difference,
            message: validation.message
          });
        } else {
          console.log(`✅ [Weight Auto-Corrected] User ${userId}:`, correctionInfo);
        }
      } else {
        console.log(`✅ [Weight Validation Passed] User ${userId}:`, {
          entryType: entryId ? 'Edit' : 'New',
          weight: finalWeight,
          previousWeight: lastWeightEntry.Weight,
          difference: validation.difference
        });
      }
    } else if (entryId) {
      console.log(`⚠️ [Manual Edit] No previous weight found for comparison - allowing edit for user ${userId}`);
    }

    // 🔥 BMR PRESERVATION: Carry forward previous BMR if not explicitly provided
    let bmrValue = bmr && !isNaN(parseFloat(bmr)) ? parseFloat(bmr) : null;

    if (!bmrValue) {
      // No BMR provided - preserve from previous weight record if exists
      const { data: previousWeight } = await supabase
        .from("weight_records_table")
        .select("Bmr")
        .eq("UserId", parseInt(userId))
        .order("CreatedAt", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (previousWeight?.Bmr) {
        bmrValue = parseFloat(previousWeight.Bmr);
        console.log("🔄 [BMR] Preserved from previous record:", bmrValue);
      }
    } else {
      console.log("✏️ [BMR] Explicitly updated to:", bmrValue);
    }

    // Insert using Supabase (ID will be auto-generated by sequence)
    // Use exact PascalCase column names as they exist in Supabase
    // Store everything in IST (Indian Standard Time)
    const currentTime = getISTTimestamp(); // server insert time — used for UpdatedAt only

    // ─── Capture timestamp logic ─────────────────────────────────────────────
    // clientTimestamp = EXIF photo capture time (e.g. 3:30 AM) sent from the app.
    // We use it for CreatedAt so the discipline score sees the REAL capture time,
    // not the upload time (e.g. 10:00 AM).
    // This mirrors exactly how save-education-log.js works.
    let createdAtIST;
    if (clientTimestamp) {
      const istConversion = convertToIST(clientTimestamp);
      createdAtIST = istConversion.istTimestamp; // e.g. "2026-03-25 03:30:00"
      console.log("� Weight CreatedAt set to EXIF capture time (IST):", createdAtIST);
    } else {
      createdAtIST = currentTime; // fallback: server insert time
      console.log("⚠️ No clientTimestamp provided — using server time for CreatedAt:", createdAtIST);
    }

    // �🔍 DEBUG: Log weight upload details with client time comparison
    const clientLocalTime = clientTimestamp ? new Date(clientTimestamp) : null;
    console.log("⚖️ Weight Upload:", {
      userId,
      weightValue,
      entryId: entryId || 'new entry',
      clientUploaded: clientTimestamp || 'Not provided',
      createdAtIST,
      serverUTC: new Date().toISOString(),
      storedIST: currentTime,
      timeDifference: clientTimestamp
        ? `${Math.round((new Date() - clientLocalTime) / 1000)}s`
        : "N/A",
      note: "CreatedAt = EXIF capture time (IST); UpdatedAt = server insert time",
    });

    // Derive the calendar date for this entry from the capture time (not upload time).
    const entryDate = createdAtIST.substring(0, 10); // "YYYY-MM-DD"

    let data, error;
    let wasUpdated = false;

    if (entryId) {
      // ✏️ OVERWRITE: explicit edit by ID from dashboard/modal
      const updateFields = {
        Weight: finalWeight,
        UpdatedAt: currentTime
      };
      if (bmiValue !== null) updateFields.Bmi = bmiValue;
      if (bodyFatValue !== null) updateFields.BodyFat = bodyFatValue;
      if (muscleMassValue !== null) updateFields.MuscleMass = muscleMassValue;
      if (bmrValue !== null) updateFields.Bmr = bmrValue;
      if (imageBase64ToSave !== null) updateFields.WeightImageBase64 = imageBase64ToSave;

      ({ data, error } = await supabase
        .from('weight_records_table')
        .update(updateFields)
        .eq('ID', entryId)
        .eq('UserId', parseInt(userId))
        .or('IsDeleted.is.null,IsDeleted.eq.0')
        .select()
        .single());

      if (!data && !error) {
        return res.status(403).json({ success: false, message: 'Entry not found or unauthorized' });
      }
      wasUpdated = true;
    } else {
      // 🆕 ALWAYS INSERT NEW ENTRY: Each weight upload creates a new record
      // This allows multiple weight entries at different times using EXIF timestamps
      console.log(`🆕 [save-weight-entry] Inserting new entry for user ${userId} at ${createdAtIST}`);

      const insertPayload = {
        UserId: parseInt(userId),
        Weight: finalWeight,
        Bmi: bmiValue,
        BodyFat: bodyFatValue,
        MuscleMass: muscleMassValue,
        Bmr: bmrValue,
        WeightImageBase64: imageBase64ToSave,
        CreatedAt: createdAtIST, // EXIF capture time → discipline score uses this
        UpdatedAt: currentTime,  // Server insert time
      };

      ({ data, error } = await supabase
        .from('weight_records_table')
        .insert(insertPayload)
        .select()
        .single());

      console.log(`✅ [save-weight-entry] Inserted new entry with ID=${data?.ID}`);
    }
    
    if (error) throw error;

    // Get user email to clear profile cache
    const { data: user, error: userError } = await supabase
      .from("team_table")
      .select("Email")
      .eq("UserId", userId)
      .maybeSingle();

    if (!userError && user?.Email) {
      cache.delete(cacheKeys.userProfile(user.Email));
      console.log("🗑️ [save-weight-entry] Cache cleared for user:", user.Email);
    }

    res.status(200).json({
      success: true,
      id: data?.ID || data?.id,
      updated: wasUpdated,
      message: wasUpdated ? "Weight entry updated successfully" : 'Weight entry saved successfully',
      data: {
        userId,
        weightValue: finalWeight,
        unit,
        bmr: bmrValue,
        bmrPreserved: !bmr && bmrValue ? true : false,
        imageBase64: imageBase64ToSave,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("❌ Database save error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to save weight entry",
      error: error.message,
    });
  }
}
