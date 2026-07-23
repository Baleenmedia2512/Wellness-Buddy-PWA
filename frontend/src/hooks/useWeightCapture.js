/**
 * hooks/useWeightCapture.js
 * Weight recording state + save pipeline extracted from App.js.
 * Extraction: 2026-07-16. Logic is byte-identical.
 */
import { useState, useRef, useCallback } from 'react';
import { getUserId } from '../shared/services/userIdentity';
import { resolveLocationFields } from '../shared/utils/resolveLocationFields';
import { duplicateDetectionService } from '../features/nutrition';
import { debugLog } from '../shared/utils/logger';
import { useWeightProgressCheck } from '../features/weight-progress-tips/hooks/useWeightProgressCheck';
import { isSameBusinessDay, DEFAULT_BUSINESS_TIMEZONE } from '../shared/utils/datetimeUtils';

export function useWeightCapture({
  user, apiBaseUrl, foodCaptureIdRef, captureLocationByIdRef,
  setAlertModal, setSaveLoading, setLoadingState,
  setBmrUpdateKey, handleLeaderboardRefresh, setError, refreshIdealWeight,
}) {
  // State (verbatim from App.js) ---
  const [weightResult, setWeightResult] = useState(null); // Store weight detection results
  const [savedWeightId, setSavedWeightId] = useState(null); // ID of the saved weight entry for editing
  // --- savedWeightIdRef ----------------------------------------------------
  // INTENTIONAL ref-mirror of `savedWeightId` state.
  //
  // Why both exist:
  //   - `savedWeightId` (state) drives JSX (e.g. enabling the inline-edit
  //     pencil button, conditional render of the edit overlay).
  //   - `savedWeightIdRef` (ref) is read inside async handlers that are
  //     created/closed-over BEFORE the state setter resolves ? specifically:
  //       ? performWeightSave    ? writes the new id (line ~1884)
  //       ? handleWeightEditSave ? reads the current id mid-flight (line ~1947)
  //                                so a user editing immediately after save
  //                                hits the right entryId without waiting
  //                                for React to re-render the handler.
  //       ? saveWeightEntry      ? updates id after a manual save (line ~1973)
  //   - Cleared together with state in showMainPage / showDashboardPage /
  //     handleSignOut so they cannot diverge across navigation.
  //
  // Stale-closure risk (documented, NOT fixed in hygiene phase):
  //   - The inline edit handler captures `weightResult` and `user` by closure
  //     but reads `savedWeightIdRef.current` directly. If a second weight
  //     save lands between two clicks of the edit button, the edit can race
  //     onto the *new* entry id while the user thinks they are editing the
  //     prior result. This is currently masked by the UI clearing the result
  //     card on save, so practically unreachable. To eliminate fully, a
  //     state-machine extraction of weight-save (later phase) should pair
  //     `entryId` with the result object instead of using a sibling ref.
  const savedWeightIdRef = useRef(null);
  const [isEditingWeight, setIsEditingWeight] = useState(false); // Inline edit mode
  const [editWeightValue, setEditWeightValue] = useState(""); // Value being edited
  const [isSavingWeightEdit, setIsSavingWeightEdit] = useState(false); // Loading for edit save
  const [weightEditError, setWeightEditError] = useState(""); // Edit validation error
  const [pendingWeightImage, setPendingWeightImage] = useState(null); // Image waiting to be saved
  const [weightEntrySaved, setWeightEntrySaved] = useState(false); // Whether entry was saved to DB
  const [weightDiff, setWeightDiff] = useState(null); // { previous: number, change: number, date: string } | null
  const [showWeightCelebration, setShowWeightCelebration] = useState(false); // Weight loss celebration
  const [weightCelebrationMessage, setWeightCelebrationMessage] = useState(""); // Celebration message

  // Weight Progress Tips feature (reverse progress detection)
  const weightProgressCheck = useWeightProgressCheck();
  const [showWeightProgressModal, setShowWeightProgressModal] = useState(false);

  const [showDuplicateWeightModal, setShowDuplicateWeightModal] =
    useState(false);
  const [duplicateWeightInfo, setDuplicateWeightInfo] = useState(null);
  const [pendingWeightSaveData, setPendingWeightSaveData] = useState(null);
  const [lastWeight, setLastWeight] = useState(null); // Last recorded weight for reference

  const clearWeightState = useCallback(() => {
    setWeightResult(null);
    setPendingWeightImage(null);
    setWeightEntrySaved(false);
    setSavedWeightId(null);
    savedWeightIdRef.current = null;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Functions (verbatim from App.js) ---

  const triggerReverseProgressModal = async (userId, weightId) => {
    if (!userId || !weightId) return;
    try {
      console.log(
        "?? [triggerReverseProgressModal] Checking progress for userId:",
        userId,
        "weightId:",
        weightId,
      );
      const result = await weightProgressCheck.checkProgress(userId, weightId);
      console.log("?? [triggerReverseProgressModal] Result:", result);
      if (result?.shouldShow) {
        console.log("? [triggerReverseProgressModal] Showing modal");
        setShowWeightProgressModal(true);
      }
    } catch (err) {
      console.error("? Error checking weight progress:", err);
    }
  };

  /**
   * Perform actual weight save to database (called after duplicate check)
   */
  const performWeightSave = async (
    weightData,
    imageBase64,
    cachedUserId = null,
    captureTimestamp = null,
  ) => {
    console.log("?? [performWeightSave] FUNCTION CALLED with:", {
      weightValue: weightData.weightValue,
      unit: weightData.unit,
      hasCachedUserId: !!cachedUserId,
      hasCaptureTimestamp: !!captureTimestamp,
    });

    try {
      // Use cached userId if provided, otherwise get it
      let userId = cachedUserId || user?.id;
      console.log("?? [performWeightSave] Step 1: Getting userId...", {
        cachedUserId,
        hasUser: !!user,
      });

      if (!userId) {
        userId = await getUserId(user);
        console.log("?? [performWeightSave] userId fetched:", userId);
      }

      if (!userId) {
        throw new Error("User not authenticated or not found in database");
      }

      console.log("?? [performWeightSave] Step 2: Building payload...");

      const payload = {
        userId,
        weightValue: weightData.weightValue,
        unit: weightData.unit,
        bmi: weightData.bmi,
        bodyFat: weightData.bodyFat,
        muscleMass: weightData.muscleMass,
        bmr: weightData.bmr,
        imageBase64ToSave: imageBase64,
        // Use EXIF capture timestamp if available ? otherwise fall back to upload time
        clientTimestamp: captureTimestamp || new Date().toISOString(),
        clientTimezoneOffset: new Date().getTimezoneOffset(),
        // PR 6 � link the weight record to its captures_table row so the backend
        // can promote the capture pending ? weight in the same request.
        // `share.id` now semantically IS the CaptureID (the speculative food-row
        // pre-insert was removed). Undefined when no share was created (e.g. the
        // background-analysis worker bypassed share creation).
        captureId: foodCaptureIdRef.current || undefined,
      };

      console.log("?? [performWeightSave] Step 3: Capturing GPS location...");

      const captureIdForLoc = foodCaptureIdRef.current
        ? String(foodCaptureIdRef.current)
        : null;
      const stashedLocation = captureIdForLoc && captureLocationByIdRef?.current
        ? captureLocationByIdRef.current.get(captureIdForLoc)
        : null;
      let locationFields = stashedLocation ? { ...stashedLocation } : {};
      let gpsDenied = false;
      if (!locationFields.latitude || !locationFields.longitude) {
        const resolved = await resolveLocationFields(apiBaseUrl, userId);
        const { permissionDenied, ...fields } = resolved;
        gpsDenied = !!permissionDenied;
        locationFields = { ...locationFields, ...fields };
      }
      if (gpsDenied) {
        setAlertModal({
          isOpen: true,
          title: "Location Permission Required",
          message:
            "To track your attendance at nutrition clubs, please enable location permissions in your device settings. Without location access, your attendance will be marked as Remote.",
          type: "warning",
        });
      }
      Object.assign(payload, locationFields);
      if (captureIdForLoc && captureLocationByIdRef?.current) {
        captureLocationByIdRef.current.delete(captureIdForLoc);
      }

      console.log(
        "?? [performWeightSave] GPS location captured, payload ready",
      );

      // ? REMOVED: Don't reuse weight entry IDs - always create new records
      // This allows multiple weight entries per day with different timestamps
      // if (savedWeightIdRef.current) {
      //   payload.entryId = savedWeightIdRef.current;
      //   debugLog("?? Reusing existing weight entry ID:", savedWeightIdRef.current);
      // }

      // debugLog('?? Saving weight entry...', { weightValue: weightData.weightValue, unit: weightData.unit });

      console.log(
        "?? [performWeightSave] Step 4: Calling API /api/weight/save...",
      );

      const response = await fetch(`${apiBaseUrl}/api/weight/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      console.log("?? [performWeightSave] API response received:", {
        ok: response.ok,
        status: response.status,
        success: data.success,
        hasData: !!data.data,
        hasCorrection: !!data.correction,
      });

      if (!response.ok || !data.success) {
        debugLog("? Weight save failed:", {
          status: response.status,
          validation: data.validation,
          message: data.message,
        });

        // Even though weight was rejected, BMR may have been saved by the backend.
        // Trigger NutritionDashboard re-fetch so the new BMR is reflected immediately.
        if (data.bmrSaved || data.data?.bmr) {
          debugLog(
            "?? [BMR] Weight rejected but BMR was saved � triggering re-fetch:",
            data.data?.bmr,
          );
          setBmrUpdateKey((prev) => prev + 1);
        }

        // Distinguish a server/infrastructure failure (5xx) from a business validation
        // failure (400/422). Showing "Unrealistic Weight Change" for a DB outage is
        // misleading and confusing for the user.
        if (response.status >= 500) {
          setAlertModal({
            isOpen: true,
            title: "?? Couldn't Save Your Weight",
            message:
              "We couldn't save your weight entry right now. Please try again in a moment.",
            type: "error",
          });
        } else {
          // Validation failure � build a friendly, supportive message
          let alertMessage = `We noticed a significant change from your last weigh-in.`;
          if (data.validation && data.message) {
            const detail =
              data.message.charAt(0).toUpperCase() + data.message.slice(1);
            alertMessage = detail;
          }
          setAlertModal({
            isOpen: true,
            title: "?? Unrealistic Weight Change",
            message: alertMessage,
            type: "warning",
          });
        }

        // Clear loading states
        setSaveLoading(false);
        setLoadingState("idle");

        // Throw so the caller knows the save failed
        throw new Error(data.message || "Weight save failed");
      }

      debugLog("? Weight entry saved successfully");

      // ? Update weight result with final saved weight (may be corrected by backend)
      // Use data.data.weightValue which backend ALWAYS returns as the final saved weight
      const finalSavedWeight =
        data.data?.weightValue ||
        data.correction?.correctedWeight ||
        weightData.weightValue;
      const corrInfo = data.correction || null;
      console.log("?? [DEBUG] Updating weightResult with final saved weight:", {
        finalSavedWeight,
        wasCorrected: !!corrInfo?.wasCorrected,
        corrInfo,
      });

      // Update weightResult with final backend value (overwrites the pre-save value set earlier)
      setWeightResult((prev) => ({
        ...prev,
        weightValue: finalSavedWeight,
        originalWeight: corrInfo?.originalWeight || weightData.weightValue,
        loggedAt: captureTimestamp || new Date().toISOString(),
      }));

      // Fetch previous weight to show "vs Previous entry" diff immediately
      try {
        const histRes = await fetch(
          `${apiBaseUrl}/api/weight/history?userId=${userId}&includeImage=false&_t=${Date.now()}`,
        );
        const histData = await histRes.json();
        console.log("?? [celebration] Weight history data:", {
          success: histData.success,
          hasPrevious: !!histData.stats?.previousWeight,
          previousWeight: histData.stats?.previousWeight?.value,
          latestWeight: histData.stats?.latestWeight?.value,
          finalSavedWeight,
        });

        if (histData.success && histData.stats?.previousWeight) {
          const prevWeight = parseFloat(histData.stats.previousWeight.value);
          const weightChange = parseFloat(finalSavedWeight) - prevWeight;
          const latestDate = histData.stats.latestWeight?.date;
          const prevDate = histData.stats.previousWeight.date;
          const isDifferentDay =
            latestDate &&
            prevDate &&
            !isSameBusinessDay(latestDate, prevDate, DEFAULT_BUSINESS_TIMEZONE);

          console.log("?? [celebration] Weight comparison:", {
            prevWeight,
            finalSavedWeight,
            weightChange,
            isDifferentDay,
            latestDate,
            prevDate,
          });

          // Safety guard: only show diff if previous entry is from a different business calendar date
          if (isDifferentDay) {
            setWeightDiff({
              previous: Math.round(prevWeight * 100) / 100,
              previousDate: prevDate,
              change: Math.round(weightChange * 100) / 100,
            });
          } else {
            setWeightDiff(null);
          }

          // ?? Trigger celebration if weight loss detected (at least 0.1 kg)
          // CELEBRATION TRIGGERS REGARDLESS OF DATE - we celebrate ANY progress!
          if (weightChange < -0.1) {
            const lossAmount = Math.abs(weightChange).toFixed(1);
            setWeightCelebrationMessage(
              `You lost ${lossAmount} kg! Keep it up! ??`,
            );
            setShowWeightCelebration(true);
            console.log(
              "?? [celebration] TRIGGERING celebration! Weight loss:",
              lossAmount,
              "kg",
            );
            debugLog(
              "?? [celebration] Weight loss detected, triggering celebration:",
              lossAmount,
            );
          } else {
            console.log(
              "?? [celebration] No celebration - weight change:",
              weightChange,
              "kg (need < -0.1)",
            );
          }
        } else {
          console.log(
            "?? [celebration] No celebration - no previous weight found",
          );
          setWeightDiff(null);
        }
      } catch (histErr) {
        console.error(
          "? [celebration] Failed to fetch weight history:",
          histErr,
        );
        /* non-critical */
      }

      // Fetch user height ? compute ideal weight for the share card
      refreshIdealWeight();

      // Check if weight was auto-corrected
      if (corrInfo && corrInfo.wasCorrected) {
        // Show custom alert modal about auto-correction with user-friendly message
        setTimeout(() => {
          setAlertModal({
            isOpen: true,
            title: "? Weight Adjusted",
            message: `We noticed the scale showed ${corrInfo.originalWeight} kg, but based on your recent weight of ${corrInfo.previousWeight} kg, we adjusted it to ${corrInfo.correctedWeight} kg.\n\nThis helps keep your progress accurate!`,
            type: "info",
          });
        }, 500);

        debugLog("?? Weight auto-corrected:", corrInfo);
      } else if (corrInfo && corrInfo.message) {
        // Weight changed significantly but within limits � only surface if notable
        const change = Math.abs(corrInfo.difference || 0);
        if (change > 1.5) {
          setTimeout(() => {
            setAlertModal({
              isOpen: true,
              title: "?? Weight Updated",
              message: `Your weight changed by ${change.toFixed(
                1,
              )} kg. Keep up the great work!`,
              type: "info",
            });
          }, 500);
        }
      }

      // Store the saved entry ID for potential editing
      if (data?.id) {
        setSavedWeightId(data.id);
        savedWeightIdRef.current = data.id;
      }

      // BMR synced to team_table by the backend (calculated or preserved)
      const savedBmr = data.data?.bmr;
      if (savedBmr) {
        setBmrUpdateKey((prev) => prev + 1);
        debugLog(
          "?? [BMR] BMR saved with weight entry, forcing NutritionDashboard re-fetch:",
          savedBmr,
        );
      }

      // Hide saving overlay
      setSaveLoading(false);
      setLoadingState("idle");

      // Show success popup (similar to nutrition save)
      setError(null);

      // Background refresh to pick up other users' data from server
      setTimeout(() => {
        handleLeaderboardRefresh();
      }, 3000);

      const savedId = savedWeightIdRef.current || data?.id || null;
      await triggerReverseProgressModal(userId, savedId);

      // Keep imagePreview and selectedImage visible (like food images)
      // Don't reset them here
    } catch (err) {
      console.error("? Save weight error:", err);
      setSaveLoading(false);
      setLoadingState("idle");

      // Weight validation errors are already shown via alertModal ? don't show the red error card
      if (
        !err.message?.toLowerCase().includes("weight validation") &&
        !err.message?.toLowerCase().includes("unrealistic weight")
      ) {
        setError(err.message || "Failed to save weight entry");
      }
      throw err;
    }
  };

  /**
   * Save weight entry to database with duplicate check
   */
  /**
   * UPDATE the already-saved weight entry with the edited value.
   * Only called after the initial auto-save has completed (savedWeightId is set).
   */
  const handleWeightEditSave = async () => {
    const val = parseFloat(editWeightValue);
    if (isNaN(val) || val < 20 || val > 300) {
      setWeightEditError("Weight must be between 20 and 300 kg");
      return;
    }
    setIsSavingWeightEdit(true);
    setWeightEditError("");
    try {
      let userId = user?.id;
      if (!userId) userId = await getUserId(user);

      // Build payload ? include entryId to update the specific weight entry.
      // If no entryId, backend will create a new entry instead of updating.
      const payload = {
        userId,
        weightValue: val,
        unit: weightResult?.unit || "kg",
      };
      const currentEntryId = savedWeightIdRef.current;
      if (currentEntryId) payload.entryId = currentEntryId;

      const response = await fetch(`${apiBaseUrl}/api/weight/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        // Show the same friendly alert modal as photo upload validation
        if (result.validation) {
          setIsEditingWeight(false);
          setAlertModal({
            isOpen: true,
            title: "?? Unrealistic Weight Change",
            message: result.message
              ? result.message.charAt(0).toUpperCase() + result.message.slice(1)
              : `We noticed a significant change from your last weigh-in.`,
            type: "warning",
          });
        }
        throw new Error(result.message || "Failed to update");
      }

      // Keep the ref in sync with whichever row was actually updated
      if (result?.id) {
        setSavedWeightId(result.id);
        savedWeightIdRef.current = result.id;
      }

      setWeightResult((prev) => ({ ...prev, weightValue: val }));
      setIsEditingWeight(false);
      // Refresh diff after manual edit
      try {
        let diffUserId = user?.id || (await getUserId(user));
        const diffRes = await fetch(
          `${apiBaseUrl}/api/weight/history?userId=${diffUserId}&includeImage=false&_t=${Date.now()}`,
        );
        const diffData = await diffRes.json();
        if (diffData.success && diffData.stats?.previousWeight) {
          const prevWeight = parseFloat(diffData.stats.previousWeight.value);
          const weightChange = val - prevWeight;
          // Always compare against the immediately previous entry � same day is fine
          setWeightDiff({
            previous: Math.round(prevWeight * 100) / 100,
            previousDate: diffData.stats.previousWeight.date,
            change: Math.round(weightChange * 100) / 100,
          });
        }
      } catch (_) {
        /* non-critical */
      }
      // Refresh ideal weight in case the user updated their height in profile
      refreshIdealWeight();

      // ? Check for reverse weight progress after an edit-save too
      const editWeightId = savedWeightIdRef.current || result?.id || null;
      await triggerReverseProgressModal(userId, editWeightId);
    } catch (err) {
      setWeightEditError(err.message || "Failed to save");
    } finally {
      setIsSavingWeightEdit(false);
    }
  };

  const saveWeightEntry = async (
    weightData,
    imageBase64,
    captureTimestamp = null,
  ) => {
    try {
      // Get the actual database UserId from team_table
      let userId = user?.id;
      if (!userId) {
        userId = await getUserId(user);
      }

      if (!userId) {
        throw new Error("User not authenticated or not found in database");
      }

      // Check for duplicate weight before saving (fail-safe: proceed if check fails)
      try {
        const duplicateCheck =
          await duplicateDetectionService.checkForDuplicateWeight({
            userId: userId,
            weightValue: weightData.weightValue,
            unit: weightData.unit || "kg",
          });

        if (false && duplicateCheck.isDuplicate) {
          // Found duplicate - hide saving overlay and show confirmation modal
          // debugLog('?? Duplicate weight detected:', duplicateCheck);
          setSaveLoading(false); // Hide saving overlay while showing duplicate modal
          setLoadingState("idle");
          setDuplicateWeightInfo(duplicateCheck);
          setPendingWeightSaveData({
            weightData: weightData,
            imageBase64: imageBase64,
            userId: userId, // Cache userId for later use
            captureTimestamp: captureTimestamp, // Preserve EXIF timestamp through duplicate flow
          });
          setShowDuplicateWeightModal(true);
          return; // Stop here to wait for user confirmation
        }
      } catch (duplicateCheckErr) {
        // If duplicate check fails, log it but continue with save (fail-open)
        console.warn(
          "?? Duplicate check failed, proceeding with save:",
          duplicateCheckErr,
        );
      }

      // No duplicate or duplicate check failed - proceed with save (pass cached userId)
      await performWeightSave(
        weightData,
        imageBase64,
        userId,
        captureTimestamp,
      );
    } catch (err) {
      console.error("? Save weight error:", err);
      // Weight validation errors are already shown via alertModal � don't show the red error card
      if (
        !err.message?.toLowerCase().includes("weight validation") &&
        !err.message?.toLowerCase().includes("unrealistic weight")
      ) {
        const rawMsg = err.message || "";
        const isNetworkErr =
          rawMsg.toLowerCase().includes("load failed") ||
          rawMsg.includes("Failed to fetch") ||
          rawMsg.includes("network") ||
          rawMsg.includes("connection");
        setError(
          isNetworkErr
            ? "?? Please check your internet connection (WiFi or mobile data) and try again."
            : rawMsg || "Failed to save weight entry",
        );
      }
      throw err;
    }
  };

  const fetchLastWeight = async () => {
    try {
      let uid = user?.id;
      if (!uid) uid = await getUserId(user);
      if (!uid) return;
      const res = await fetch(
        `${apiBaseUrl}/api/weight/history?userId=${uid}&includeImage=false&_t=${Date.now()}`,
      );
      const data = await res.json();
      if (data.success && data.stats?.latestWeight) {
        setLastWeight({
          value: data.stats.latestWeight.value,
          unit: "kg",
          date: data.stats.latestWeight.date,
        });
      }
    } catch {
      /* non-critical */
    }
  };

  return {
    weightResult, setWeightResult,
    savedWeightId, setSavedWeightId, savedWeightIdRef,
    weightDiff, setWeightDiff,
    showWeightCelebration, setShowWeightCelebration, weightCelebrationMessage,
    weightEntrySaved, setWeightEntrySaved,
    pendingWeightImage, setPendingWeightImage,
    showWeightProgressModal, setShowWeightProgressModal,
    weightProgressCheck,
    lastWeight,
    isEditingWeight, setIsEditingWeight,
    editWeightValue, setEditWeightValue,
    isSavingWeightEdit, weightEditError,
    showDuplicateWeightModal, setShowDuplicateWeightModal,
    duplicateWeightInfo, setDuplicateWeightInfo,
    pendingWeightSaveData, setPendingWeightSaveData,
    saveWeightEntry, performWeightSave, handleWeightEditSave, fetchLastWeight,
    clearWeightState,
  };
}
