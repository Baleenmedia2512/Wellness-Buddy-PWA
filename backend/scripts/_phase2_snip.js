// -- Phase 2: AI analysis runs asynchronously after persistence --
      void (async () => {
        const apiStart = Date.now();
        _ctLog(3, "orchestrate request started (background)", {
          apiStart,
          userId: resolvedUserIdForOrchestrate ?? null,
          captureId: captureShare.id,
        });

        let detectedType;
        try {
          detectedType = await orchestrateAnalyzeImage(fileForOrchestrate, {
            userId: resolvedUserIdForOrchestrate ?? null,
            captureId: String(captureShare.id),
            // Update the diary row badge ("1/3", "2/3", "3/3") before each attempt.
            onAttempt: ({ attempt, total }) => {
              markCaptureAnalyzing(captureShare.id, {
                ownerUserId: resolvedUserIdForOrchestrate ?? null,
                currentAttempt: attempt,
                totalAttempts: total,
              });
            },
          });
        } catch (orchErr) {
          console.error("[Background AI] orchestrate failed:", orchErr);
          updatePendingCaptureType(pendingSharePromise, "unknown");
          triggerNutritionRefresh({
            immediate: true,
            source: "capture-analysis-failed",
          });
          clearCaptureAnalyzing(captureShare.id);
          return;
        }
        debugLog(
        `?? [PERF] ? Orchestrate: ${Date.now() - apiStart}ms (+${
          Date.now() - perfStart
        }ms from capture start) ? type=${detectedType?.type}` +
        (detectedType?.traceId ? ` traceId=${detectedType.traceId}` : ''),
      );
      debugLog("[TRACE] orchestrate | stage=COMPLETE" +
        ` | captureId=${foodCaptureIdRef.current ?? 'pending'}` +
        ` | imageType=${detectedType.type}` +
        ` | confidence=${detectedType.confidence}` +
        ` | duration=${Date.now() - apiStart}ms` +
        (detectedType?.enrichmentJobId ? ` | enrichmentJobId=${detectedType.enrichmentJobId}` : ''),
      );

      // Stage 4 � orchestrate response received
      if (captureTraceRef.current) captureTraceRef.current.traceId = detectedType?.traceId ?? null;
      _ctLog(4, 'orchestrate response received', {
        latencyMs: Date.now() - apiStart,
        imageType: detectedType?.type,
        confidence: detectedType?.confidence,
        traceId: detectedType?.traceId ?? null,
        enrichmentJobId: detectedType?.enrichmentJobId ?? null,
        duplicate: detectedType?.duplicate ?? false,
        foodCount: detectedType?.details?.foods?.length ?? 0,
        defaulted: detectedType?.details?.defaulted ?? false,
      });
      // Stage 5 � detectedType result (type routing decision)
      _ctLog(5, 'detectedType routing', {
        routedTo: detectedType?.type === 'food' ? 'FOOD' : detectedType?.type === 'weight' ? 'WEIGHT' : detectedType?.type === 'education' ? 'EDUCATION' : detectedType?.type === 'smartwatch' ? 'SMARTWATCH' : 'OTHER',
        willEnterFoodBranch: detectedType?.type === 'food' && !( detectedType?.type === 'other' || (detectedType?.confidence < 0.6) ),
        hasFastNutrition: !!detectedType?.fastNutrition,
      });
      debugLog("?? [DEBUG] Image Type Detection Result:", {
        type: detectedType.type,
        confidence: detectedType.confidence,
        hasDetails: !!detectedType.details,
        hasFoods: detectedType.details?.foods?.length || 0,
        fullResponse: detectedType,
      });

      if (!bg && detectedType.type === "food") {
        pendingSharePromise.then((share) => {
          if (share) {
            foodCaptureIdRef.current = share.id;
            setFoodShareUrl(share.url);
          }
        });
      }

      if (
        !bg &&
        detectedType.details?.foods &&
        detectedType.details.foods.length > 0
      ) {
        const foodNames = detectedType.details.foods.map((f) => f.name);
        setDetectedFoodNames(foodNames);
      }

      // ? PRIORITY 0: Smartwatch / fitness app screenshot
      if (detectedType.type === "smartwatch" && detectedType.confidence > 0.5) {
        debugLog("? Smartwatch image detected.");
        let resolvedUserId = user?.id;
        if (!resolvedUserId) {
          try {
            resolvedUserId = await getUserId(user);
          } catch (err) {
            debugLog("[getUserId] failed, continuing with null userId", {
              err: err?.message,
            });
          }
        }
        let watchCaptureId = captureShare.id;
        if (bg) {
          try {
            if (resolvedUserId) {
              await saveWatchActivityLog({
                userId: resolvedUserId,
                imageBase64: processedImage,
                caloriesBurned: detectedType.details?.caloriesBurned || 0,
                source: detectedType.details?.source || "Smartwatch",
                captureId: watchCaptureId,
              });
              const burned = detectedType.details?.caloriesBurned || 0;
              if (burned > 0) setWatchBurnedCalories(burned);
            }
            updatePendingCaptureType(pendingSharePromise, "smartwatch");
            triggerNutritionRefresh({ immediate: true, source: "capture-smartwatch" });
          } catch (watchErr) {
            console.error("[Background AI] smartwatch save failed:", watchErr);
            updatePendingCaptureType(pendingSharePromise, "unknown");
            triggerNutritionRefresh({ immediate: true, source: "capture-smartwatch-failed" });
          }
          clearCaptureAnalyzing(captureShare.id);
          return;
        }
        // Resolve captureId before mounting WatchActivityCard so the education
        // log row links back to the captures row (same pattern as education branch).
        try {
          const capShare = await pendingSharePromise;
          if (capShare?.id) {
            watchCaptureId = capShare.id;
            if (!foodCaptureIdRef.current)
              foodCaptureIdRef.current = capShare.id;
          }
          const autoShareEnabled =
            localStorage.getItem("autoShareOnCapture") !== "false";
          if (autoShareEnabled && capShare?.url && !foodAutoSharedRef.current) {
            foodAutoSharedRef.current = true;
            shareTextViaWhatsApp(capShare.url).then((ok) => {
              _hasCompletedFirstShareRef.current = true;
              if (!ok) foodAutoSharedRef.current = false;
            });
          }
        } catch (_) {}
        setImageType("smartwatch");
        setWatchResult({
          caloriesBurned: detectedType.details?.caloriesBurned || 0,
          source: detectedType.details?.source || "Smartwatch",
          loggedAt: new Date().toISOString(),
          userId: resolvedUserId,
          captureId: watchCaptureId || undefined,
        });
        // Tag the pending capture as 'smartwatch' so it is excluded from the
        // nutrition dashboard (ImageType='food' filter) but the share link
        // still resolves and routes to the education tab.
        updatePendingCaptureType(pendingSharePromise, "smartwatch");
        setLoading(false);
        return;
      }

      // ? PRIORITY 1: Check for education meeting (AUTO-SAVE)
      if (detectedType.type === "education" && detectedType.confidence > 0.7) {
        debugLog("?? Education meeting detected, analyzing...");
        if (!bg) setImageType("education");

        try {
          const educationData = {
            success: true,
            platform: detectedType.details.platform || "Online Meeting",
            topic: "Education Meeting",
            confidence: detectedType.confidence || 0,
            participantCount: detectedType.details.participantCount || null,
          };

          if (educationData && educationData.success) {
            if (!bg) {
              setEducationResult({
                platform: educationData.platform,
                topic: educationData.topic,
                confidence: educationData.confidence,
                participantCount: educationData.participantCount,
                loggedAt: exifTimestamp || new Date().toISOString(),
              });
              setLoadingState("saving");
              setSaveLoading(true);
            }
            const educationCaptureId = captureShare.id;
            if (!foodCaptureIdRef.current)
              foodCaptureIdRef.current = educationCaptureId;
            await saveEducationLog(
              educationData,
              processedImage,
              null,
              exifTimestamp,
              educationCaptureId,
              { silent: true },
            );
            if (bg) {
              updatePendingCaptureType(pendingSharePromise, "education");
              triggerNutritionRefresh({ immediate: true, source: "capture-education" });
              clearCaptureAnalyzing(captureShare.id);
              return;
            }
          } else if (!bg) {
            setError("Unable to analyze meeting screenshot. Please try again.");
          }
        } catch (err) {
          console.error("? Education analysis failed:", err);
          if (bg) {
            updatePendingCaptureType(pendingSharePromise, "unknown");
            triggerNutritionRefresh({ immediate: true, source: "capture-education-failed" });
            clearCaptureAnalyzing(captureShare.id);
            return;
          }
          setError("Failed to analyze meeting screenshot: " + err.message);
        }

        updatePendingCaptureType(pendingSharePromise, "education");
        // Auto-share to WhatsApp immediately ? same as food flow.
        const autoShareEnabled1 =
          localStorage.getItem("autoShareOnCapture") !== "false";
        if (autoShareEnabled1) {
          pendingSharePromise.then((share) => {
            if (!share?.url || foodAutoSharedRef.current) return;
            foodAutoSharedRef.current = true;
            shareTextViaWhatsApp(share.url).then((ok) => {
              _hasCompletedFirstShareRef.current = true; // enable foreground-resume camera
              if (!ok) {
                foodAutoSharedRef.current = false;
              }
              // Keep analysis on screen ? do NOT resetCaptureUiOnly.
            });
          });
        }
        setLoading(false);
        return;
      }

      // ? PRIORITY 2: Check for weight scale
      if (detectedType.type === "weight" && detectedType.confidence > 0.6) {
        debugLog("?? Weight scale detected, extracting metrics...");
        if (!bg) setImageType("weight");

        let detectedWeight;

        if (detectedType.details?.weightValue) {
          debugLog("? Using weight data from unified detection");
          const rawBmr =
            detectedType.details?.bmr ??
            detectedType.details?.Bmr ??
            detectedType.details?.BMR ??
            null;
          let normalizedBmr = null;
          if (rawBmr !== undefined && rawBmr !== null) {
            const digits = String(rawBmr).replace(/[^0-9]/g, "");
            const parsed = digits ? parseInt(digits, 10) : NaN;
            normalizedBmr = !isNaN(parsed) && parsed > 0 ? parsed : null;
          }

          detectedWeight = {
            success: true,
            weightValue: detectedType.details.weightValue,
            unit: detectedType.details.unit || "kg",
            confidence: detectedType.confidence,
            bmi: detectedType.details.bmi,
            bodyFat: detectedType.details.bodyFat,
            muscleMass: detectedType.details.muscleMass,
            bmr: normalizedBmr,
          };
        } else if (bg) {
          updatePendingCaptureType(pendingSharePromise, "unknown");
          triggerNutritionRefresh({ immediate: true, source: "capture-weight-unclear" });
          clearCaptureAnalyzing(captureShare.id);
          return;
        } else {
          debugLog(
            "?? Weight value not detected in unified call, prompting retake",
          );
          setAlertModal({
            isOpen: true,
            title: "?? Image Not Clear Enough",
            message:
              "We couldn't read from your photo. Please make sure the scale display is clearly visible with good lighting, and retake the photo.",
            type: "error",
          });
          setCurrentWeightImage(null);
          setImagePreview(null);
          setLoading(false);
          return;
        }

        if (detectedWeight.success && detectedWeight.weightValue) {
          let weightToSave = { ...detectedWeight };
          if (detectedWeight.unit === "lbs") {
            weightToSave.weightValue = weightDetectionService.convertWeight(
              detectedWeight.weightValue,
              "lbs",
              "kg",
            );
            weightToSave.unit = "kg";
          }

          if (bg) {
            try {
              if (!foodCaptureIdRef.current)
                foodCaptureIdRef.current = captureShare.id;
              await saveWeightEntry(
                weightToSave,
                processedImage,
                exifTimestamp || null,
              );
              updatePendingCaptureType(pendingSharePromise, "weight");
              triggerNutritionRefresh({ immediate: true, source: "capture-weight" });
            } catch (weightSaveErr) {
              console.error("[Background AI] weight save failed:", weightSaveErr);
              updatePendingCaptureType(pendingSharePromise, "unknown");
              triggerNutritionRefresh({ immediate: true, source: "capture-weight-failed" });
            }
            clearCaptureAnalyzing(captureShare.id);
            return;
          }

          setWeightEntrySaved(false);
          setWeightDiff(null);
          setLoadingState("saving");
          setSaveLoading(true);

          setWeightResult({
            ...weightToSave,
            loggedAt: exifTimestamp || new Date().toISOString(),
          });

          // ??? FRONTEND PRE-VALIDATION: Check against previous weight for realistic changes
          try {
            const tempUserId = user?.id || (await getUserId(user));
            const prevWeightRes = await fetch(
              `${apiBaseUrl}/api/weight/history?userId=${tempUserId}&includeImage=false&_t=${Date.now()}`,
            );
            const prevWeightData = await prevWeightRes.json();

            if (
              prevWeightData.success &&
              prevWeightData.stats?.previousWeight
            ) {
              const previousWeight = parseFloat(
                prevWeightData.stats.previousWeight.value,
              );
              const previousDate = prevWeightData.stats.previousWeight.date;

              // Validate weight change
              const validation = weightDetectionService.validateWeightChange(
                weightToSave.weightValue,
                previousWeight,
                previousDate,
              );

              debugLog("?? Frontend weight validation:", validation);

              // If validation fails or shows major warning, don't save (backend will also validate)
              if (!validation.valid) {
                setSaveLoading(false);
                setLoading(false);

                // Just log and continue - backend will handle validation and show CustomAlertModal
                debugLog(
                  "?? Frontend detected unrealistic weight change, backend will validate",
                );
              } else if (
                validation.warning &&
                validation.difference &&
                Math.abs(validation.difference) > 1.5
              ) {
                // Show info message for moderate changes
                debugLog(`?? ${validation.message}`);
              }
            }
          } catch (validationError) {
            // Non-critical - continue with save even if validation fails
            console.warn(
              "?? Frontend validation check failed, proceeding with save:",
              validationError,
            );
          }

          // Wrap save in try-catch to handle backend validation failures
          try {
            // Resolve the captures row BEFORE saving so the weight row is
            // linked to its capture via CaptureID. Same rationale as education above.
            try {
              const capShare = await pendingSharePromise;
              if (capShare?.id && !foodCaptureIdRef.current) {
                foodCaptureIdRef.current = capShare.id;
              }
            } catch (_) {}
            // Pass EXIF capture timestamp so the weight is recorded at capture time, not upload time
            await saveWeightEntry(
              weightToSave,
              processedImage,
              exifTimestamp || null,
            );

            // ? Weight result already set before save, updated after if backend corrects it
            setWeightEntrySaved(true);

            // Fetch history ONLY for leaderboard inject � weightDiff is already set
            // correctly inside performWeightSave using data.previousWeightValue.
            // Do NOT call setWeightDiff here � EXIF timestamps cause wrong ordering.
            try {
              const diffUserId = user?.id || (await getUserId(user));
              const diffRes = await fetch(
                `${apiBaseUrl}/api/weight/history?userId=${diffUserId}&includeImage=false&_t=${Date.now()}`,
              );
              const diffData = await diffRes.json();
              if (diffData.success && diffData.stats?.weightChange) {
                const weightChange = parseFloat(diffData.stats.weightChange);
                // Compute ideal weight for the share card
                refreshIdealWeight();
                // ? Immediately inject into leaderboard strip � no API wait needed
                if (weightChange < 0 && leaderboardRef.current?.injectEntry) {
                  leaderboardRef.current.injectEntry({
                    userId: diffUserId,
                    userName: resolveShareDisplayName(
                      savedUserName,
                      user,
                      "You",
                    ),
                    email: user?.email || "",
                    weightLoss: Math.abs(weightChange),
                    profileImage: user?.photoURL || user?.ProfileImage || null,
                    coachName: "",
                  });
                }
              }
            } catch (_) {
              /* non-critical � share card just won't show diff */
            }
          } catch (saveError) {
            // Validation failed or other save error - don't show weight result
            debugLog(
              "? Weight save failed, weight not displayed:",
              saveError.message,
            );
            // Modal is already shown by performWeightSave, just stop here
            setLoading(false);
            return;
          }
          // Don't clear imagePreview or return - let it show like food images
        } else {
          // Weight detection failed ? prompt user to retake a clearer photo
          if (detectedWeight.lowConfidence) {
            debugLog(
              `?? Low confidence detection (${(
                detectedWeight.confidence * 100
              ).toFixed(0)}%), prompting retake`,
            );
          } else {
            debugLog("?? Weight detection failed, prompting retake");
          }
          setAlertModal({
            isOpen: true,
            title: "?? Please Take a Clearer Photo",
            message:
              "We couldn't read the weight from your image. Please ensure:\n� The scale display is fully visible\n� Good lighting (avoid shadows or glare)\n� Hold the camera steady directly above the scale",
            type: "error",
          });
          setCurrentWeightImage(null);
          setImagePreview(null);
          setLoading(false);
          return;
        }

        // Tag the pending capture as 'weight' so it is excluded from the
        // nutrition dashboard (ImageType='food' filter) but the share link
        // still resolves and routes to the weight dashboard tab.
        updatePendingCaptureType(pendingSharePromise, "weight");
        // Auto-share to WhatsApp immediately ? same as food flow.
        const autoShareEnabled2 =
          localStorage.getItem("autoShareOnCapture") !== "false";
        if (autoShareEnabled2) {
          pendingSharePromise.then((share) => {
            if (!share?.url || foodAutoSharedRef.current) return;
            foodAutoSharedRef.current = true;
            shareTextViaWhatsApp(share.url).then((ok) => {
              _hasCompletedFirstShareRef.current = true; // enable foreground-resume camera
              if (!ok) {
                foodAutoSharedRef.current = false;
              }
              // Keep analysis on screen ? do NOT resetCaptureUiOnly.
            });
          });
        }
        setLoading(false);
        return;
      }

      // PR 3 � Before defaulting to food, check whether the detector is
      // actually confident. `imageTypeDetector.detectImageType()` falls back
      // to `{ type: 'food' }` for unrecognised photos (phone, cat, blank
      // wall) and on Gemini errors (details.defaulted === true). Treating
      // those as food pollutes the nutrition feed with 0-kcal rows and
      // generates broken share links � the root bug PR 3 fixes.
      // Also handle explicit 'other' type returned when AI fails entirely.
      if (detectedType.type === "other" || isLowConfidenceFood(detectedType)) {
        debugLog(
          "? [Image Detection] Low-confidence � tagging as unknown",
          {
            confidence: detectedType?.confidence,
            defaulted: detectedType?.details?.defaulted,
            foodsLength: detectedType?.details?.foods?.length || 0,
            totalCalories: detectedType?.details?.total?.calories || 0,
          },
        );
        updatePendingCaptureType(pendingSharePromise, "unknown");
        triggerNutritionRefresh({ immediate: true, source: "capture-unknown" });
        if (bg) {
          clearCaptureAnalyzing(captureShare.id);
          // Brief toast so the user knows why the photo landed in Diary as
          // "Other" and what to do next — no modal, no blocking.
          if (detectedType?.details?.defaulted === true) {
            // All retries failed (timeout / API down)
            showToast("⚠️ AI timed out — find it in Diary to retry");
          } else if (detectedType?.type === "food") {
            // Gemini recognised food but couldn't identify the items
            showToast("🍽️ Food detected — tap in Diary to add details");
          }
          return;
        }
        const aiFailedEntirely = detectedType?.details?.defaulted === true;
        if (aiFailedEntirely) {
          setError(
            "AI couldn't analyse your photo right now. Please retry � if it keeps failing, try a clearer, well-lit photo.",
          );
        } else if (!isFlagEnabled("ff.diary-feed")) {
          setUnknownCaptureModal({ open: true, pendingSharePromise });
        } else {
          showToast("?? Couldn't identify � find it in Diary ? tap to fix");
          resetCaptureUiOnly();
        }
        setLoading(false);
        return;
      }

      // It's a food image - use nutrition data from unified detection
      if (!bg) {
        console.log("??? [Food Detection] Setting imageType to food");
        setImageType("food");
      }
      debugLog("??? [DEBUG] Processing as FOOD image");
      debugLog("??? [DEBUG] Food details check:", {
        hasDetails: !!detectedType.details,
        hasFoodsArray: !!detectedType.details?.foods,
        foodsLength: detectedType.details?.foods?.length || 0,
        foodsData: detectedType.details?.foods,
      });

      try {
        // Use nutrition data already extracted from unified detection (no second API call)
        let result;

        if (
          detectedType.details?.foods &&
          detectedType.details.foods.length > 0
        ) {
          debugLog("? Using nutrition data from unified detection");

          let foods = detectedType.details.foods;

          // ?? Update detected food names for display (home UI only � not in async capture flow)
          if (!bg) {
            const foodNames = foods.map((f) => f.name);
            setDetectedFoodNames(foodNames);
          }
          debugLog("??? [AI-DETECTED] Food names:", foods.map((f) => f.name).join(", "));

          // ?? CRITICAL: Preserve original AI-detected names BEFORE any corrections
          // This ensures we always know what the AI originally detected, even after auto-corrections
          foods = foods.map((food) => ({
            ...food,
            originalAiName: food.name, // Store the fresh AI detection
          }));
          debugLog(
            "? [PRESERVE] Original AI names saved:",
            foods.map((f) => `${f.name}`).join(", "),
          );

          // ?? APPLY USER'S PAST CORRECTIONS AUTOMATICALLY
          // debugLog("?? [CORRECTION] Starting auto-correction process...");
          // debugLog(
          //   "?? [CORRECTION] Foods before correction:",
          //   foods.map((f) => f.name),
          // );
          try {
            const userId = user?.id || (await getUserId(user));
            // debugLog("?? [CORRECTION] User ID for corrections:", userId);
            if (userId) {
              // ?? AUTO-CORRECTION DISABLED (product decision 2026-05-29)
              // const correctedFoods = await applyUserCorrections(foods, userId);
              // foods = correctedFoods;

              // ?? Capture ALL food detections for debug modal (corrections + no corrections)
              const newLogs = foods.map((food) => ({
                timestamp: new Date().toISOString(),
                aiDetected: food.originalAiName || food.name,
                userCorrected: food.name,
                finalDisplay: food.name,
                wasAutoCorrected: food.wasAutoCorrected || false,
                correctionSource: food.correctionSource || null,
                userCount: food.correctionMetadata?.userCount || 0,
                portion: food.portion || "N/A",
                calories: food.nutrition?.calories || 0,
              }));

              if (newLogs.length > 0) {
                setCorrectionLogs((prev) => [...newLogs, ...prev].slice(0, 50)); // Keep last 50 logs
                debugLog(
                  "?? [DEBUG-LOGS] Captured",
                  newLogs.length,
                  "food detection(s)",
                );
              }
            } else {
              console.warn(
                "?? [CORRECTION] No userId available, skipping corrections",
              );
            }
          } catch (error) {
            console.error(
              "? [CORRECTION] Failed to apply corrections:",
              error,
            );
            console.warn(
              "?? Failed to apply corrections, using original AI detection:",
              error,
            );
          }
          // debugLog(
          //   "?? [CORRECTION] Final foods to be used:",
          //   foods.map((f) => f.name),
          // );

          // ?? ALWAYS recalculate totals from corrected foods (don't use original AI total)
          // Original code used: detectedType.details.total || foods.reduce(...)
          // This caused bug where corrected food (317 cal) showed wrong total (300 cal from AI)
          // NOTE: sugar/sodium/cholesterol MUST be summed here as well � see
          // aggregateFoodTotals + transformAnalysisFormat regression tests.
          const total = aggregateFoodTotals(foods);

          debugLog("?? [App.js] Calculated total from corrected foods:", {
            totalCalories: total.calories,
            totalCarbs: total.carbs,
            totalProtein: total.protein,
            foodCount: foods.length,
          });

          // Generate category name from food items
          let categoryName = "";
          const count = foods.length;
          if (count === 0) {
            categoryName = "Unknown Food";
          } else if (count === 1) {
            categoryName = (foods[0]?.name || "Unknown Food").trim();
          } else if (count === 2) {
            const first = (foods[0]?.name || "Unknown Food").trim();
            const second = (foods[1]?.name || "another item").trim();
            categoryName = `${first} & ${second}`;
          } else {
            const first = (foods[0]?.name || "Unknown Food").trim();
            const others = count - 1;
            categoryName = `${first} + ${others} more`;
          }

          // Compute carb-weighted total Glycemic Index from foods. GI is
          // never a sum; if the AI returned a total it may still be null,
          // so we re-derive it here so the backend always saves a value.
          let _giCarbProduct = 0;
          let _giTotalCarbs = 0;
          foods.forEach((f) => {
            const fGI = f.nutrition?.glycemic_index ?? f.glycemic_index;
            const fCarbs = f.nutrition?.carbs ?? f.carbs ?? 0;
            if (fGI != null && fCarbs > 0) {
              _giCarbProduct += Number(fGI) * Number(fCarbs);
              _giTotalCarbs += Number(fCarbs);
            }
          });
          const computedTotalGI =
            _giTotalCarbs > 0
              ? Math.round(_giCarbProduct / _giTotalCarbs)
              : total.glycemic_index != null
              ? Math.round(total.glycemic_index)
              : null;

          // Keep in sync with NUTRITION_REQUIRED in geminiService.js. These 17
          // fields are populated by enrichMicronutrients(); without forwarding
          // them here they would be silently dropped before save.
          const MICRO_KEYS = [
            "vitamin_a",
            "vitamin_c",
            "vitamin_d",
            "vitamin_e",
            "vitamin_k",
            "vitamin_b1",
            "vitamin_b2",
            "vitamin_b3",
            "vitamin_b6",
            "vitamin_b9",
            "vitamin_b12",
            "calcium",
            "iron",
            "magnesium",
            "potassium",
            "zinc",
            "phosphorus",
          ];
          const pickMicros = (src) => {
            const o = {};
            for (const k of MICRO_KEYS) {
              const v = src?.[k];
              o[k] =
                typeof v === "number" && Number.isFinite(v)
                  ? Math.round(v * 100) / 100
                  : 0;
            }
            return o;
          };

          const preserveMacro = (v) =>
            typeof v === "number" && Number.isFinite(v) ? v : 0;
          const roundMacroInt = (v) =>
            typeof v === "number" && Number.isFinite(v) ? Math.round(v) : 0;

          // Transform to format expected by NutritionCard
          result = {
            nutrition: {
              calories: roundMacroInt(total.calories),
              protein: preserveMacro(total.protein),
              carbs: preserveMacro(total.carbs),
              fat: preserveMacro(total.fat),
              fiber: preserveMacro(total.fiber),
              // Persist the AI's invisible micronutrients so the backend
              // saves TotalSugar / TotalSodium / TotalCholesterol instead
              // of NULL. See aggregateFoodTotals + bug report.
              sugar: preserveMacro(total.sugar),
              sodium: roundMacroInt(total.sodium),
              cholesterol: roundMacroInt(total.cholesterol),
              // Carb-weighted Glycemic Index (intrinsic, never summed).
              glycemic_index: computedTotalGI,
              // 17 vitamins/minerals (from enrichMicronutrients + Gemini).
              ...pickMicros(total),
            },
            category: {
              name: categoryName,
            },
            source: "Google Gemini AI - Unified Analysis",
            isRealData: true,
            itemCount: foods.length,
            confidence:
              detectedType.confidence > 0.8
                ? "high"
                : detectedType.confidence > 0.5
                ? "medium"
                : "low",
            detailedItems: foods.map((food) => {
              const n = food.nutrition || food;
              // ?? Extract nutrition values from the corrected food object
              const nutritionValues = {
                calories: roundMacroInt(n.calories),
                protein: preserveMacro(n.protein),
                carbs: preserveMacro(n.carbs),
                fat: preserveMacro(n.fat),
                fiber: preserveMacro(n.fiber),
                // Carry sugar/sodium/cholesterol through to the save payload
                // so they reach food_nutrition_data_table instead of NULL.
                sugar: preserveMacro(n.sugar),
                sodium: roundMacroInt(n.sodium),
                cholesterol: roundMacroInt(n.cholesterol),
                // GI is intrinsic to the food (not summed); preserve as-is.
                glycemic_index:
                  (food.nutrition?.glycemic_index ?? food.glycemic_index) !=
                  null
                    ? Math.round(
                        food.nutrition?.glycemic_index ?? food.glycemic_index,
                      )
                    : null,
                // 17 vitamins/minerals carried through from enrichMicronutrients.
                ...pickMicros(food.nutrition || food),
              };

              debugLog(
                `?? [App.js] Mapping food "${food.name}" to detailedItem:`,
              );
              debugLog(
                `   From food object - Top-level: cal=${food.calories} carbs=${food.carbs} protein=${food.protein}`,
              );
              debugLog(
                `   From food object - Nested: cal=${food.nutrition?.calories} carbs=${food.nutrition?.carbs} protein=${food.nutrition?.protein}`,
              );
              debugLog(
                `   To detailedItem: cal=${nutritionValues.calories} carbs=${nutritionValues.carbs} protein=${nutritionValues.protein}`,
              );

              return {
                name: food.name,
                originalAiName: food.originalAiName, // ?? Preserve original AI detection
                wasAutoCorrected: food.wasAutoCorrected, // ?? Track if auto-corrected
                correctionSource: food.correctionSource, // ?? Track correction source
                correctionMetadata: food.correctionMetadata, // ?? Full correction metadata
                portionDescription: food.portion || "Unknown portion",
                weight_g:
                  typeof food.weight_g === "number" ? food.weight_g : null,
                volume_ml:
                  typeof food.volume_ml === "number" ? food.volume_ml : null,
                estimatedWeight: food.weight_g || food.volume_ml || "Unknown",
                unit: food.unit || (food.volume_ml ? "ml" : "g"),
                isLiquid: food.isLiquid || false,
                // Store nutrition values at TOP LEVEL (for backward compatibility)
                ...nutritionValues,
                // ALSO store in nutrition object (for NutritionCard's item.nutrition?.calories pattern)
                nutrition: nutritionValues,
              };
            }),
          };
        } else {
          // Fallback: No food data extracted, show specific actionable error
          console.error("? [DEBUG] No food data extracted from image");
          console.error("? [DEBUG] Detection details:", detectedType.details);
          console.error(
            "? [DEBUG] Full detectedType object:",
            JSON.stringify(detectedType, null, 2),
          );

          const errorDetails = detectedType.details?.error || "";
          const detectionReason = detectedType.details?.reason || "";
          let errorMessage = "";

          // 1. Check for API/Service errors (quota, timeout, rate limits)
          const isApiError =
            errorDetails &&
            (errorDetails.includes("quota") ||
              errorDetails.includes("API") ||
              errorDetails.includes("timeout") ||
              errorDetails.includes("429") ||
              errorDetails.includes("503") ||
              errorDetails.includes("overloaded") ||
              errorDetails.includes("rate limit"));

          // 2. Check for network errors
          const isNetworkError =
            errorDetails &&
            (errorDetails.includes("network") ||
              errorDetails.includes("Failed to fetch") ||
              errorDetails.toLowerCase().includes("load failed") ||
              errorDetails.includes("connection") ||
              errorDetails.toLowerCase().includes("internet"));

          // 3. Check if image is not food (weight scale, body, etc.)
          const isNonFoodImage =
            detectedType.type &&
            (detectedType.type === "weight_scale" ||
              detectedType.type === "body" ||
              detectedType.type === "not_food" ||
              detectionReason.toLowerCase().includes("scale") ||
              detectionReason.toLowerCase().includes("body") ||
              detectionReason.toLowerCase().includes("not food"));

          // 4. Image quality issues
          const isQualityIssue =
            detectionReason &&
            (detectionReason.toLowerCase().includes("blurry") ||
              detectionReason.toLowerCase().includes("unclear") ||
              detectionReason.toLowerCase().includes("dark") ||
              detectionReason.toLowerCase().includes("low quality") ||
              detectionReason.toLowerCase().includes("poor lighting") ||
              detectionReason.toLowerCase().includes("not clear") ||
              detectionReason.toLowerCase().includes("unreadable"));

          // Set appropriate error message
          if (isApiError) {
            errorMessage =
              "?? The AI model is temporarily unavailable. Please try again later.";
          } else if (isNetworkError) {
            errorMessage =
              "?? Please check your internet connection (WiFi or mobile data) and try again.";
          } else if (isQualityIssue) {
            errorMessage =
              "?? Please take a clearer photo with good lighting. Make sure the display is fully visible and the camera is held steady.";
          } else if (isNonFoodImage) {
            errorMessage =
              "?? Please take a photo of food, weight scale, or educational content.";
          } else {
            errorMessage =
              "? Could not detect the image. Please take a clear photo and try again.";
          }

          if (!bg) setError(errorMessage);
          if (bg) {
            updatePendingCaptureType(pendingSharePromise, "unknown");
            triggerNutritionRefresh({ immediate: true, source: "capture-food-failed" });
            clearCaptureAnalyzing(captureShare.id);
            // Gemini recognised food (confidence ≥ 0.65) but couldn’t itemise
            // it — tell the user so they know to tap and add manually.
            showToast("🍽️ Food detected — tap in Diary to add details");
            return;
          }
          setFoodShareUrl(null);
          setImageType(null);
          foodCaptureIdRef.current = null;
          pendingSharePromiseRef.current = null;
          setLoading(false);
          return;
        }

        if (!bg) {
          setNutritionData({
            ...result,
            loggedAt: exifTimestamp || new Date().toISOString(),
          });
          _ctLog(6, 'setNutritionData called', {
            calories: result?.nutrition?.calories ?? null,
            itemCount: result?.itemCount ?? null,
            confidence: result?.confidence ?? null,
            source: result?.source ?? null,
          });
          setLoading(false);
        }

        _ctLog(7, 'scheduleNutritionSaveInBackground starting', {
          hasUser: !!user,
          userId: user?.id ?? null,
          hasFile: !!file,
          hasProcessedImage: !!processedImage,
          silent: bg,
        });
        const _saveP = scheduleNutritionSaveInBackground({
          user,
          file,
          processedImage,
          analysisResult: result,
          exifTimestamp,
          captureId: captureShare.id,
          pendingSharePromise,
          silent: bg,
        });
        savePromiseRef.current = _saveP;
        _saveP.finally(() => {
          _ctLog(15, '_saveP.finally � savePromise settled', {
            isCurrentSave: savePromiseRef.current === _saveP,
            clearingRef: savePromiseRef.current === _saveP,
          });
          if (savePromiseRef.current === _saveP) savePromiseRef.current = null;
          if (bg) {
            clearCaptureAnalyzing(captureShare.id);
            triggerNutritionRefresh({ immediate: true, source: "capture-food-saved" });
          }
        });
      } catch (err) {
        if (!bg) {
          const friendlyMessage = getFriendlyErrorMessage(err);
          setError(friendlyMessage);
          console.error("? Gemini analysis error:", err);
        } else {
          console.error("[Background AI] food processing failed:", err);
          updatePendingCaptureType(pendingSharePromise, "unknown");
          triggerNutritionRefresh({ immediate: true, source: "capture-food-error" });
          clearCaptureAnalyzing(captureShare.id);
        }
      }
      })();