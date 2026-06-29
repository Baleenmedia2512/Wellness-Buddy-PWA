
            }
          },
        );
        if (cancelled) {
          appStateHandle?.remove?.();
          appStateHandle = null;
          return;
        }

        const { GalleryMonitorPlugin } = await import(
          "./shared/plugins/galleryMonitorPlugin"
        );
        notificationHandle = await GalleryMonitorPlugin.addListener(
          "notificationClicked",
          (data) => {
            if (data && data.action === "openBackgroundHistory") {
              showDashboardPage();
            }
          },
        );
        if (cancelled) {
          notificationHandle?.remove?.();
          notificationHandle = null;
        }
      } catch (err) {
        console.warn(
          "[App] gallery monitoring init failed:",
          err?.message || err,
        );
      }
    };

    init();

    return () => {
      cancelled = true;
      // Only remove the listeners we registered ? do NOT call
      // App.removeAllListeners(), which would also kill the foreground
      // profile-check listener registered in the effect below.
      try {
        appStateHandle?.remove?.();
      } catch {
        /* ignore */
      }
      try {
        notificationHandle?.remove?.();
      } catch {
        /* ignore */
      }
    };
  }, [showDashboardPage]);

  // Handle redirect result on app load
  useEffect(() => {
    const checkRedirectResult = async () => {
      try {
        const resultUser = await handleRedirectResult();
        if (resultUser) {
          // Get the database UserId for the user
          const dbUserId = await getUserId(resultUser);
          if (dbUserId) {
            resultUser.id = dbUserId;
            Session.setDbUserId(dbUserId);
            debugLog(
              "? [Redirect] Attached database UserId to user object:",
              resultUser.id,
            );
          }
          setUser(resultUser);
          setAuthLoading(false);
        }
      } catch (error) {
        console.error("? Redirect result error:", error);
        setError("Authentication failed. Please try again.");
        setAuthLoading(false);
      }
    };
    checkRedirectResult();
  }, []);

  // -- Profile completion check ----------------------------------------------
  // Fetches the user profile and shows the blocking CompleteProfilePage if any
  // mandatory field (height, dietType) is missing.
  const checkProfileCompletion = useCallback(
    // silent:true suppresses the profileChecking gate (Gate 3) so the app
    // never shows the loading spinner when the check runs in the background
    // (e.g. OTP cache-restore validation on startup).
    async (userEmail, userObj, { afterSave = false, silent = false } = {}) => {
      if (!userEmail) return;
      if (!silent) setProfileChecking(true);

      const result = await fetchProfileCompletion({
        apiBaseUrl,
        email: userEmail,
        afterSave,
      });

      // Phase 3d-a: Observe in shadow FSM (no behaviour change).
      authFsm.send({
        type: authFsm.E.PROFILE_CHECK_COMPLETED,
        status: result.status,
        snooze: result.snooze,
        missingFields: result.missingFields,
      });

      if (result.status === "complete") {
        profileCompletedRef.current = true;
        if (!silent) setProfileChecking(false);
        setShowCompleteProfile(false);
        // Profile fields complete � check picture gate separately
        if (userObj) setTimeout(() => checkProfilePicture(userObj), 400);
        // Force goal mode setup if user has never set it
        if (
          result.data?.weightGoalMode === null ||
          result.data?.weightGoalMode === undefined
        ) {
          setGoalModePromptEmail(userEmail);
          setShowGoalModePrompt(true);
        }
        return;
      }

      if (result.status === "incomplete") {
        debugLog(
          "?? [Profile] Mandatory fields missing ? showing CompleteProfilePage",
          result.missingFields,
        );
        setProfilePicSnoozeData(result.snooze || null);
        if (!silent) setProfileChecking(false);
        setShowCompleteProfile(true);
        return;
      }

      // result.status === 'error' ? fail-soft, no gate flash
      if (!silent) setProfileChecking(false);
      console.warn(
        "?? [Profile] Failed to check profile completion:",
        result.error,
      );
    },
    [apiBaseUrl],
  );
  // -------------------------------------------------------------------------

  // -- Profile Picture Validation ------------------------------------------
  // Checks if user has a valid profile picture (not a letter avatar)
  const checkProfilePicture = useCallback(
    async (user) => {
      if (!user) return;

      const userEmail = user.email || user.Email;
      if (!userEmail) return;

      debugLog("??? [Profile Picture] Checking for valid profile picture...");

      const result = await fetchProfilePicture({
        apiBaseUrl,
        email: userEmail,
      });

      // Phase 3d-a: Observe in shadow FSM (no behaviour change).
      authFsm.send({
        type: authFsm.E.PROFILE_PICTURE_CHECK_COMPLETED,
        status: result.status,
        source: result.source,
        snooze: result.snooze,
      });

      if (result.status === "valid") {
        if (result.source === "custom") {
          debugLog(
            "? [Profile Picture] User has custom uploaded profile picture",
          );
        } else {
          debugLog(
            "? [Profile Picture] User has Google profile picture:",
            (result.profileImage || "").substring(0, 50) + "...",
          );
        }
        return;
      }

      if (result.status === "snoozed") {
        const snoozeUntil = new Date(result.snooze.until).getTime();
        debugLog(
          "? [Profile Picture] Snoozed (DB) until",
          new Date(snoozeUntil).toLocaleString(),
        );
        return;
      }

      if (result.status === "missing") {
        // Store snooze data in state so modal can use count/max
        setProfilePicSnoozeData(result.snooze || null);
        debugLog(
          "?? [Profile Picture] No valid profile picture found, showing mandatory upload modal",
        );
        setShowMandatoryProfilePictureModal(true);
        return;
      }

      // result.status === "error" ? don't block the user
      if (result.error) {
        console.error("? [Profile Picture] Check failed:", result.error);
      } else {
        console.warn("?? [Profile Picture] Failed to fetch profile");
      }
    },
    [apiBaseUrl],
  );
  // -------------------------------------------------------------------------

  // Phase 3d-a: Keep the legacy snapshot ref fresh so the FSM shadow bridge
  // can compare against current React state on every event. This effect runs
  // on every render ? intentional. The body is a single ref assignment, so
  // the cost is negligible. The FSM consumes this via `getLegacySnapshot`.
  useEffect(() => {
    authFsmLegacyRef.current = {
      user: !!user,
      isUserActive,
      showInactiveModal,
      isInactiveReactivationFlow,
      showUserNotFoundModal,
      showSetupWizard,
      showValidateOTP,
      showCompleteProfile,
      showMandatoryProfilePictureModal,
      forceLoggedOut,
      signOutInProgress: signOutInProgress.current,
      accountDeleted: Session.isAccountDeleted(),
      signedOut: Session.isUserSignedOut(),
    };
  });

  // Phase 3d-a: Start the auth FSM in shadow mode exactly once. No-op when
  // disabled. Sends BOOT + RESTORE_SESSION so the FSM has the same starting
  // context as the legacy boot path.
  useEffect(() => {
    if (authFsmStartedRef.current) return;
    authFsmStartedRef.current = true;
    try {
      const platform =
        (typeof Capacitor !== "undefined" &&
          Capacitor.getPlatform &&
          Capacitor.getPlatform()) ||
        "web";
      const started = authFsm.startShadow({
        apiBaseUrl,
        platform,
        getLegacySnapshot: () => authFsmLegacyRef.current,
      });
      if (started) {
        authFsm.send({
          type: authFsm.E.RESTORE_SESSION,
          cachedEmail: Session.getUserEmail(),
          accountDeleted: Session.isAccountDeleted(),
          signedOut: Session.isUserSignedOut(),
          forceLoggedOut,
        });
      }
    } catch (err) {
      // Shadow FSM must never destabilize the host.
      // eslint-disable-next-line no-console -- FSM/lifecycle code must reach crash reporters before logger is ready
      console.warn("[AuthFSM] startShadow threw (ignored):", err);
    }
    // Intentionally empty deps ? this must run exactly once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: adding this dep causes an infinite re-render loop
  }, []);

  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (user) => {
      // Phase 3d-a: Observe in shadow FSM (no behaviour change). Sent before
      // any short-circuit so the FSM sees every Firebase auth-state change.
      authFsm.send({ type: authFsm.E.AUTH_CHANGED, user });

      // If sign-out is in progress, ignore auth state changes
      if (signOutInProgress.current) {
        return;
      }
      // ? Also ignore if userEmail was cleared (sign-out completed)
      const storedEmail = Session.getUserEmail();
      if (!user && !storedEmail) {
        // Normal sign-out state ? do nothing, UI already reset
        return;
      }
      // ? Block iOS silent re-auth: if user explicitly signed out, ignore Firebase re-auth callbacks
      if (user && Session.isUserSignedOut()) {
        console.warn(
          "?? [Auth State] Blocked silent re-auth ? user signed out",
        );
        signOutUser().catch(() => {});
        return;
      }
      // ? Block re-auth if account was permanently deleted
      if (user && Session.isAccountDeleted()) {
        console.warn("?? [Auth State] Blocked re-auth ? account was deleted");
        signOutUser().catch(() => {});
        return;
      }
      // ? Hard gate: if forceLoggedOut is true, never re-login from Firebase
      if (forceLoggedOut) {
        console.warn(
          "?? [Auth State] Blocked re-auth ? forceLoggedOut is true",
        );
        signOutUser().catch(() => {});
        return;
      }

      if (user) {
        // Get database UserId if not already attached
        if (!user.id) {
          // Warm-start fast path: reuse the cached DB userId to avoid a
          // network round-trip on every app open for returning users.
          const cachedId = Session.getDbUserId();
          if (cachedId) {
            user.id = cachedId;
            debugLog(
              "? [Auth State] Restored database UserId from cache:",
              user.id,
            );
          } else {
            const dbUserId = await getUserId(user);
            if (dbUserId) {
              user.id = dbUserId;
              Session.setDbUserId(dbUserId);
              debugLog(
                "? [Auth State] Attached database UserId to user object:",
                user.id,
              );
            }
          }
        }

        // Store user email in localStorage for API calls
        const userEmail = user.email || user.Email;
        if (userEmail) {
          Session.setUserEmail(userEmail);
          debugLog(
            "? [Auth State] Stored user email in localStorage:",
            userEmail,
          );
        }

        // Fire context load without awaiting -- runs in parallel with the status
        // check below. getUserContext only needs user.id; checkUserStatus only
        // needs user.email. Both are resolved above so there is no ordering
        // dependency between these two calls.
        if (user.id) {
          debugLog(
            "?? [Auth State] Loading user context (parallel with status check)...",
          );
          setUserContextLoading(true);
          getUserContext(user.id)
            .then((ctx) => {
              setUserContext(ctx);
              debugLog("? [Auth State] User context stored in state");
            })
            .catch((err) => {
              console.error("? [Auth State] Failed to load context:", err);
            })
            .finally(() => {
              setUserContextLoading(false);
            });
        }

        // Skip status check if this is a fresh Google sign-in that's being saved
        // The handleSignIn/handlePopupSignIn functions will handle status check after save
        const isFreshSignIn =
          sessionStorage.getItem("freshGoogleSignIn") === "true";

        if (!isFreshSignIn) {
          // Fast path for returning users: surface home screen (and camera)
          // immediately � identical to the OTP synchronous cache restore.
          // Status/setup/profile checks run in the background; modals
          // (inactive, setup wizard, profile gate) appear when needed but
          // never block the initial paint or the camera auto-open.
          // This eliminates the white screen between native splash dismiss
          // and the camera opening for Google/Firebase returning users.
          setUser(user);
          setAuthLoading(false);

          // Background validation � fire and forget. All inner awaits only
          // mutate React state (setShow*, setIsUserActive, etc.) � safe to
          // call from an async IIFE after the render is already committed.
          (async () => {
            const isActive = await checkUserStatus(user);
            if (!isActive) return; // inactive/not-found modal already triggered

            // -- Consume any BPC card stored pre-login (deep link before sign-in) --
            // Happens when: user tapped WhatsApp link ? app not logged in ? savePendingCard()
            // was called ? user now logged in ? save height+BMR to their profile silently.
            const bpcPending = consumePendingCard();
            if (bpcPending?._token && user?.id) {
              const { saveCardToProfile } = await import(
                "./features/body-parameters-card"
              );
              saveCardToProfile(bpcPending._token, user.id).catch((err) => {
                debugLog(
                  "[BPC] post-login pending card save failed:",
                  err?.message,
                );
              });
              debugLog(
                "? [BPC] Consumed pending card after login, height+BMR saved to profile",
              );
            }

            if (!userEmail) return;
            debugLog("?? [Auth State] Checking setup wizard status...");

            // Check if user manually skipped setup (localStorage first for quick bypass)
            if (Session.isSetupSkipped()) {
              debugLog(
                "?? [Auth State] User skipped setup (localStorage), bypassing wizard",
              );
              // silent:true � Gate 3 (profileChecking spinner) must not fire
              // when running from a background context after home screen is shown.
              await checkProfileCompletion(userEmail, user, { silent: true });
              return;
            }

            try {
              // Phase 3b: HTTP + response mapping moved into
              // shared/services/auth/userSetup (`fetchSetupStatus`).
              const status = await fetchSetupStatus({
                apiBaseUrl,
                email: userEmail,
              });

              // Phase 3d-a: Observe in shadow FSM (no behaviour change).
              authFsm.send({
                type: authFsm.E.SETUP_STATUS_RESOLVED,
                result: status.result,
                isDemo: (userEmail || "").toLowerCase().trim() === DEMO_EMAIL,
                coachOtpVerified: Session.isCoachOtpVerified(),
              });

              if (status.result === "error") {
                console.warn(
                  "?? [Auth State] Setup status check failed",
                  status.error,
                );
              } else if (status.result === "skipped") {
                debugLog(
                  "?? [Auth State] User skipped setup (database), bypassing wizard",
                );
                Session.markSetupSkipped();
                await checkProfileCompletion(userEmail, user, { silent: true });
              } else if (status.result === "pendingOtp") {
                if (Session.isCoachOtpVerified()) {
                  debugLog(
                    "? [Auth State] Coach OTP already verified (localStorage), skipping modal",
                  );
                  await checkProfileCompletion(userEmail, user, {
                    silent: true,
                  });
                } else if (
                  (userEmail || "").toLowerCase().trim() === DEMO_EMAIL
                ) {
                  debugLog(
                    "?? [Auth State] Demo account pending OTP � completing silently",
                  );
                  await silentlyCompleteDemoSetup(userEmail);
                  await checkProfileCompletion(userEmail, user, {
                    silent: true,
                  });
                } else {
                  debugLog(
                    "?? [Auth State] Pending OTP detected, showing OTP modal",
                  );
                  setShowValidateOTP(true);
                }
              } else if (status.result === "incomplete") {
                if ((userEmail || "").toLowerCase().trim() === DEMO_EMAIL) {
                  debugLog(
                    "?? [Auth State] Demo account setup incomplete � completing silently",
                  );
                  await silentlyCompleteDemoSetup(userEmail);
                  await checkProfileCompletion(userEmail, user, {
                    silent: true,
                  });
                } else {
                  debugLog(
                    "?? [Auth State] Setup incomplete, showing setup wizard",
                  );
                  setShowSetupWizard(true);
                }
              } else {
                // status.result === "complete"
                debugLog("? [Auth State] Setup already complete");
                await checkProfileCompletion(userEmail, user, { silent: true });
              }
            } catch (setupError) {
              console.warn(
                "?? [Auth State] Failed to check setup status:",
                setupError,
              );
              // Continue without blocking � setup check is not critical
            }
          })();
          return; // Skip fall-through setUser/setAuthLoading � already called above
        } else {
          // Don't clear the flag here - let the sign-in handler clear it after save completes
          debugLog(
            "?? [Auth State] Fresh sign-in detected, skipping status check",
          );
        }
      }

      setUser(user);
      setAuthLoading(false);

      // Skip handleSaveUserCache for fresh sign-ins - let sign-in handler do it after save
      const isFreshSignIn =
        sessionStorage.getItem("freshGoogleSignIn") === "true";
      if (user && Capacitor.isNativePlatform() && !isFreshSignIn) {
        handleSaveUserCache(user);
      } else if (isFreshSignIn) {
        debugLog(
          "?? [Auth State] Skipping handleSaveUserCache for fresh sign-in",
        );
      }
    });
    return () => unsubscribe();
  }, [
    checkUserStatus,
    checkProfileCompletion,
    checkProfilePicture,
    apiBaseUrl,
    forceLoggedOut,
  ]);

  // Subscribe to user context updates (from profile edits, food corrections, etc.)
  useEffect(() => {
    if (!user?.id) return;

    const {
      subscribeToContextUpdates,
    } = require("./shared/services/userIdentity");
    const unsubscribe = subscribeToContextUpdates((updatedContext) => {
      debugLog("? [App] User context updated in state:", {
        corrections: updatedContext?.personalCorrections?.length || 0,
        diet: updatedContext?.dietPreference,
      });
      setUserContext(updatedContext);
    });

    return unsubscribe;
  }, [user?.id, forceLoggedOut]);

  // Called when the user taps "Allow Access & Continue" OR "Skip" in the
  // PermissionPrimerModal. Runs the actual OS permission dialogs, marks the
  // session so the exact-alarm check is deferred, then sets permissionsReady.
  const handlePermissionsGranted = useCallback(async () => {
    setShowPermissionPrimer(false);
    // Mark that the primer ran this session � exact-alarm check must not
    // interrupt the very next screen (first camera / food analysis).
    sessionStorage.setItem("wv.primerDoneThisSession", "1");
    try {
      await requestAllPermissions();
    } catch (_) {
      // fail-open � camera still opens
    }
    localStorage.setItem("wv.permissionsGranted", "1");
    setPermissionsReady(true);
  }, [requestAllPermissions]);

  // Setup for authenticated users.
  // First-install path: show PermissionPrimerModal so the user understands
  // WHY each permission is needed BEFORE the OS dialogs appear.
  // Returning-user path: silently re-check / re-register push token.
  useEffect(() => {
    if (!user) return;
    let mounted = true;
    handleSaveUserCache(user);

    const isFirstInstall =
      Capacitor.isNativePlatform() &&
      localStorage.getItem("wv.permissionsGranted") !== "1";

    if (isFirstInstall) {
      // Show primer � handlePermissionsGranted fires when user taps Allow/Skip
      setShowPermissionPrimer(true);
      return () => { mounted = false; };
    }

    // Returning user � request silently (dialogs are no-ops when already granted)
    requestAllPermissions()
      .then(() => {
        localStorage.setItem("wv.permissionsGranted", "1");
        if (mounted) setPermissionsReady(true);
      })
      .catch(() => {
        if (mounted) setPermissionsReady(true);
      });
    return () => { mounted = false; };
  }, [user, requestAllPermissions, handleSaveUserCache, handlePermissionsGranted]);

  // Fetch education time window from DB so ImageUpload uses live values (no hardcoding)
  useEffect(() => {
    const fetchEducationWindow = async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/api/misc/time-windows`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();

        // API returns: { success: true, windows: { education: { start, end }, weight: {...}, ... } }
        if (data.success && data.windows?.education) {
          const eduWindow = data.windows.education;
          debugLog("? Education window fetched from DB:", eduWindow);
          setEducationWindow(eduWindow);
        } else {
          console.warn("?? Education window not found in response:", data);
        }
        if (data.success && data.windows?.weight) {
          setWeightWindow(data.windows.weight);
        }
      } catch (err) {
        console.warn(
          "?? Failed to fetch education window from DB:",
          err.message,
        );
      }
    };
    fetchEducationWindow();
  }, [apiBaseUrl]);

  // Handle OTP user restoration
  useEffect(() => {
    const restoreOtpUser = async () => {
      // Skip restoration when the inactive-reactivation flow is in progress.
      // In that flow isOtpVerified is temporarily forced to true so ValidateOTP
      // can render; running restoreOtpUser here would call checkUserStatus,
      // see "Inactive", and show the modal again on top of the OTP screen.
      if (isInactiveReactivationFlow) return;

      if (isOtpVerified && !user) {
        const otpUserRaw = Session.getOtpUserRaw();

        if (otpUserRaw) {
          try {
            const parsedUser = JSON.parse(otpUserRaw);

            // Get database UserId if not already attached
            if (!parsedUser.id) {
              const dbUserId = await getUserId(parsedUser);
              if (dbUserId) {
                parsedUser.id = dbUserId;
                Session.setDbUserId(dbUserId);
                debugLog(
                  "? [OTP Restore] Attached database UserId to user object:",
                  parsedUser.id,
                );
              }
            }

            // Store user email in localStorage for API calls
            const userEmail = parsedUser.email || parsedUser.Email;
            if (userEmail) {
              Session.setUserEmail(userEmail);
              debugLog(
                "? [OTP Restore] Stored user email in localStorage:",
                userEmail,
              );
            }

            // Load user context for AI personalization
            if (parsedUser.id) {
              debugLog("?? [OTP Restore] Loading user context...");
              setUserContextLoading(true);
              try {
                const context = await getUserContext(parsedUser.id);
                setUserContext(context);
                debugLog("? [OTP Restore] User context stored in state");
              } catch (error) {
                console.error(
                  "? [OTP Restore] Failed to load context:",
                  error,
                );
              } finally {
                setUserContextLoading(false);
              }
            }

            // Check user status before restoring
            const isActive = await checkUserStatus(parsedUser);

            if (!isActive) {
              // Set user state so modal can show
              setUser(parsedUser);
              // Modal close handler will clear localStorage
              return;
            }

            setUser(parsedUser);
            setAuthLoading(false); // safety net: clear loading gate for fresh OTP logins
            handleSaveUserCache(parsedUser);
            // ? Check profile completion after OTP user is restored on refresh
            if (userEmail) {
              await checkProfileCompletion(userEmail, parsedUser, {
                silent: true,
              });
            }
          } catch (error) {
            console.error("Failed to restore OTP user:", error);
            Session.clearOtpUser();
            setIsOtpVerified(false);
          }
        }
      }
    };

    restoreOtpUser();
  }, [
    isOtpVerified,
    user,
    isInactiveReactivationFlow,
    checkUserStatus,
    checkProfileCompletion,
  ]);

  // Background validation for cache-restored OTP sessions.
  // When user was pre-loaded synchronously (no loading screen), the standard
  // OTP restore waterfall is skipped. This effect runs the essential checks
  // in the background without blocking the home screen or camera.
  useEffect(() => {
    if (!otpCacheRestoredRef.current || !user) return;
    otpCacheRestoredRef.current = false; // run exactly once
    (async () => {
      try {
        // Attach DB userId if not yet present
        if (!user.id) {
          const cachedId = Session.getDbUserId();
          if (cachedId) {
            user.id = cachedId;
          } else {
            const dbId = await getUserId(user);
            if (dbId) {
              user.id = dbId;
              Session.setDbUserId(dbId);
            }
          }
        }
        // Status check ? shows inactive modal if account was deactivated.
        await checkUserStatus(user, isInactiveReactivationFlow);
        // Profile completion ? silent:true so Gate 3 (profileChecking spinner)
        // never fires on app open. CompleteProfilePage still shows if needed.
        const email = user.email || user.Email;
        if (email) await checkProfileCompletion(email, user, { silent: true });
      } catch (err) {
        console.warn(
          "?? [OTP Cache Restore] Background validation error:",
          err,
        );
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty ? run once on mount only

  // ? Immediate profile check when app comes back to foreground.
  // NOTE: this is a SEPARATE appStateChange listener from the gallery
  // monitoring effect above. Capacitor allows multiple listeners on the
  // same event ? the gallery effect now removes only its own handle
  // (not removeAllListeners), so this one survives gallery effect re-runs.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;
    if (!user) return undefined;

    let handle = null;
    let cancelled = false;

    // ? NATIVE LIFECYCLE PHASE: registration plumbing routed through
    // nativeLifecycle.addAppStateListener. Each consumer still receives its
    // own PluginListenerHandle so this effect can clean up independently of
    // the gallery effect's listener (which lives above).
    Promise.resolve(
      nativeLifecycle.addAppStateListener(({ isActive }) => {
        if (isActive && user) {
          // Guard: skip while CompleteProfilePage is visible. Returning from
          // camera/gallery triggers this listener; re-running checkProfileCompletion
          // would set profileChecking=true, unmounting the form and discarding
          // all typed input (height, phone, diet, selected photo).
          if (_profileGateActiveRef.current) return;
          const userEmail = user.email || user.Email;
          if (userEmail) {
            debugLog(
              "?? [Foreground] App resumed ? running immediate profile check",
            );
            checkProfileCompletion(userEmail, user, { silent: true });
          }
        }
      }),
    )
      .then((h) => {
        if (cancelled) {
          h?.remove?.();
        } else {
          handle = h;
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      try {
        handle?.remove?.();
      } catch {
        /* ignore */
      }
    };
  }, [user, checkProfileCompletion]);

  // Periodic user status check (every 60 seconds)
  useEffect(() => {
    if (!user) return;

    const statusCheckInterval = setInterval(async () => {
      // Skip showing inactive modal if we're in reactivation flow
      await checkUserStatus(user, isInactiveReactivationFlow);
    }, 60000); // Check every 60 seconds

    return () => clearInterval(statusCheckInterval);
  }, [user, checkUserStatus, isInactiveReactivationFlow]);

  // Check setup wizard status whenever user is set/updated
  useEffect(() => {
    const checkSetupStatus = async () => {
      if (!user || !isUserActive) return;

      // Skip during inactive reactivation flow - ValidateOTP is managed by handleContactCoach
      if (isInactiveReactivationFlow) return;

      const userEmail = user.email || user.Email;
      if (!userEmail) return;

      debugLog(
        "?? [Setup Check] Checking setup wizard status for existing user...",
      );

      // Check if user manually skipped setup (check localStorage first for quick bypass)
      if (Session.isSetupSkipped()) {
        debugLog(
          "?? [Setup Check] User skipped setup (localStorage), bypassing wizard",
        );
        return;
      }

      try {
        // Phase 3b: HTTP + response mapping moved into
        // shared/services/auth/userSetup (`fetchSetupStatus`).
        const status = await fetchSetupStatus({ apiBaseUrl, email: userEmail });

        // Phase 3d-a: Observe in shadow FSM (no behaviour change).
        authFsm.send({
          type: authFsm.E.SETUP_STATUS_RESOLVED,
          result: status.result,
          isDemo: (userEmail || "").toLowerCase().trim() === DEMO_EMAIL,
          coachOtpVerified: Session.isCoachOtpVerified(),
        });

        if (status.result === "error") {
          console.warn(
            "?? [Setup Check] Setup status check failed",
            status.error,
          );
        } else if (status.result === "skipped") {
          debugLog(
            "?? [Setup Check] User skipped setup (database), bypassing wizard",
          );
          Session.markSetupSkipped();
          return;
        } else if (status.result === "pendingOtp") {
          if (Session.isCoachOtpVerified()) {
            debugLog(
              "? [Setup Check] Coach OTP already verified (localStorage), skipping modal",
            );
            await checkProfileCompletion(userEmail, null, { silent: true });
            setTimeout(() => checkProfilePicture(user), 800);
          } else if ((userEmail || "").toLowerCase().trim() === DEMO_EMAIL) {
            debugLog(
              "?? [Setup Check] Demo account pending OTP ? completing silently",
            );
            await silentlyCompleteDemoSetup(userEmail);
            await checkProfileCompletion(userEmail, null, { silent: true });
            setTimeout(() => checkProfilePicture(user), 800);
          } else {
            debugLog(
              "?? [Setup Check] Pending OTP detected, showing OTP modal",
            );
            setShowValidateOTP(true);
          }
        } else if (status.result === "incomplete") {
          if ((userEmail || "").toLowerCase().trim() === DEMO_EMAIL) {
            debugLog(
              "?? [Setup Check] Demo account setup incomplete ? completing silently",
            );
            await silentlyCompleteDemoSetup(userEmail);
            await checkProfileCompletion(userEmail, null, { silent: true });
            setTimeout(() => checkProfilePicture(user), 800);
          } else {
            debugLog("?? [Setup Check] Setup incomplete, showing setup wizard");
            setShowSetupWizard(true);
          }
        } else {
          // status.result === "complete"
          debugLog("? [Setup Check] Setup already complete");
          await checkProfileCompletion(userEmail, null, { silent: true });
          setTimeout(() => checkProfilePicture(user), 800);
        }
      } catch (setupError) {
        console.warn(
          "?? [Setup Check] Failed to check setup status:",
          setupError,
        );
      }
    };

    // Run check after a short delay to ensure auth is fully complete
    const timeoutId = setTimeout(() => {
      checkSetupStatus();
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [
    user,
    isUserActive,
    apiBaseUrl,
    checkProfileCompletion,
    checkProfilePicture,
    isInactiveReactivationFlow,
  ]);

  // ? PERFORMANCE: Preload user context when user logs in (warm the cache)
  useEffect(() => {
    const preloadUserContext = async () => {
      if (!user || !user.id) return;

      try {
        debugLog("? [PRELOAD] Warming user context cache...");
        const context = await getUserContext(user.id);
        if (context) {
          setUserContext(context);
          debugLog(
            "? [PRELOAD] Context cached - image analysis will be faster",
          );
        }
      } catch (error) {
        console.warn("?? [PRELOAD] Failed to preload context:", error);
      }
    };

    // Preload after a short delay to avoid blocking auth flow
    const timeoutId = setTimeout(preloadUserContext, 500);
    return () => clearTimeout(timeoutId);
  }, [user]); // Re-run when user changes

  // Convert user profile photo to base64 for CORS-safe use in html2canvas share cards.
  // Uses an AbortController so an in-flight fetch is cancelled if the user logs
  // out / changes photoURL while it's loading (prevents "setState on unmounted"
  // warnings and stale writes overwriting newer data).
  useEffect(() => {
    const photoUrl = user?.photoURL;
    if (!photoUrl) {
      setSharePhotoBase64(null);
      return undefined;
    }
    const { signal, cancel } = createAbortGroup();
    fetch(photoUrl, { signal })
      .then((res) => res.blob())
      .then(
        (blob) =>
          new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          }),
      )
      .then((dataUrl) => {
        if (!signal.aborted) setSharePhotoBase64(dataUrl);
      })
      .catch((err) => {
        if (isAbortError(err)) return; // expected on cleanup
        if (!signal.aborted) setSharePhotoBase64(null);
      });
    return cancel;
  }, [user?.photoURL]);

  // Fetch saved custom profile image for share card
  useEffect(() => {
    if (!user?.email || !apiBaseUrl) {
      setSavedProfileImage(null);
      return undefined;
    }
    const { signal, cancel } = createAbortGroup();
    // Use standard caching ? no need to bust cache on every render
    fetch(
      `${apiBaseUrl}/api/user/profile?email=${encodeURIComponent(user.email)}`,
      { signal },
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (signal.aborted) return;
        if (data?.success && data?.data?.profileImage)
          setSavedProfileImage(data.data.profileImage);
        else setSavedProfileImage(null);
        if (data?.success && data?.data?.userName)
          setSavedUserName(data.data.userName);
        else setSavedUserName(null);
      })
      .catch((err) => {
        if (isAbortError(err)) return;
        setSavedProfileImage(null);
        setSavedUserName(null);
      });
    return cancel;
  }, [user?.email, apiBaseUrl]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  // Auto-dismiss save error after 5 seconds
  useEffect(() => {
    if (saveError) {
      const timer = setTimeout(() => {
        setSaveError(null);
      }, 5000); // 5 seconds

      return () => clearTimeout(timer); // Cleanup on unmount or when saveError changes
    }
  }, [saveError]);

  // ? ANDROID PERFORMANCE: Optimized image compression with async processing
  const compressImage = (base64, quality = 0.7, maxWidth = 1920) => {
    return new Promise((resolve, reject) => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", {
          alpha: false, // Disable alpha for JPEG (faster)
          willReadFrequently: false,
        });
        const img = new Image();

        img.onload = () => {
          try {
            // Calculate new dimensions
            let { width, height } = img;

            if (width > maxWidth) {
              height = Math.floor((height * maxWidth) / width);
              width = maxWidth;
            }

            canvas.width = width;
            canvas.height = height;

            // Use faster rendering
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";
            ctx.drawImage(img, 0, 0, width, height);

            // Convert to JPEG with specified quality
            const compressedBase64 = canvas.toDataURL("image/jpeg", quality);

            // Clean up
            canvas.width = 0;
            canvas.height = 0;
            img.src = "";

            resolve(compressedBase64);
          } catch (err) {
            reject(err);
          }
        };

        img.onerror = (err) =>
          reject(new Error("Failed to load image for compression"));
        img.src = base64;
      } catch (err) {
        reject(err);
      }
    });
  };

  /**
   * Fetch the user's height (from profile) and compute their ideal weight range
   * using BMI 19 (lower) and BMI 23 (upper) of the WHO normal range (18.5?24.9).
   * Formula: idealWeight (kg) = BMI ? (heightInMeters)?
   * Updates `idealWeight` state so the share card / visible card can show it.
   */
  const refreshIdealWeight = async () => {
    try {
      if (!user?.email) return;
      const profileRes = await fetch(
        `${apiBaseUrl}/api/user/profile?email=${encodeURIComponent(
          user.email,
        )}&_t=${Date.now()}`,
        { cache: "no-store" },
      );
      if (!profileRes.ok) return;
      const profileData = await profileRes.json();
      const heightCm = parseFloat(profileData?.data?.height);
      if (!heightCm || heightCm < 50 || heightCm > 250) {
        setIdealWeight(null);
        return;
      }
      const heightM = heightCm / 100;
      const idealMin = 19 * heightM * heightM;
      const idealMax = 23 * heightM * heightM;
      setIdealWeight({
        min: Math.round(idealMin * 10) / 10, // BMI 19 lower bound
        value: Math.round(idealMax * 10) / 10, // BMI 23 upper bound
        unit: "kg",
        heightCm: Math.round(heightCm),
      });
    } catch (_) {
      /* non-critical ? share card just won't show ideal weight */
    }
  };

  /**
   * Trigger reverse progress modal after weight save
   * Checks if user's weight moved in wrong direction (reverse progress)
   * and shows personalized tips if needed
   */
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

      // Capture GPS location for every weight photo � not just when inside a club.
      // Raw lat/lng + city/village are always recorded; club fields added when nearby.
      // Fails gracefully � weight save is never blocked by a GPS timeout.
      let attendance;
      try {
        // Add timeout longer than the GPS getCurrentPosition timeout (10s) so
        // the GPS call always has a chance to resolve before the race cuts it off.
        const gpsPromise = locationAttendanceService.determineAttendance(
          apiBaseUrl,
          userId,
        );
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("GPS timeout after 15s")), 15000),
        );

        attendance = await Promise.race([gpsPromise, timeoutPromise]);
        console.log(
          "?? [performWeightSave] GPS location captured successfully",
        );
        debugLog("?? [weight] Attendance determined:", attendance);

        // If multiple clubs detected, auto-select the closest one (first in array)
        if (attendance.nearbyCenters && attendance.nearbyCenters.length > 1) {
          debugLog(
            "?? [weight] Multiple clubs detected, auto-selecting closest club",
          );
          const closestClub = attendance.nearbyCenters[0];
          debugLog(
            "? [weight] Auto-selected closest club:",
            closestClub.center.center_name,
            `(${Math.round(closestClub.distance)}m)`,
          );

          // Update attendance to use the closest club
          attendance.nutritionCenterId = closestClub.center.id;
          attendance.centerName = closestClub.center.center_name;
          attendance.attendanceType = "club";
        }

        // Single club or remote
        if (attendance.latitude && attendance.longitude) {
          payload.latitude = attendance.latitude;
          payload.longitude = attendance.longitude;
          payload.attendanceType = attendance.attendanceType;
          payload.nutritionCenterId = attendance.nutritionCenterId || null;
          payload.centerName = attendance.centerName || null;
          debugLog(
            "?? [weight] Location attached to save payload:",
            attendance,
          );

          // Reverse-geocode to city + village
          const { city, village } = await fetchCityVillage(
            attendance.latitude,
            attendance.longitude,
          );
          payload.city = city;
          payload.village = village;
        }
      } catch (gpsErr) {
        console.log(
          "?? [performWeightSave] GPS failed, proceeding without location:",
          gpsErr.message,
        );
        debugLog(
          "?? [weight] GPS check failed, saving without location:",
          gpsErr.message,
        );
        // Fallback to remote attendance
        payload.attendanceType = "remote";
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
        if (data.bmrSaved && weightData.bmr) {
          debugLog(
            "?? [BMR] Weight rejected but BMR was saved � triggering re-fetch:",
            weightData.bmr,
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
            getISTDateStr(latestDate) !== getISTDateStr(prevDate);

          console.log("?? [celebration] Weight comparison:", {
            prevWeight,
            finalSavedWeight,
            weightChange,
            isDifferentDay,
            latestDate,
            prevDate,
          });

          // Safety guard: only show diff if previous entry is from a different IST calendar date
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

      // ?? If BMR was saved with this weight entry, force NutritionDashboard to re-fetch
      // BMR is synced to team_table by the backend ? increment the key so it re-reads it
      if (weightData.bmr) {
        setBmrUpdateKey((prev) => prev + 1);
        debugLog(
          "?? [BMR] BMR saved with weight entry, forcing NutritionDashboard re-fetch:",
          weightData.bmr,
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

  /**
   * Handle manual weight entry from modal
   */
  const handleManualWeightSave = async (manualData) => {
    try {
      setShowManualWeightModal(false); // Close modal first
      setLoadingState("saving");
      setSaveLoading(true); // Show saving overlay
      setImageType("weight"); // Ensure weight type is set

      await saveWeightEntry(
        {
          weightValue: manualData.weightValue,
          unit: manualData.unit,
          bmi: null,
          bodyFat: null,
          muscleMass: null,
          bmr: manualData.bmr || null,
        },
        currentWeightImage,
      );

      setCurrentWeightImage(null);
      setLoading(false);
    } catch (err) {
      console.error("? Manual weight save error:", err);
      throw err; // Re-throw to show error in modal
    }
  };

  /** Determine meal type label from a Date object based on hour */
  const getMealTypeFromTime = (date) => {
    const h = (date || new Date()).getHours();
    if (h < 10) return "Breakfast";
    if (h < 14) return "Lunch";
    if (h < 18) return "Dinner";
    return "Snack";
  };

  /**
   * Returns the two alt-switch buttons for a given modal type (the other two options).
   * Used to render "No, it's X" inside each auto-opened modal.
   */
  const getAltSwitchButtons = (currentType) => {
    const now = new Date();
    return [
      currentType !== "food" && {
        label: "Food",
        icon: "??",
        sub: `It's ${getMealTypeFromTime(now).toLowerCase()} time`,
        onClick: () => {
          setShowManualWeightModal(false);
          setShowManualEducationModal(false);
          setManualMealType(getMealTypeFromTime(now));
          setShowManualFoodModal(true);
        },
      },
      currentType !== "weight" && {
        label: "Weight",
        icon: "??",
        sub: weightWindow
          ? `${weightWindow.start?.slice(0, 5)}?${weightWindow.end?.slice(
              0,
              5,
            )}`
          : null,
        onClick: () => {
          setShowManualFoodModal(false);
          setShowManualEducationModal(false);
          fetchLastWeight();
          setCurrentWeightImage(null);
          setShowManualWeightModal(true);
        },
      },
      currentType !== "education" && {
        label: "Education",
        icon: "??",
        sub: educationWindow
          ? `${educationWindow.start?.slice(0, 5)}?${educationWindow.end?.slice(
              0,
              5,
            )}`
          : null,
        onClick: () => {
          setShowManualFoodModal(false);
          setShowManualWeightModal(false);
          setShowManualEducationModal(true);
        },
      },
    ].filter(Boolean);
  };

  /** When AI is unavailable, auto-open the best manual entry modal based on time windows */
  const openBestManualModal = () => {
    setError(null); // clear AI Unavailable card ? modal handles the UI
    const now = imageTimestamp ? new Date(imageTimestamp) : new Date();
    const mins = now.getHours() * 60 + now.getMinutes();

    const inWindow = (win) => {
      if (!win?.start || !win?.end) return false;
      const [sh, sm] = win.start.split(":").map(Number);
      const [eh, em] = win.end.split(":").map(Number);
      return mins >= sh * 60 + sm && mins <= eh * 60 + em;
    };

    if (inWindow(weightWindow)) {
      fetchLastWeight();
      setCurrentWeightImage(null);
      setShowManualWeightModal(true);
    } else if (inWindow(educationWindow)) {
      setShowManualEducationModal(true);
    } else {
      // Default ? food
      setManualMealType(getMealTypeFromTime(now));
      setShowManualFoodModal(true);
    }
  };

  /** Fetch the user's most recent weight entry for the hint card */
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

  /**
   * Handle manual food entry from modal (used when AI is unavailable)
   */
  const handleManualFoodSave = async (manualData) => {
    try {
      setShowManualFoodModal(false);
      setError(null);
      setImageType("food");
      setLoadingState("saving");
      setSaveLoading(true);

      // Build detailedItems ? either a full plate (multiple) or a single food
      let detailedItems;
      let totalNutrition;
      let categoryName;

      if (manualData.isPlate && Array.isArray(manualData.items)) {
        detailedItems = manualData.items.map((f) => ({
          name: f.name,
          portionDescription: "1 serving",
          estimatedWeight: "Unknown",
          calories: f.calories ?? 0,
          protein: f.protein ?? 0,
          carbs: f.carbs ?? 0,
          fat: f.fat ?? 0,
          fiber: f.fiber ?? 0,
          nutrition: {
            calories: f.calories ?? 0,
            protein: f.protein ?? 0,
            carbs: f.carbs ?? 0,
            fat: f.fat ?? 0,
            fiber: f.fiber ?? 0,
          },
        }));
        totalNutrition =
          manualData.total ||
          detailedItems.reduce(
            (acc, f) => ({
              calories: acc.calories + f.calories,
              protein: acc.protein + f.protein,
              carbs: acc.carbs + f.carbs,
              fat: acc.fat + f.fat,
              fiber: acc.fiber + f.fiber,
            }),
            { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
          );
        categoryName = manualData.plateName || "Mixed Plate";
      } else {
        detailedItems = [
          {
            name: manualData.foodName,
            portionDescription: manualData.portion,
            estimatedWeight: "Unknown",
            calories: manualData.calories,
            protein: manualData.protein,
            carbs: manualData.carbs,
            fat: manualData.fat,
            fiber: manualData.fiber,
            nutrition: {
              calories: manualData.calories,
              protein: manualData.protein,
              carbs: manualData.carbs,
              fat: manualData.fat,
              fiber: manualData.fiber,
            },
          },
        ];
        totalNutrition = {
          calories: manualData.calories,
          protein: manualData.protein,
          carbs: manualData.carbs,
          fat: manualData.fat,
          fiber: manualData.fiber,
        };
        categoryName = manualData.foodName;
      }

      const result = {
        nutrition: totalNutrition,
        category: { name: categoryName },
        source: "Manual Entry",
        isRealData: true,
        isManualEntry: true,
        itemCount: detailedItems.length,
        confidence: "high",
        detailedItems,
        loggedAt: new Date().toISOString(),
      };

      setNutritionData(result);

      let actualUserId = user?.id;
      if (!actualUserId) {
        actualUserId = await getUserId(user);
      }

      await performNutritionSave({
        userId: actualUserId,
        imagePath: "manual-entry",
        imageBase64: null,
        analysisResult: result,
        deviceInfo: window.navigator.userAgent,
        userEmail: user?.email || user?.Email || "unknown",
        captureTimestamp: null,
      });
    } catch (err) {
      console.error("? Manual food save error:", err);
      throw err;
    } finally {
      setSaveLoading(false);
    }
  };

  // -- PR-E / ADR-0003 � Unknown share viewer Retry / Edit actions -----------

  // Convert a stored base64 image back into a File for Gemini re-analysis.
  const base64ToImageFile = (b64, filename = "capture.jpg") => {
    const dataUrl = b64.startsWith("data:")
      ? b64
      : `data:image/jpeg;base64,${b64}`;
    const [meta, content] = dataUrl.split(",");
    const mime = (meta.match(/data:(.*?);/) || [, "image/jpeg"])[1];
    const bin = atob(content);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new File([bytes], filename, { type: mime });
  };

  // Build the analysisResult envelope extractNutrition() understands from a
  // SmartFoodSearchModal manual payload (single food or plate).
  const buildAnalysisFromManualFood = (m) => {
    const toItem = (f) => ({
      name: f.name,
      nutrition: {
        calories: f.calories ?? 0,
        protein: f.protein ?? 0,
        carbs: f.carbs ?? 0,
        fat: f.fat ?? 0,
        fiber: f.fiber ?? 0,
      },
    });
    if (m.isPlate && Array.isArray(m.items)) {
      const foods = m.items.map(toItem);
      const total =
        m.total ||
        foods.reduce(
          (a, f) => ({
            calories: a.calories + (f.nutrition.calories || 0),
            protein: a.protein + (f.nutrition.protein || 0),
            carbs: a.carbs + (f.nutrition.carbs || 0),
            fat: a.fat + (f.nutrition.fat || 0),
            fiber: a.fiber + (f.nutrition.fiber || 0),
          }),
          { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
        );
      return { foods, total, confidence: "high" };
    }
    const item = toItem({
      name: m.foodName,
      calories: m.calories,
      protein: m.protein,
      carbs: m.carbs,
      fat: m.fat,
      fiber: m.fiber,
    });
    return { foods: [item], total: item.nutrition, confidence: "high" };
  };

  // Retry: re-run Gemini on the stored image and, if confident, promote the
  // capture unknown ? food. Still-low-confidence keeps the row as unknown.
  const handleUnknownShareRetry = async () => {
    const { captureId, imageBase64 } = unknownShareView;
    if (!captureId || !imageBase64 || !user?.id) return;
    setUnknownShareView((v) => ({ ...v, retrying: true, error: null }));
    try {
      const file = base64ToImageFile(imageBase64);

      // Use the single orchestrate call � same single-Gemini-call path as
      // handleImageSelect � so weight, education, and smartwatch captures are
      // correctly re-classified on retry with idempotency via captureId.
      const detectedType = await orchestrateAnalyzeImage(file, {
        captureId: String(captureId),
        userId: user?.id ? String(user.id) : null,
      });

      if (detectedType.type === "food") {
        // Food path: promote the unknown capture to a food entry
        const analysis = detectedType.details;
        if (!hasRecognizedFood(analysis)) {
          setUnknownShareView((v) => ({
            ...v,
            retrying: false,
            error: "Still couldn't recognise it � try Edit instead.",
          }));
          return;
        }
        const analysisResult = buildAnalysisFromGeminiAnalysis(analysis);
        await promoteUnknownToFood({
          captureId,
          viewerUserId: user.id,
          analysisResult,
        });
        setUnknownShareView((v) => ({ ...v, open: false, retrying: false }));
        showToast("Saved to your diary");
        triggerNutritionRefresh({ immediate: true, source: "unknown-retry" });
      } else if (
        detectedType.type === "weight" &&
        detectedType.details?.weightValue
      ) {
        // Weight path: save weight entry
        const weightValue = detectedType.details.weightValue;
        const unit = detectedType.details.unit || "kg";
        await updatePendingCaptureType(
          Promise.resolve({ id: captureId }),
          "weight",
        );
        setUnknownShareView((v) => ({ ...v, open: false, retrying: false }));
        showToast(`Weight ${weightValue} ${unit} saved`);
      } else if (detectedType.type === "education") {
        // Education path: re-tag the capture
        await updatePendingCaptureType(
          Promise.resolve({ id: captureId }),
          "education",
        );
        setUnknownShareView((v) => ({ ...v, open: false, retrying: false }));
        showToast("Education session saved");
      } else if (detectedType.type === "smartwatch") {
        // Smartwatch path: re-tag the capture
        await updatePendingCaptureType(
          Promise.resolve({ id: captureId }),
          "smartwatch",
        );
        setUnknownShareView((v) => ({ ...v, open: false, retrying: false }));
        showToast("Activity saved");
      } else {
        // Still unrecognised
        setUnknownShareView((v) => ({
          ...v,
          retrying: false,
          error: "Still couldn't recognise it � try Edit instead.",
        }));
      }
    } catch (e) {
      setUnknownShareView((v) => ({
        ...v,
        retrying: false,
        error: "Couldn't analyse the photo � try Edit instead.",
      }));
    }
  };

  // Edit: open SmartFoodSearchModal whose save promotes the capture to food.
  const handleUnknownShareEdit = () => {
    if (!unknownShareView.captureId) return;
    setShareEditView({ open: true, captureId: unknownShareView.captureId });
  };

  // Delete: soft-delete the unknown capture (2026-06-09).
  // Updated to use undo pattern (shows banner for 10s).
  const handleUnknownShareDelete = async () => {
    const { captureId, imageBase64 } = unknownShareView;
    if (!captureId || !user?.id) return;
    setUnknownShareView((v) => ({ ...v, retrying: true, error: null }));
    try {
      await deleteCapture({ captureId, userId: user.id });
      setUnknownShareView((v) => ({ ...v, open: false, retrying: false }));
      // Show undo banner
      setUnknownShareUndo({
        captureId,
        userId: user.id,
        imageBase64,
        expiresAt: Date.now() + UNDO_SECONDS * 1000,
      });
    } catch (e) {
      setUnknownShareView((v) => ({
        ...v,
        retrying: false,
        error: "Couldn't delete � please try again.",
      }));
    }
  };

  const handleShareEditSave = async (manualData) => {
    const { captureId } = shareEditView;
    if (!captureId || !user?.id) return;
    try {
      const analysisResult = buildAnalysisFromManualFood(manualData);
      await promoteUnknownToFood({
        captureId,
        viewerUserId: user.id,
        analysisResult,
      });
      setShareEditView({ open: false, captureId: null });
      setUnknownShareView((v) => ({ ...v, open: false }));
      showToast("Saved to your diary");
      // Trigger global nutrition refresh after editing unknown capture
      triggerNutritionRefresh({ immediate: true, source: "unknown-edit" });
    } catch (e) {
      showToast("Couldn't save � please try again");
    }
  };

  /**
   * Save education meeting log to database (AUTO-SAVE)
   * @param {Object} educationData - { platform, topic, confidence, participantCount }
   * @param {string} imageBase64 - Base64 encoded image
   * @param {Object|null} selectedClub - Selected club (optional)
   * @param {string|null} captureTimestamp - EXIF/capture timestamp passed directly to avoid stale state
   */
  const saveEducationLog = async (
    educationData,
    imageBase64,
    selectedClub = null,
    captureTimestamp = null,
    captureId = null,
  ) => {
    try {
      debugLog("?? Auto-saving education log:", educationData);

      // Get the actual database UserId
      let userId = user?.id;
      if (!userId) {
        userId = await getUserId(user);
      }

      if (!userId) {
        throw new Error("User not authenticated or not found in database");
      }

      // ALWAYS check GPS for club attendance regardless of platform (Zoom, Teams, or in-person)
      // If within 100m of club ? club attendance
      // If not near club ? remote attendance
      debugLog("?? Checking GPS for nearby clubs...");

      let attendance;
      try {
        attendance = await locationAttendanceService.determineAttendance(
          apiBaseUrl,
          userId,
        );
        debugLog("? Attendance determined:", attendance);

        // Check if location permission was denied
        if (attendance.locationError === "PERMISSION_DENIED") {
          setAlertModal({
            isOpen: true,
            title: "Location Permission Required",
            message:
              "To track your attendance at nutrition clubs, please enable location permissions in your device settings. Without location access, your attendance will be marked as Remote.",
            type: "warning",
          });
        }
      } catch (gpsError) {
        console.warn(
          "?? GPS check failed, defaulting to remote attendance:",
          gpsError,
        );
        // Fallback to remote attendance if GPS fails
        attendance = {
          attendanceType: "remote",
          nutritionCenterId: null,
          centerName: null,
          nearbyCenters: [],
          locationError: "UNKNOWN",
        };
      }

      // If multiple clubs detected, auto-select the closest one (first in array)
      if (
        attendance.nearbyCenters &&
        attendance.nearbyCenters.length > 1 &&
        !selectedClub
      ) {
        debugLog("?? Multiple clubs detected, auto-selecting closest club");
        const closestClub = attendance.nearbyCenters[0];
        debugLog(
          "? Auto-selected closest club:",
          closestClub.center.center_name,
          `(${Math.round(closestClub.distance)}m)`,
        );

        // Update attendance to use the closest club
        attendance.nutritionCenterId = closestClub.center.id;
        attendance.centerName = closestClub.center.center_name;
        attendance.attendanceType = "club";
      }

      // Reverse-geocode GPS coordinates into city + village via shared helper.
      // fetchCityVillage never throws � returns null fields on failure.
      const { city: userCity, village: userVillage } = await fetchCityVillage(
        attendance.latitude,
        attendance.longitude,
      );

      // Determine final values
      const finalCenterId = selectedClub?.id || attendance.nutritionCenterId;
      const finalCenterName =
        selectedClub?.center_name || attendance.centerName;
      const finalPlatform =
        attendance.attendanceType === "club" ? "Club" : educationData.platform;

      // Use captureTimestamp (passed directly) ? imageTimestamp state ? current time
      // Using the direct parameter avoids reading stale React state
      const logTimestamp =
        captureTimestamp || imageTimestamp || new Date().toISOString();
      debugLog(
        "?? Education log timestamp:",
        logTimestamp,
        captureTimestamp
          ? "(from EXIF param)"
          : imageTimestamp
          ? "(from state)"
          : "(current time)",
      );

      const response = await fetch(`${apiBaseUrl}/api/education/logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userId,
          imageBase64: imageBase64,
          platform: finalPlatform,
          topic: educationData.topic,
          confidence: educationData.confidence,
          participantCount: educationData.participantCount || null,
          deviceInfo: window.navigator.userAgent,
          clientTimestamp: new Date().toISOString(),
          clientTimezoneOffset: new Date().getTimezoneOffset(),
          latitude: attendance.latitude,
          longitude: attendance.longitude,
          attendanceType: attendance.attendanceType,
          nutritionCenterId: finalCenterId,
          centerName: finalCenterName,
          imageTimestamp: logTimestamp, // Pass EXIF timestamp to backend
          city: userCity,
          village: userVillage,
          // PR 6 � captureId is passed explicitly as a param so it is always
          // the value resolved BEFORE the GPS / geocoding awaits, not the
          // potentially-stale ref value read after several async hops.
          captureId: captureId || foodCaptureIdRef.current || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to save education log");
      }

      debugLog("? Education log auto-saved successfully:", data.id);

      // Refresh discipline scores and leaderboards after education save
      handleLeaderboardRefresh();

      debugLog(`   ?? Attendance: ${attendance.attendanceType.toUpperCase()}`);
      if (finalCenterName) {
        debugLog(`   ?? Club: ${finalCenterName}`);
      }
      if (educationData.participantCount) {
        debugLog(`   ?? Participants: ${educationData.participantCount}`);
      }
      if (data.isOnTime !== undefined) {
        const status = data.isOnTime
          ? "? ON-TIME (Present)"
          : "?? LATE (Absent)";
        debugLog(`   ? Timing: ${status}`);
        debugLog(
          `   ?? Upload Time: ${data.uploadTime} (Window: ${data.timeWindow?.start}-${data.timeWindow?.end})`,
        );
      }
      setSaveLoading(false);
      setLoadingState("idle");
    } catch (error) {
      console.error("? Failed to auto-save education log:", error);
      setError(
        error.message || "Failed to save education log. Please try again.",
      );
      setSaveLoading(false);
      setLoadingState("idle");
    }
  };

  // Handle club selection from modal
  const handleClubSelection = async (selectedCenter) => {
    debugLog("?? Club selected:", selectedCenter);
    setShowClubSelectionModal(false);

    // Handle education attendance
    if (pendingEducationData) {
      setSaveLoading(true);
      setLoadingState("saving");
      await saveEducationLog(
        pendingEducationData.educationData,
        pendingEducationData.imageBase64,
        selectedCenter,
        pendingEducationData.captureTimestamp || null,
        pendingEducationData.captureId || null,
      );
      setPendingEducationData(null);
      return;
    }

    // Handle weight save
    if (pendingWeightData) {
      setSaveLoading(true);
      setLoadingState("saving");

      const { weightData, imageBase64, attendance, captureTimestamp } =
        pendingWeightData;

      // Get userId
      let userId = user?.id;
      if (!userId) {
        userId = await getUserId(user);
      }

      const payload = {
        userId,
        weightValue: weightData.weightValue,
        unit: weightData.unit,
        bmi: weightData.bmi,
        bodyFat: weightData.bodyFat,
        muscleMass: weightData.muscleMass,
        bmr: weightData.bmr,
        imageBase64ToSave: imageBase64,
        clientTimestamp: captureTimestamp || new Date().toISOString(),
        clientTimezoneOffset: new Date().getTimezoneOffset(),
        captureId: foodCaptureIdRef.current || undefined,
        // Add selected club location
        latitude: attendance.latitude,
        longitude: attendance.longitude,
        attendanceType: "club",
        nutritionCenterId: selectedCenter.id,
        centerName: selectedCenter.center_name,
      };

      // Reverse-geocode to city + village
      const { city, village } = await fetchCityVillage(
        attendance.latitude,
        attendance.longitude,
      );
      payload.city = city;
      payload.village = village;

      // Continue with weight save
      try {
        const response = await fetch(`${apiBaseUrl}/api/weight/save`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          debugLog("? Weight validation failed:", data.validation);
          setAlertModal({
            isOpen: true,
            title: data.validation?.title || "Weight Entry Issue",
            message:
              data.validation?.message ||
              data.message ||
              "Failed to save weight entry",
            type: data.validation?.severity || "warning",
          });
          setSaveLoading(false);
          setLoadingState("idle");
          setPendingWeightData(null);
          return;
        }

        debugLog("? Weight entry saved successfully:", data.id);

        if (data?.id) {
          setSavedWeightId(data.id);
          savedWeightIdRef.current = data.id;
        }

        setSaveLoading(false);
        setLoadingState("idle");
        setPendingWeightData(null);

        handleLeaderboardRefresh();
        await triggerReverseProgressModal(userId, data?.id || null);
      } catch (error) {
        console.error("? Error saving weight:", error);
        setAlertModal({
          isOpen: true,
          title: "Save Failed",
          message: "Failed to save weight entry. Please try again.",
          type: "error",
        });
        setSaveLoading(false);
        setLoadingState("idle");
        setPendingWeightData(null);
      }
      return;
    }

    // Handle food save
    if (pendingFoodData) {
      setSaveLoading(true);
      setLoadingState("saving");

      const { saveData, attendance, captureId } = pendingFoodData;

      const clubLocationFields = {
        latitude: attendance.latitude,
        longitude: attendance.longitude,
        attendanceType: "club",
        nutritionCenterId: selectedCenter.id,
        centerName: selectedCenter.center_name,
      };

      // Reverse-geocode to city + village
      const { city, village } = await fetchCityVillage(
        attendance.latitude,
        attendance.longitude,
      );
      clubLocationFields.city = city;
      clubLocationFields.village = village;

      // Continue with food save
      try {
        const saveRes = await saveNutritionAnalysis({
          ...saveData,
          ...clubLocationFields,
          captureId: captureId || undefined,
        });

        // saveNutritionAnalysis returns data directly, not { ok, data }
        // Success is indicated by not throwing an error
        debugLog("? Nutrition analysis saved successfully:", saveRes);

        // Store meal ID for auto-save updates
        setSavedNutritionMealId(saveRes.id || saveRes.insertId);

        setSaveLoading(false);
        setLoadingState("idle");
        setPendingFoodData(null);
        setShowClubSelectionModal(false);

        // Refresh data
        handleLeaderboardRefresh();

        // Trigger nutrition refresh for home screen cards
        triggerNutritionRefresh({ immediate: true, source: "club-modal-save" });
      } catch (error) {
        console.error("? Error saving nutrition:", error);
        setAlertModal({
          isOpen: true,
          title: "Save Failed",
          message:
            error.message ||
            "Failed to save nutrition analysis. Please try again.",
          type: "error",
        });
        setSaveLoading(false);
        setLoadingState("idle");
        setPendingFoodData(null);
        setShowClubSelectionModal(false);
      }
      return;
    }
  };

  // Helper function to perform nutrition save
  const performNutritionSave = async (saveData) => {
    const saveStart = Date.now();
    try {
      debugLog("?? [App] Starting nutrition save:", {
        userId: saveData.userId,
        imagePath: saveData.imagePath,
        hasImageBase64: !!saveData.imageBase64,
      });
      setSaveLoading(true);
      // Stage 8 � performNutritionSave entered
      _ctLog(8, 'performNutritionSave entered', {
        userId: saveData.userId,
        hasImageBase64: !!saveData.imageBase64,
        hasCaptureTimestamp: !!saveData.captureTimestamp,
      });

      // Await the captures POST if it hasn't resolved yet, so captureId is
      // always populated before saveNutritionAnalysis fires.  Without this,
      // a fast Gemini response races ahead of a slow /captures network call
      // and captureId arrives as null ? the backend INSERTs a new row instead
      // of UPDATing the pre-created pending row ? two records in the DB.
      if (pendingSharePromiseRef.current) {
        const share = await pendingSharePromiseRef.current;
        if (share && !foodCaptureIdRef.current) {
          foodCaptureIdRef.current = share.id;
        }
        pendingSharePromiseRef.current = null;
      }
      // Stage 9 � pendingSharePromise resolved (captureId now settled)
      _ctLog(9, 'pendingSharePromise settled', {
        captureIdAfterSettle: foodCaptureIdRef.current ?? 'null',
        pendingShareRefCleared: pendingSharePromiseRef.current == null,
      });

      // Capture GPS location for every food photo � not just when inside a club.
      // Raw lat/lng + city/village are always recorded; club fields added when nearby.
      // Hard-capped at GPS_TIMEOUT_MS so the DB write is never blocked longer than
      // that. The internal Geolocation timeout is 15 s which is too long � a cold GPS
      // lock can delay triggerNutritionRefresh by 15 s and leave the Dashboard empty.
      const GPS_TIMEOUT_MS = 5_000; // 5 s max wait; fall back to remote on timeout
      let clubLocationFields = {};
      let attendance;
      // Stage 10 � GPS started
      const _gpsStart = Date.now();
      _ctLog(10, 'GPS started', { GPS_TIMEOUT_MS });
      try {
        attendance = await Promise.race([
          locationAttendanceService.determineAttendance(
            apiBaseUrl,
            saveData.userId,
          ),
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  attendanceType: "remote",
                  latitude: null,
                  longitude: null,
                  nutritionCenterId: null,
                  nearbyCenters: [],
                }),
              GPS_TIMEOUT_MS,
            ),
          ),
        ]);
        // Stage 11 � GPS finished
        _ctLog(11, 'GPS finished', {
          attendanceType: attendance?.attendanceType,
          hasCoords: !!(attendance?.latitude && attendance?.longitude),
          gpsLatencyMs: Date.now() - _gpsStart,
          timedOut: (Date.now() - _gpsStart) >= GPS_TIMEOUT_MS,
        });
        debugLog("?? [nutrition] Attendance determined:", attendance);

        // If multiple clubs detected, auto-select the closest one (first in array)
        if (attendance.nearbyCenters && attendance.nearbyCenters.length > 1) {
          debugLog(
            "?? [nutrition] Multiple clubs detected, auto-selecting closest club",
          );
          const closestClub = attendance.nearbyCenters[0];
          debugLog(
            "? [nutrition] Auto-selected closest club:",
            closestClub.center.center_name,
            `(${Math.round(closestClub.distance)}m)`,
          );

          // Update attendance to use the closest club
          attendance.nutritionCenterId = closestClub.center.id;
          attendance.centerName = closestClub.center.center_name;
          attendance.attendanceType = "club";
        }

        // Single club or remote
        if (attendance.latitude && attendance.longitude) {
          clubLocationFields.latitude = attendance.latitude;
          clubLocationFields.longitude = attendance.longitude;
          clubLocationFields.attendanceType = attendance.attendanceType;
          clubLocationFields.nutritionCenterId =
            attendance.nutritionCenterId || null;
          clubLocationFields.centerName = attendance.centerName || null;
          debugLog(
            "?? [nutrition] Location attached to save payload:",
            attendance,
          );

          // Reverse-geocode to city + village
          const { city, village } = await fetchCityVillage(
            attendance.latitude,
            attendance.longitude,
          );
          clubLocationFields.city = city;
          clubLocationFields.village = village;
        }
      } catch (gpsErr) {
        debugLog(
          "?? [nutrition] GPS check failed, saving without location:",
          gpsErr.message,
        );
        clubLocationFields.attendanceType = "remote";
      }

      const saveRes = await saveNutritionAnalysis({
        ...saveData,
        ...clubLocationFields,
        // Pass captureId so the backend updates the pre-created pending row
        // instead of inserting a duplicate.  Reset the ref immediately after
        // so a retry cannot accidentally reuse the same row.
        captureId: foodCaptureIdRef.current || undefined,
      });
      foodCaptureIdRef.current = null;
      debugLog("? [App] Save successful:", saveRes);
      debugLog(`?? [PERF] Database save: ${Date.now() - saveStart}ms`);

      // Stage 13 � backend response received (DB write committed)
      _ctLog(13, 'backend response received (DB committed)', {
        foodRowId: saveRes?.id ?? saveRes?.insertId ?? null,
        success: saveRes?.success ?? true,
        saveLatencyMs: Date.now() - saveStart,
      });

      if (process.env.NODE_ENV !== "production") {
        // debugLog('? Save successful:', saveRes);
      }

      // Store meal ID for NutritionCard auto-save updates
      setSavedNutritionMealId(saveRes.id || saveRes.insertId);
      debugLog("? [App] Meal ID stored:", saveRes.id || saveRes.insertId);

      // Refresh discipline scores and leaderboards after meal save
      handleLeaderboardRefresh();

      // triggerNutritionRefresh fires ONLY after DB commit � this is the
      // single safe point. savePromiseRef will resolve after this function
      // returns, so Dashboard navigation that awaited it sees committed data.

      // Signal HomeNutritionCarousel to re-fetch today's stats live.
      // Stage 14 � triggerNutritionRefresh about to be called
      _ctLog(14, 'triggerNutritionRefresh called', {
        source: 'camera-save',
        foodRowId: saveRes?.id ?? saveRes?.insertId ?? null,
      });
      triggerNutritionRefresh({ immediate: true, source: "camera-save" });

      // ? ANDROID FIX: Don't auto-show popup - data is saved silently
      // Users can view saved data from Dashboard/Insights button
    } catch (err) {
      console.error("? [App] Save failed:", err);
      console.error("? [App] Error message:", err.message);
      console.error("? [App] Error stack:", err.stack);
      const friendlySaveError = getFriendlyErrorMessage(err);
      setSaveError(friendlySaveError);
      throw err;
    } finally {
      setSaveLoading(false);
      debugLog("? [App] Save loading finished");
    }
  };

  // Club/GPS lookup + DB persist after food analysis � runs in the background
  // so the Share button is available as soon as nutritionData is set.
  const scheduleNutritionSaveInBackground = ({
    user: saveUser,
    file: saveFile,
    processedImage: saveProcessedImage,
    analysisResult,
    exifTimestamp: saveExifTimestamp,
  }) => {
    setLoadingState("saving");

    // Return the Promise so callers can store it in savePromiseRef and await
    // it before opening the Dashboard. The IIFE catches all errors internally,
    // so this Promise always resolves (never rejects). Callers do not need
    // .catch() but .finally() is used to clear savePromiseRef when done.
    return (async () => {
      try {
        if (!saveUser) {
          throw new Error("Please sign in to save nutrition data");
        }

        let actualUserId = saveUser?.id;
        if (!actualUserId) {
          actualUserId = await getUserId(saveUser);
        }
        if (!actualUserId) {
          throw new Error(
            "Unable to resolve user account. Please try again or contact support.",
          );
        }

        const savePayload = {
          userId: actualUserId,
          imagePath: saveFile.name,
          imageBase64: saveProcessedImage,
          analysisResult,
          deviceInfo: window.navigator.userAgent,
          userEmail: saveUser?.email || saveUser?.Email || "unknown",
          captureTimestamp: saveExifTimestamp || null,
        };

        let duplicateCheck;
        try {
          duplicateCheck =
            await duplicateDetectionService.checkForDuplicateFood({
              userId: actualUserId,
              analysisResult,
            });
        } catch (duplicateError) {
          console.error(
            "Duplicate check failed, proceeding with save:",
            duplicateError,
          );
          await performNutritionSave(savePayload);
          return;
        }

        if (!duplicateCheck || typeof duplicateCheck !== "object") {
          console.warn(
            "Invalid duplicate check response, proceeding with save",
          );
          await performNutritionSave(savePayload);
          return;
        }

        if (false && duplicateCheck.isDuplicate) {
          debugLog("?? Duplicate food detected:", duplicateCheck);
          setDuplicateInfo(duplicateCheck);
          setPendingSaveData(savePayload);
          setShowDuplicateModal(true);
          setSaveLoading(false);
        } else {
          await performNutritionSave(savePayload);
        }
      } catch (err) {
        console.error("? Save failed:", err?.message || err);
        setSaveError(getFriendlyErrorMessage(err));
        setSaveLoading(false);
        // Trigger a refresh even on failure: a partial write (food row inserted
        // but capture promotion failed) leaves data in DB that the Dashboard
        // should discover. If nothing was written the fetch returns the same
        // empty result � no harm done.
        triggerNutritionRefresh({ immediate: true, source: "camera-save-error" });
      }
    })(); // void � caller captures the returned promise into savePromiseRef
  };

  // Handle duplicate modal confirmation
  const handleDuplicateConfirm = async () => {
    // Edge case: Prevent double-click/double-tap
    if (!showDuplicateModal) {
      console.warn("Duplicate confirm called but modal already closed");
      return;
    }

    // Edge case: No pending data (shouldn't happen but be safe)
    if (!pendingSaveData) {
      console.error("No pending save data found");
      setShowDuplicateModal(false);
      setSaveLoading(false);
      return;
    }

    // Edge case: Validate pending data structure
    if (!pendingSaveData.userId || !pendingSaveData.analysisResult) {
      console.error("Invalid pending save data:", pendingSaveData);
      setShowDuplicateModal(false);
      setSaveLoading(false);
      setPendingSaveData(null);
      setDuplicateInfo(null);
      return;
    }

    try {
      await performNutritionSave(pendingSaveData);
    } catch (err) {
      // Error already handled in performNutritionSave
      console.error("Error during duplicate confirm save:", err);
    } finally {
      // Close modal and cleanup state after save completes
      setShowDuplicateModal(false);
      setPendingSaveData(null);
      setDuplicateInfo(null);
    }
  };

  // Handle duplicate modal cancellation
  const handleDuplicateCancel = () => {
    // Edge case: Prevent double-click/double-tap
    if (!showDuplicateModal) {
      console.warn("Duplicate cancel called but modal already closed");
      return;
    }

    setShowDuplicateModal(false);
    setPendingSaveData(null);
    setDuplicateInfo(null);
    setSaveLoading(false);

    // Clear the analysis and image to allow new upload
    // Edge case: Check if states exist before clearing
    if (nutritionData) setNutritionData(null);
    if (imagePreview) setImagePreview(null);
    if (selectedImage) setSelectedImage(null);

    // Reset ALL file inputs to allow selecting the same image again
    if (fileInputRef.current && fileInputRef.current.resetInputs) {
      fileInputRef.current.resetInputs();
    }
  };

  // Handle duplicate weight modal confirmation
  const handleDuplicateWeightConfirm = async () => {
    if (pendingWeightSaveData) {
      try {
        setSaveLoading(true); // Show saving overlay
        setLoadingState("saving");
        // Use cached userId from pendingWeightSaveData
        await performWeightSave(
          pendingWeightSaveData.weightData,
          pendingWeightSaveData.imageBase64,
          pendingWeightSaveData.userId,
          pendingWeightSaveData.captureTimestamp || null,
        );
      } catch (err) {
        console.error(
          "? Weight save error after duplicate confirmation:",
          err,
        );
      } finally {
        // Close modal and reset state after save completes
        setShowDuplicateWeightModal(false);
        setPendingWeightSaveData(null);
        setDuplicateWeightInfo(null);
      }
    }
  };

  // Handle duplicate weight modal cancellation
  const handleDuplicateWeightCancel = () => {
    setShowDuplicateWeightModal(false);
    setPendingWeightSaveData(null);
    setDuplicateWeightInfo(null);
    setLoading(false);

    // Clear the weight data and image to allow new upload
    setWeightResult(null);
    setPendingWeightImage(null);
    setWeightEntrySaved(false);
    setSavedWeightId(null);
    savedWeightIdRef.current = null;
    setImagePreview(null);
    setSelectedImage(null);

    // Reset ALL file inputs to allow selecting the same image again
    if (fileInputRef.current && fileInputRef.current.resetInputs) {
      fileInputRef.current.resetInputs();
    }
  };

  const handleImageSelect = async (file, exifTimestamp = null) => {
    if (imageProcessingInProgress.current) {
      debugLog("Image processing already in progress, skipping duplicate call");
      return;
    }
    imageProcessingInProgress.current = true;

    // ?? [BUG 1 FIX] Snapchat-style overlay must mount BEFORE any setState
    // below, otherwise React commits a home-screen render during the
    // FileReader await (~100�300ms flash). URL.createObjectURL is fully
    // synchronous ? the overlay paints on the SAME frame this function is
    // called, so the home screen is never visible. The object URL is
    // revoked when the overlay is cleared (in the share .then / safety
    // timeout below) to avoid the memory leak.
    // ? INSTANT SHARE � generate token synchronously so the share sheet
    // fires on the exact same tick the overlay paints. All async operations
    // (checkUserStatus, validateImageFreshness, FileReader, compressImage)
    // that used to add 2�4 s of delay now run AFTER the share is already open.
    const instantToken = crypto.randomUUID();
    const generateInstantShareCode = (length = 8) => {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
      let out = "";
      for (let i = 0; i < length; i += 1) {
        out += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return out;
    };
    const instantShareCode = generateInstantShareCode();
    const shareDisplayName = resolveShareDisplayName(savedUserName, user);
    const instantShareUrl = `${apiBaseUrl}/share/${instantShareCode}`;
    const shareText = `${shareDisplayName} � Wellness Valley ${getVersionString()}\n?? Tap to view ?\n${instantShareUrl}`;

    // ? Kick off FileReader NOW � before overlay paints � so it runs during
    // the React commit phase (~16ms). By the time the share IIFE awaits it,
    // the read is typically already done: net delay � 0ms on the share sheet.
    const fileDataUrlPromise =
      Capacitor.isNativePlatform() && file
        ? new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          })
        : null;

    // Check user preference for auto-share BEFORE creating overlay
    const autoShareEnabled =
      localStorage.getItem("autoShareOnCapture") !== "false";

    // Flag set here so the later share-fire block (post-compression) is skipped.
    foodAutoSharedRef.current = false;

    // Only create share overlay and fire share sheet if auto-share is enabled
    if (autoShareEnabled) {
      try {
        if (file && typeof URL?.createObjectURL === "function") {
          const objectUrl = URL.createObjectURL(file);
          setSharingPendingImage(objectUrl);
        }
      } catch (_) {
        /* non-fatal � overlay is a UX nicety */
      }
    }

    // Fire share sheet � overlay is now painted (if auto-share enabled) (if auto-share enabled).
    // On native: await the pre-started FileReader (� 0ms extra wait) then
    // call shareViaCapacitorAPI so the ACTUAL PHOTO appears inline in
    // WhatsApp, not just an OG preview card.
    // On web: fall back to text+URL share.
    if (autoShareEnabled && !foodAutoSharedRef.current) {
      foodAutoSharedRef.current = true;
      const clearOverlayNow = () => {
        setSharingPendingImage((prev) => {
          if (prev && prev.startsWith("blob:")) {
            try {
              URL.revokeObjectURL(prev);
            } catch (_) {}
          }
          return null;
        });
        if (sharingPendingTimerRef.current) {
          clearTimeout(sharingPendingTimerRef.current);
          sharingPendingTimerRef.current = null;
        }
      };
      (async () => {
        try {
          if (fileDataUrlPromise) {
            // FileReader started before overlay � usually already resolved.
            const fileDataUrl = await fileDataUrlPromise;
            const result = await shareViaCapacitorAPI(fileDataUrl, {
              title: shareDisplayName,
              text: shareText,
              fileName: `wellness-meal-${Date.now()}.jpg`,
            });
            _hasCompletedFirstShareRef.current = true;
            if (!result?.ok && !result?.dismissed)
              foodAutoSharedRef.current = false;
          } else {
            // Web fallback: text + URL only.
            const ok = await shareTextViaWhatsApp(shareText);
            _hasCompletedFirstShareRef.current = true;
            if (!ok) foodAutoSharedRef.current = false;
          }
        } catch (_) {
          // Native share failed � fall back to text-only.
          try {
            await shareTextViaWhatsApp(shareText);
            _hasCompletedFirstShareRef.current = true;
          } catch (__) {
            /* ignore */
          }
        } finally {
          clearOverlayNow();
        }
      })();
    }

    // Safety timer: last-resort fallback if the share IIFE somehow never
    // reaches its `finally` block (e.g. the JS bridge hangs indefinitely).
    // 120 s is intentionally long � clearOverlayNow() in the `finally` block
    // always cancels this before it fires under normal operation.
    if (sharingPendingTimerRef.current)
      clearTimeout(sharingPendingTimerRef.current);
    sharingPendingTimerRef.current = setTimeout(() => {
      setSharingPendingImage((prev) => {
        if (prev && prev.startsWith("blob:")) {
          try {
            URL.revokeObjectURL(prev);
          } catch (_) {}
        }
        return null;
      });
    }, 120000);

    // Store EXIF timestamp for education logs
    if (exifTimestamp) {
      debugLog("?? EXIF Timestamp received:", exifTimestamp);
      setImageTimestamp(exifTimestamp);
    } else {
      setImageTimestamp(null);
    }

    if (!user) {
      setError("Please sign in to analyze food images");
      imageProcessingInProgress.current = false;
      return;
    }

    // Re-check user status in real-time before analysis
    const isActive = await checkUserStatus(user);
    if (!isActive) {
      setError(
        "Your account is inactive. Please contact support to reactivate.",
      );
      imageProcessingInProgress.current = false;
      return;
    }

    // Check file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      setError(
        "?? Image file is too large. Please choose a smaller image (max 10MB).",
      );
      imageProcessingInProgress.current = false;
      return;
    }

    // ? MANUAL MODE: skip AI entirely, open best manual modal
    if (manualModeActive) {
      imageProcessingInProgress.current = false;
      openBestManualModal();
      return;
    }

    // ?? FRAUD PREVENTION: On web only ? native handles this per-source in ImageUpload
    // (native camera = always live; native gallery = checked via Capacitor photo.exif)
    if (!Capacitor.isNativePlatform()) {
      debugLog("?? Validating image freshness (web)...");
      const validation = await validateImageFreshness(file, 0);
      if (!validation.isValid) {
        console.error("? Image validation failed:", validation);
        setAlertModal({
          isOpen: true,
          title: validation.message || "Photo Not From Today",
          message:
            "Please use a photo taken today to continue. Select or capture a new image from today.",
          type: "error",
        });
        imageProcessingInProgress.current = false;
        return;
      }
      debugLog("? Image validated:", validation.message);
    }

    setSelectedImage(file);
    setError(null);
    setNutritionData(null);
    setWeightResult(null);
    setPendingWeightImage(null);
    setWeightEntrySaved(false);
    setSavedWeightId(null);
    savedWeightIdRef.current = null;
    setImageType(null);
    setSaveError(null);
    setDetectedFoodNames([]); // Clear previous detection
    setLoadingState("analyzing"); // Reset to analyzing state
    lastImageFileRef.current = file; // Store for retry
    savePromiseRef.current = null; // Clear any completed prior save

    // Stage 1 � handleImageSelect entered
    const _ct1Id = Math.random().toString(36).slice(2, 8).toUpperCase();
    captureTraceRef.current = { id: _ct1Id, t0: Date.now(), traceId: null };
    window.__captureTrace = { id: _ct1Id, t0: Date.now() };
    _ctLog(1, 'handleImageSelect entered', { fileSize: file?.size, hasExif: !!exifTimestamp });

    // ? PERFORMANCE TRACKING
    const perfStart = Date.now();
    debugLog("?? [PERF] ?? Image processing started");

    // ? ANDROID PERFORMANCE: Use async FileReader for non-blocking operation
    try {
      const readStart = Date.now();
      const imageBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      debugLog(`?? [PERF] File reading: ${Date.now() - readStart}ms`);

      // ? OPTIMIZED: Aggressive compression for faster uploads & API calls
      const compressStart = Date.now();
      const isAndroid = Capacitor.isNativePlatform();
      const imageSizeMB = imageBase64.length / (1024 * 1024);

      let processedImage = imageBase64;
      let compressionApplied = false;

      // More aggressive compression for speed (AI doesn't need high-res images)
      if (isAndroid) {
        // Android: Always compress aggressively for speed
        if (imageSizeMB > 0.3) {
          // > 300KB
          const maxWidth = 800; // Smaller = faster upload & API processing
          const quality = imageSizeMB > 2 ? 0.6 : 0.7; // Higher compression
          processedImage = await compressImage(imageBase64, quality, maxWidth);
          compressionApplied = true;
        }
      } else {
        // Web: Also compress aggressively
        if (imageSizeMB > 0.5) {
          // > 500KB
          processedImage = await compressImage(imageBase64, 0.7, 800);
          compressionApplied = true;
        }
      }

      if (compressionApplied) {
        const newSizeMB = processedImage.length / (1024 * 1024);
        debugLog(
          `?? [PERF] Compression: ${
            Date.now() - compressStart
          }ms (${imageSizeMB.toFixed(2)}MB ? ${newSizeMB.toFixed(2)}MB)`,
        );
      } else {
        debugLog(`?? [PERF] Compression skipped (${imageSizeMB.toFixed(2)}MB)`);
      }

      // Set preview and loading together to ensure overlay shows
      setImagePreview(processedImage);
      setLoading(true); // Ensure loading is true when preview shows

      // ?? [Share] Pre-create the public-share row IN PARALLEL with Gemini
      // detection. By the time we know the image is food, the share token is
      // typically already returned, so the share button appears the same
      // instant NutritionCard renders ? not several hundred ms later.
      // If the image turns out to be weight/education/smartwatch, the row is
      // simply left as a pending capture (auto-expires in 30 days) ? we never
      // surface its URL to the user.
      processedImageRef.current = processedImage;
      foodCaptureIdRef.current = null;
      setFoodShareUrl(null);
      // Note: foodAutoSharedRef.current is already true (set above when share
      // fired instantly after overlay). Do not reset it here � that would allow
      // the classification-gated share below to double-fire.

      const captureApiStart = Date.now();
      debugLog(
        `?? [PERF] ? POST /captures started (+${
          captureApiStart - perfStart
        }ms from capture start)`,
      );
      const pendingSharePromise = (async () => {
        try {
          const capUserId = user?.id || (await getUserId(user));
          if (!capUserId) return null;
          const capRes = await fetch(
            `${apiBaseUrl}/api/background-analysis/captures`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                userId: capUserId,
                imageBase64: processedImage,
                token: instantToken,
                shareCode: instantShareCode,
              }),
            },
          );
          if (!capRes.ok) {
            debugLog(
              `?? [PERF] ? POST /captures FAILED in ${
                Date.now() - captureApiStart
              }ms (status ${capRes.status})`,
            );
            return null;
          }
          const capData = await capRes.json();
          const capDuration = Date.now() - captureApiStart;
          if (capData.ok && capData.data?.id) {
            debugLog(
              `?? [PERF] ? POST /captures: ${capDuration}ms (+${
                Date.now() - perfStart
              }ms from capture start) ? token ready`,
            );
            // Stage 2 � capture row created
            _ctLog(2, 'capture row created', { captureRowId: capData.data.id, shareCode: capData.data.shareCode || capData.data.token, latencyMs: capDuration });
            return {
              id: capData.data.id,
              url: `${apiBaseUrl}/share/${
                capData.data.shareCode || capData.data.token
              }`,
            };
          }
          debugLog(
            `?? [PERF] ? POST /captures responded ok=false in ${capDuration}ms`,
          );
          return null;
        } catch (err) {
          debugLog(
            `?? [PERF] ? POST /captures THREW after ${
              Date.now() - captureApiStart
            }ms: ${err?.message || err}`,
          );
          console.warn("[Share] pre-capture failed:", err);
          return null;
        }
      })();
      // Store a reference so performNutritionSave can await this promise
      // and guarantee captureId is set before the save request goes out.
      pendingSharePromiseRef.current = pendingSharePromise;

      // -- PHASE 3 MIGRATION: single orchestrator call replaces the old
      // classifyImageTypeFast() + detectImageType() two-step chain.
      // Both calls ran 2�3 Gemini requests; orchestrate runs exactly 1.
      // The captures POST runs in parallel (pendingSharePromise above), so
      // captureId is available from foodCaptureIdRef.current by the time
      // orchestrate returns (~2 s AI latency >> ~0.3 s captures latency).

      const apiStart = Date.now();
      debugLog(
        `?? [PERF] ? Orchestrate started (+${apiStart - perfStart}ms from capture start)`,
      );

      // Resolve user ID once for the orchestrate request.
      let resolvedUserIdForOrchestrate = user?.id;
      if (!resolvedUserIdForOrchestrate) {
        try { resolvedUserIdForOrchestrate = await getUserId(user); } catch (_) {}
      }

      // Stage 3 � orchestrate request started
      _ctLog(3, 'orchestrate request started', { apiStart, userId: resolvedUserIdForOrchestrate ?? null });

      // ? PERFORMANCE: send the already-compressed image to the orchestrator
      // instead of the original camera file. On Android the original image
      // can be 4�8 MB; the compressed version is 150�300 KB � a 10�20�
      // reduction in upload size ? the single biggest latency win available.
      let fileForOrchestrate = file;
      try {
        const compressedBlob = await fetch(processedImage).then((r) => r.blob());
        fileForOrchestrate = new File(
          [compressedBlob],
          file.name || 'capture.jpg',
          { type: 'image/jpeg' },
        );
        debugLog(
          `?? [PERF] ? Using compressed file for orchestrate: ${(fileForOrchestrate.size / 1024).toFixed(0)} KB` +
          ` (original: ${(file.size / 1024).toFixed(0)} KB)`,
        );
      } catch (_) {
        // Fallback to original file if blob conversion fails.
      }

      // Start orchestrate in parallel with the already-running captures POST.
      // captureId will be read from foodCaptureIdRef.current after both settle.
      const detectedType = await orchestrateAnalyzeImage(fileForOrchestrate, {
        userId: resolvedUserIdForOrchestrate ?? null,
        // captureId intentionally omitted here � pendingSharePromise resolves
        // concurrently; idempotency is enforced at the save layer instead.
      });

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

      // Surface the share URL now that we know the image type.
      // pendingSharePromise has almost certainly resolved by now (captures POST
      // is ~200-500 ms, orchestrate is ~2 s), so this .then() fires synchronously.
      if (detectedType.type === "food") {
        pendingSharePromise.then((share) => {
          if (share) {
            foodCaptureIdRef.current = share.id;
            setFoodShareUrl(share.url);
            debugLog(
              `?? [PERF] ? Share URL surfaced to UI (+${
                Date.now() - perfStart
              }ms from capture start)`,
            );
          }
        });
      }

      // ??? Early detection: If food items detected, show them immediately
      if (
        detectedType.details?.foods &&
        detectedType.details.foods.length > 0
      ) {
        const foodNames = detectedType.details.foods.map((f) => f.name);
        debugLog(
          "??? [AI-DETECTED] Food items identified:",
          foodNames.join(", "),
        );
        setDetectedFoodNames(foodNames); // Show detected names in UI immediately
      }

      // ? PRIORITY 0: Smartwatch / fitness app screenshot ? show activity card
      if (detectedType.type === "smartwatch" && detectedType.confidence > 0.5) {
        debugLog("? Smartwatch image detected ? showing watch activity card.");
        // Resolve the real DB userId now (same pattern used everywhere in App.js)
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
        // Resolve captureId before mounting WatchActivityCard so the education
        // log row links back to the captures row (same pattern as education branch).
        let watchCaptureId = null;
        try {
          const capShare = await pendingSharePromise;
          if (capShare?.id) {
            watchCaptureId = capShare.id;
            if (!foodCaptureIdRef.current)
              foodCaptureIdRef.current = capShare.id;
          }
          // Auto-share to WhatsApp once the share URL is resolved.
          const autoShareEnabled =
            localStorage.getItem("autoShareOnCapture") !== "false";
          if (autoShareEnabled && capShare?.url && !foodAutoSharedRef.current) {
            foodAutoSharedRef.current = true;
            shareTextViaWhatsApp(capShare.url).then((ok) => {
              _hasCompletedFirstShareRef.current = true; // enable foreground-resume camera
              if (!ok) {
                foodAutoSharedRef.current = false;
              }
            });
          }
        } catch (_) {}
        setImageType("smartwatch");
        setWatchResult({
          caloriesBurned: detectedType.details?.caloriesBurned || 0,
          source: detectedType.details?.source || "Smartwatch",
          loggedAt: new Date().toISOString(),
          userId: resolvedUserId, // ? real DB id, not Firebase uid
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
        setImageType("education");

        try {
          // Use data from unified detection (no second API call needed)
          const educationData = {
            success: true,
            platform: detectedType.details.platform || "Online Meeting",
            topic: "Education Meeting",
            confidence: detectedType.confidence || 0,
            participantCount: detectedType.details.participantCount || null,
          };

          if (educationData && educationData.success) {
            debugLog("? Education data extracted:", educationData);

            setEducationResult({
              platform: educationData.platform,
              topic: educationData.topic,
              confidence: educationData.confidence,
              participantCount: educationData.participantCount,
              loggedAt: exifTimestamp || new Date().toISOString(),
            });

            // AUTO-SAVE to database immediately
            setLoadingState("saving");
            setSaveLoading(true);
            // Resolve the captures row BEFORE saving so captureId is ready.
            // We pass it as an explicit parameter instead of relying on
            // foodCaptureIdRef.current, which can be overwritten by other
            // async paths (GPS check, geocoding) between here and the fetch.
            let educationCaptureId = null;
            try {
              const capShare = await pendingSharePromise;
              if (capShare?.id) {
                educationCaptureId = capShare.id;
                // Also keep the ref in sync for other consumers.
                if (!foodCaptureIdRef.current)
                  foodCaptureIdRef.current = capShare.id;
              }
            } catch (_) {}
            // Pass exifTimestamp directly as captureTimestamp to avoid stale state read
            await saveEducationLog(
              educationData,
              processedImage,
              null,
              exifTimestamp,
              educationCaptureId,
            );
          } else {
            setError("Unable to analyze meeting screenshot. Please try again.");
          }
        } catch (err) {
          console.error("? Education analysis failed:", err);
          setError("Failed to analyze meeting screenshot: " + err.message);
        }

        // Tag the pending capture as 'education' so it is excluded from the
        // nutrition dashboard (ImageType='food' filter) but the share link
        // still resolves and routes to the education dashboard tab.
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
        // It's a weight scale - try to extract weight
        debugLog("?? Weight scale detected, extracting metrics...");
        setImageType("weight");

        // Use weight data from unified detection (no second API call needed)
        let detectedWeight;

        if (detectedType.details?.weightValue) {
          // Weight was already extracted in the unified detection call
          debugLog("? Using weight data from unified detection");
          // Normalize BMR - AI may return different casing or include units
          const rawBmr =
            detectedType.details?.bmr ??
            detectedType.details?.Bmr ??
            detectedType.details?.BMR ??
            null;
          let normalizedBmr = null;
          if (rawBmr !== undefined && rawBmr !== null) {
            // Strip non-digits and parse integer (e.g., "1500 kcal" -> 1500)
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
        } else {
          // Fallback: Weight value not extracted ? prompt user to retake
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
          // Successfully detected weight - save to database AND show result
          // debugLog('? Weight detected:', detectedWeight);

          // Convert lbs to kg if needed
          let weightToSave = { ...detectedWeight };
          if (detectedWeight.unit === "lbs") {
            debugLog(
              `?? Converting ${detectedWeight.weightValue} lbs to kg...`,
            );
            weightToSave.weightValue = weightDetectionService.convertWeight(
              detectedWeight.weightValue,
              "lbs",
              "kg",
            );
            weightToSave.unit = "kg";
            debugLog(`? Converted to ${weightToSave.weightValue} kg`);
          }

          // Don't display weight result yet - wait for successful save
          setWeightEntrySaved(false);
          setWeightDiff(null);
          setLoadingState("saving");
          setSaveLoading(true); // Show saving overlay

          // ? FIX: Set weightResult BEFORE save so card appears even if save fails
          console.log(
            "?? [DEBUG] Setting weightResult before save:",
            weightToSave,
          );
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
          "? [Image Detection] Low-confidence food � opening unknown picker",
          {
            confidence: detectedType?.confidence,
            defaulted: detectedType?.details?.defaulted,
            foodsLength: detectedType?.details?.foods?.length || 0,
            totalCalories: detectedType?.details?.total?.calories || 0,
          },
        );
        // Tag the pending capture as 'unknown' so backend listAnalyses / nutrition
        // queries skip it. The user's pick will re-tag it via the modal handler.
        updatePendingCaptureType(pendingSharePromise, "unknown");
        const aiFailedEntirely = detectedType?.details?.defaulted === true;
        if (aiFailedEntirely) {
          // Complete AI failure (network/API key/timeout) � show error.
          setError(
            "?? AI analysis could not run. Please check your internet connection and try again.",
          );
        } else if (!isFlagEnabled("ff.diary-feed")) {
          // Legacy path (diary-feed OFF): disambiguation modal.
          setUnknownCaptureModal({ open: true, pendingSharePromise });
        } else {
          // Diary-feed ON: capture is already tagged 'unknown' above.
          // It surfaces in the diary as an "Other" row where the user can
          // Retry (re-run AI), Edit (manual entry), or Delete.
          // Reset to camera so the user can take the next photo immediately;
          // they find the unidentified entry in the diary.
          showToast("?? Couldn't identify � find it in Diary ? tap to fix");
          resetCaptureUiOnly();
        }
        setLoading(false);
        return;
      }

      // It's a food image - use nutrition data from unified detection
      console.log("??? [Food Detection] Setting imageType to food");
      setImageType("food");
      // Phase 3: share URL already surfaced by the .then() registered at the
      // detectedType.type === "food" guard above (line ~5447). A second
      // .then() here is redundant � pendingSharePromise has already resolved,
      // so both callbacks fire synchronously on the microtask queue, writing
      // foodCaptureIdRef.current twice and racing with performNutritionSave's
      // null-reset. Removed to eliminate the double-write race.
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

          // ?? Update detected food names for display
          const foodNames = foods.map((f) => f.name);
          setDetectedFoodNames(foodNames);
          debugLog("??? [AI-DETECTED] Food names:", foodNames.join(", "));

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

          // Transform to format expected by NutritionCard
          result = {
            nutrition: {
              calories: Math.round(total.calories || 0),
              protein: Math.round(total.protein || 0),
              carbs: Math.round(total.carbs || 0),
              fat: Math.round(total.fat || 0),
              fiber: Math.round(total.fiber || 0),
              // Persist the AI's invisible micronutrients so the backend
              // saves TotalSugar / TotalSodium / TotalCholesterol instead
              // of NULL. See aggregateFoodTotals + bug report.
              sugar: Math.round(total.sugar || 0),
              sodium: Math.round(total.sodium || 0),
              cholesterol: Math.round(total.cholesterol || 0),
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
              // ?? Extract nutrition values from the corrected food object
              const nutritionValues = {
                calories: Math.round(
                  food.nutrition?.calories || food.calories || 0,
                ),
                protein: Math.round(
                  food.nutrition?.protein || food.protein || 0,
                ),
                carbs: Math.round(food.nutrition?.carbs || food.carbs || 0),
                fat: Math.round(food.nutrition?.fat || food.fat || 0),
                fiber: Math.round(food.nutrition?.fiber || food.fiber || 0),
                // Carry sugar/sodium/cholesterol through to the save payload
                // so they reach food_nutrition_data_table instead of NULL.
                sugar: Math.round(food.nutrition?.sugar || food.sugar || 0),
                sodium: Math.round(food.nutrition?.sodium || food.sodium || 0),
                cholesterol: Math.round(
                  food.nutrition?.cholesterol || food.cholesterol || 0,
                ),
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

          setError(errorMessage);
          // Clear share state ? the Share button must not linger when AI
          // yields no food data (e.g. Gemini quota exhausted for the day).
          setFoodShareUrl(null);
          setImageType(null);
          foodCaptureIdRef.current = null;
          pendingSharePromiseRef.current = null;
          // ? "Enter Manually" button is shown in the error card for ALL error types
          setLoading(false);
          return;
        }

        setNutritionData({
          ...result,
          loggedAt: exifTimestamp || new Date().toISOString(),
        });
        // Stage 6 � setNutritionData called (UI card about to render)
        _ctLog(6, 'setNutritionData called', {
          calories: result?.nutrition?.calories ?? null,
          itemCount: result?.itemCount ?? null,
          confidence: result?.confidence ?? null,
          source: result?.source ?? null,
        });

        // Analysis done � unlock Share immediately; club/GPS + DB save in bg.
        // Capture the returned Promise so showDashboardPage can await it.
        setLoading(false);
        // Stage 7 � scheduleNutritionSaveInBackground about to start
        _ctLog(7, 'scheduleNutritionSaveInBackground starting', {
          hasUser: !!user,
          userId: user?.id ?? null,
          hasFile: !!file,
          hasProcessedImage: !!processedImage,
        });
        const _saveP = scheduleNutritionSaveInBackground({
          user,
          file,
          processedImage,
          analysisResult: result,
          exifTimestamp,
        });
        savePromiseRef.current = _saveP;
        // Clear the ref when this specific save settles (handles rapid captures).
        _saveP.finally(() => {
          // Stage 15 � savePromise resolved (IIFE settled)
          _ctLog(15, '_saveP.finally � savePromise settled', {
            isCurrentSave: savePromiseRef.current === _saveP,
            clearingRef: savePromiseRef.current === _saveP,
          });
          if (savePromiseRef.current === _saveP) savePromiseRef.current = null;
        });
      } catch (err) {
        const friendlyMessage = getFriendlyErrorMessage(err);
        setError(friendlyMessage);
        console.error("? Gemini analysis error:", err);
      }
    } catch (err) {
      // Better error handling for undefined or missing error messages
      let errorMessage = "Unknown error occurred";
      if (err) {
        if (err.message) {
          errorMessage = err.message;
        } else if (typeof err === "string") {
          errorMessage = err;
        } else if (err.toString && err.toString() !== "[object Object]") {
          errorMessage = err.toString();
        }
      }

      // Provide more specific error messages for common Android gallery issues
      if (
        errorMessage === "Unknown error occurred" ||
        errorMessage.includes("undefined")
      ) {
        errorMessage =
          "Could not read the selected image. Please try selecting a different image or use the camera.";
      }

      // Handle iOS "Load failed" network error
      if (
        errorMessage.toLowerCase() === "load failed" ||
        errorMessage.includes("Failed to fetch")
      ) {
        setError(
          "?? Please check your internet connection (WiFi or mobile data) and try again.",
        );
      } else {
        // Don't show error box for weight validation failures (already showing custom modal)
        setError("Failed to process image: " + errorMessage);
      }
      console.error("? Image processing error:", err);
    } finally {
      setLoading(false);
      imageProcessingInProgress.current = false;
      debugLog(
        `?? [PERF] ? TOTAL PROCESSING TIME: ${Date.now() - perfStart}ms`,
      );
      debugLog("????????????????????????????????????????????");
    }
  };

  // ?? Retry food analysis with the last image
  const handleRetryAnalysis = () => {
    if (lastImageFileRef.current) {
      setError(null);
      handleImageSelect(lastImageFileRef.current);
    }
  };

  const getFriendlyErrorMessage = (error) => {
    const rawMessage = error.message || "";

    // API/Service availability errors
    if (rawMessage.includes("429") || rawMessage.includes("rate limit")) {
      return "The AI model is temporarily unavailable. Please try again later.";
    } else if (
      rawMessage.includes("503") ||
      rawMessage.includes("overloaded")
    ) {
      return "The AI model is temporarily unavailable. Please try again later.";
    } else if (
      rawMessage.includes("quota") ||
      rawMessage.includes("exceeded")
    ) {
      return "The AI model is temporarily unavailable. Please try again later.";
    } else if (rawMessage.includes("API key is not configured")) {
      return "The AI model is temporarily unavailable. Please try again later.";
    } else if (
      rawMessage.includes("models/") &&
      rawMessage.includes("not found")
    ) {
      return "The AI model is temporarily unavailable. Please try again later.";
    }

    // Network and connectivity errors
    else if (
      rawMessage.includes("network") ||
      rawMessage.includes("Failed to fetch") ||
      rawMessage.toLowerCase().includes("load failed") ||
      rawMessage.includes("timeout") ||
      rawMessage.includes("connection")
    ) {
      return "?? Please check your internet connection (WiFi or mobile data) and try again.";
    } else if (rawMessage.includes("timeout")) {
      return "?? Please check your internet connection (WiFi or mobile data) and try again.";
    } else if (rawMessage.includes("connection")) {
      return "?? Please check your internet connection (WiFi or mobile data) and try again.";
    }

    // Server errors
    else if (
      rawMessage.includes("500") ||
      rawMessage.includes("Internal Server Error")
    ) {
      return "The AI model is temporarily unavailable. Please try again later.";
    } else if (
      rawMessage.includes("Server returned an unexpected response format")
    ) {
      return "?? Unable to save your analysis right now. Your food data is still displayed above.";
    }

    // Image and analysis errors
    else if (rawMessage.includes("Image file is too large")) {
      return "?? Image file is too large. Please use a smaller photo (max 10MB).";
    } else if (rawMessage.includes("No food items detected")) {
      return "??? Could not detect food items. Please take a clear photo of your meal.";
    } else if (rawMessage.includes("Invalid response format")) {
      return "?? The AI model is temporarily unavailable. Please try again later.";
    }

    // Generic fallback
    else if (rawMessage.toLowerCase().includes("analysis")) {
      return "?? Unable to save your analysis. The nutrition data is still shown above.";
    }

    return "? Something went wrong. Please try again.";
  };

  const resetApp = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setNutritionData(null);
    setError(null);
    setUser(null);
    setIsOtpVerified(false);
    setSaveError(null);
    setLoadingState("analyzing"); // Reset loading state

    // Clear weight-related states
    setWeightResult(null);
    setPendingWeightImage(null);
    setWeightEntrySaved(false);
    setSavedWeightId(null);
    savedWeightIdRef.current = null;
    setEducationResult(null); // Clear education results
    setWatchResult(null); // Clear watch results
    setImageType(null);
    setCurrentWeightImage(null);
    setShowManualWeightModal(false);
    setShowDuplicateWeightModal(false);
    setDuplicateWeightInfo(null);
    setPendingWeightSaveData(null);

    // Clear duplicate food states
    setShowDuplicateModal(false);
    setDuplicateInfo(null);
    setPendingSaveData(null);

    Session.clearOtpVerified();
    Session.clearOtpUser();
    Session.clearCurrentPage();

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSignIn = async (forceRedirect = false) => {
    try {
      setLoading(true);
      setError(null);

      // ? User is intentionally signing in ? clear the sign-out block flags
      Session.clearUserSignedOut();
      Session.clearAccountDeleted();
      setForceLoggedOut(false);

      // Flag should already be set by Login component
      // But set it here too for redirect flow safety
      if (!sessionStorage.getItem("freshGoogleSignIn")) {
        sessionStorage.setItem("freshGoogleSignIn", "true");
      }

      // Safety timeout to clear flag if something goes wrong (30 seconds for slow sign-in)
      const safetyTimeout = setTimeout(() => {
        sessionStorage.removeItem("freshGoogleSignIn");
      }, 30000);

      const user = await signInWithGoogle(forceRedirect);
      if (user) {
        try {
          // Store user email in localStorage for API calls
          const userEmail = user.email || user.Email;
          if (userEmail) {
            Session.setUserEmail(userEmail);
            debugLog(
              "? [handleSignIn] Stored user email in localStorage:",
              userEmail,
            );
          }

          // Save user to backend first
          const saveResult = await saveUserToBackend(user);
          debugLog("?? [handleSignIn] saveResult:", saveResult);
          const isNewUser = saveResult?.isNewUser === true;
          debugLog("?? [handleSignIn] isNewUser:", isNewUser);

          // Clear the safety timeout immediately after save completes
          clearTimeout(safetyTimeout);

          // ?? CRITICAL: Check if sign-out was triggered while we were saving
          if (signOutInProgress.current) {
            sessionStorage.removeItem("freshGoogleSignIn");
            return;
          }

          // ? CRITICAL: Clear the fresh sign-in flag NOW
          // This ensures checkUserStatus will run (not skip) for user validation
          sessionStorage.removeItem("freshGoogleSignIn");

          // Now set up GalleryMonitor with the saved user
          if (Capacitor.isNativePlatform()) {
            await handleSaveUserCache(user);

            // Check again if sign-out was triggered
            if (signOutInProgress.current) {
              return;
            }
          }

          // Now check user status after ensuring DB record exists
          // Flag is cleared, so checkUserStatus will actually run the check
          const isActive = await checkUserStatus(user);

          // Check again if sign-out was triggered during status check
          if (signOutInProgress.current) {
            return;
          }

          if (isActive) {
            setUser(user);
            // -- Consume any BPC card stored pre-login (new user from deep link) --
            const bpcPendingSignIn = consumePendingCard();
            if (bpcPendingSignIn?._token && user?.id) {
              import("./features/body-parameters-card").then(
                ({ saveCardToProfile }) => {
                  saveCardToProfile(bpcPendingSignIn._token, user.id).catch(
                    () => {},
                  );
                },
              );
              debugLog(
                "? [BPC] Consumed pending card on first sign-in, height+BMR saved",
              );
            }
            // Check mandatory profile fields (covers both new and returning users)
            const userEmail = user.email || user.Email;
            if (userEmail) {
              setTimeout(() => {
                checkProfileCompletion(userEmail);
                // After profile completion check, check for profile picture
                setTimeout(() => checkProfilePicture(user), 800);
              }, 600);
            }
            if (isNewUser) {
              debugLog("?? [handleSignIn] New user detected");
            }
          } else {
            // User was saved but is inactive or not found - modal will show
            setUser(user); // Keep user state so modal can show user email
          }
        } catch (saveError) {
          // If save fails, still allow user to proceed (fail-open for backend issues)
          console.error(
            "?? Backend save/check failed, allowing user access:",
            saveError,
          );
          setError(
            "Warning: Could not verify account status. You can still use the app.",
          );
          setUser(user); // Allow access despite backend failure
          clearTimeout(safetyTimeout); // Clear timeout even on error
          sessionStorage.removeItem("freshGoogleSignIn"); // Clean up flag
        }

        // Flag is already cleared above - no need to clear again
      } else {
        debugLog("?? Redirect initiated, waiting for result...");
        // Don't clear timeout yet for redirect flow
      }
    } catch (error) {
      console.error("? Sign in error:", error);
      sessionStorage.removeItem("freshGoogleSignIn"); // Clean up on error

      if (error.code === "auth/popup-blocked") {
        setError(
          "Popup blocked by your browser. Please enable popups for this site in your browser settings, then try again.",
        );
        setLoading(false);
        return;
      }

      if (error.message?.includes("Popup was blocked")) {
        setError(
          "Popup blocked. Please enable popups for this site in your browser settings.",
        );
        setLoading(false);
        return;
      }

      if (error.code === "auth/popup-closed-by-user") {
        setError("Sign-in popup was closed. Please try again.");
        setLoading(false);
        return;
      }
      setError(getAuthErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handlePopupSignIn = async () => {
    try {
      setLoading(true);
      setError(null);

      // ? User is intentionally signing in ? clear the sign-out block flags
      Session.clearUserSignedOut();
      Session.clearAccountDeleted();
      setForceLoggedOut(false);

      // Flag is already set by Login component before this function is called
      // Safety timeout to clear flag if something goes wrong (30 seconds for slow sign-in)
      const safetyTimeout = setTimeout(() => {
        sessionStorage.removeItem("freshGoogleSignIn");
      }, 30000);

      const user = await signInWithGooglePopup();

      if (user) {
        try {
          // Store user email in localStorage for API calls
          const userEmail = user.email || user.Email;
          if (userEmail) {
            Session.setUserEmail(userEmail);
            debugLog(
              "? [handlePopupSignIn] Stored user email in localStorage:",
              userEmail,
            );
          }

          // Save user to backend first
          const saveResult = await saveUserToBackend(user);
          debugLog("?? [handlePopupSignIn] saveResult:", saveResult);
          const isNewUser = saveResult?.isNewUser === true;
          debugLog("?? [handlePopupSignIn] isNewUser:", isNewUser);

          // Clear the safety timeout immediately after save completes
          clearTimeout(safetyTimeout);

          // ?? CRITICAL: Check if sign-out was triggered while we were saving
          if (signOutInProgress.current) {
            sessionStorage.removeItem("freshGoogleSignIn");
            return;
          }

          // ? CRITICAL: Clear the fresh sign-in flag NOW
          // This ensures checkUserStatus will run (not skip) for user validation
          sessionStorage.removeItem("freshGoogleSignIn");

          // Now set up GalleryMonitor with the saved user
          if (Capacitor.isNativePlatform()) {
            await handleSaveUserCache(user);

            // Check again if sign-out was triggered
            if (signOutInProgress.current) {
              return;
            }
          }

          // Now check user status after ensuring DB record exists
          // Flag is cleared, so checkUserStatus will actually run the check
          const isActive = await checkUserStatus(user);

          // Check again if sign-out was triggered during status check
          if (signOutInProgress.current) {
            return;
          }

          if (isActive) {
            setUser(user);
            // Check mandatory profile fields (covers both new and returning users)
            const userEmail = user.email || user.Email;
            if (userEmail) {
              setTimeout(() => {
                checkProfileCompletion(userEmail);
                // After profile completion check, check for profile picture
                setTimeout(() => checkProfilePicture(user), 800);
              }, 600);
            }
            if (isNewUser) {
              debugLog("?? [handlePopupSignIn] New user detected");
            }
          } else {
            // User was saved but is inactive or not found - modal will show
            setUser(user); // Keep user state so modal can show user email
          }
        } catch (saveError) {
          // If save fails, still allow user to proceed (fail-open for backend issues)
          console.error(
            "?? Backend save/check failed, allowing user access:",
            saveError,
          );
          setError(
            "Warning: Could not verify account status. You can still use the app.",
          );
          setUser(user); // Allow access despite backend failure
          clearTimeout(safetyTimeout); // Clear timeout even on error
          sessionStorage.removeItem("freshGoogleSignIn"); // Clean up flag
        }

        // Flag is already cleared above - no need to clear again
      }
    } catch (error) {
      console.error("? Popup sign-in error:", error);
      sessionStorage.removeItem("freshGoogleSignIn"); // Clean up on error
      setError(getAuthErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const getAuthErrorMessage = (error) => {
    switch (error.code) {
      case "auth/popup-blocked":
        return "Popup blocked by your browser. Please enable popups for this site in your browser settings.";
      case "auth/popup-closed-by-user":
        return "Sign in was cancelled. Please try again.";
      case "auth/network-request-failed":
        return "Network error. Please check your connection and try again.";
      case "auth/too-many-requests":
        return "Too many attempts. Please wait a moment and try again.";
      case "auth/user-disabled":
        return "This account has been disabled. Please contact support.";
      case "auth/developer-error":
        return "Google Sign-In setup error. Please update the app or contact support.";
      default:
        // Check for popup-related error messages
        if (error.message?.toLowerCase().includes("popup")) {
          return "Popup blocked. Please enable popups for this site in your browser settings.";
        }
        return error.message || "Authentication failed. Please try again.";
    }
  };

  const saveUserToBackend = async (user) => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/user/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          displayName: user.displayName || user.email.split("@")[0],
          photoURL: user.photoURL || null,
          uid: user.uid,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to save user: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        debugLog(
          "? [saveUserToBackend] User saved successfully, isNewUser:",
          data.isNewUser,
        );

        // If this is a new user, trigger the profile modal
        if (data.isNewUser) {
          debugLog(
            "?? [saveUserToBackend] New user detected, will show profile modal",
          );
        }
      } else {
        console.warn(
          "?? [saveUserToBackend] Save completed with warning:",
          data,
        );
      }

      return data;
    } catch (error) {
      console.error(
        "? [saveUserToBackend] Failed to save user to backend:",
        error,
      );
      throw error; // Re-throw so caller can handle
    }
  };

  const handleSignOut = async () => {
    try {
      // Phase 3d-a: Observe in shadow FSM (no behaviour change).
      authFsm.send({ type: authFsm.E.SIGN_OUT_REQUESTED, reason: "user" });

      // Do NOT set loading=true here ? it would pass loading=true to Login
      // which immediately shows "Signing in..." on the Google button after sign-out.

      // Set sign-out in progress flag to prevent concurrent sign-in
      signOutInProgress.current = true;

      // ? Ensure loading is false BEFORE showing Login screen
      setLoading(false);

      // ? Set React gate FIRST ? this immediately shows Login screen
      // and blocks any Firebase re-auth callbacks from re-logging in
      setForceLoggedOut(true);

      // Clear the fresh sign-in flag immediately to prevent re-login issues
      sessionStorage.removeItem("freshGoogleSignIn");

      // Clear user context cache
      clearContextCache();
      setUserContext(null);
      setUserContextLoading(false);
      debugLog("??? [Sign Out] User context cache and state cleared");

      // Clear userId session cache
      clearUserIdCache();
      Session.clearDbUserId();
      // Clear demo meal history on sign-out
      Session.clearDemoMeals();
      // Clear profile-complete flag so a new/different user sees the gate if needed
      const emailKey = Session.getUserEmail() || "";
      Session.clearProfileComplete(emailKey);
      profileCompletedRef.current = false;
      debugLog("??? [Sign Out] UserId cache cleared");

      if (Capacitor.isNativePlatform()) {
        try {
          await GalleryMonitor.clearCurrentUser();
        } catch (clearError) {
          console.error(
            "?? Failed to clear GalleryMonitor user (method may not exist):",
            clearError,
          );
          // Continue with sign out even if this fails
        }
      }
      await signOutUser();
      // Phase 3d-a: Observe in shadow FSM (no behaviour change).
      authFsm.send({ type: authFsm.E.SIGN_OUT_COMPLETED });
      // ? Clear all auth-related localStorage keys
      Session.clearUserEmail();
      Session.clearOtpVerified();
      Session.clearOtpUser();
      Session.clearCurrentPage();
      Session.clearDbUserId();
      // ? Clear nutrition / background analysis caches so a new login never sees old images
      localStorage.removeItem("backgroundAnalyses");
      localStorage.removeItem("wellnessBuddy_lastBgNutritionId");
      localStorage.removeItem("dashboard_activeTab");
      GalleryMonitor.clearLocalBackgroundAnalyses();
      // Keep "userSignedOut" flag ? set by signOutUser() to block iOS silent re-auth
      sessionStorage.clear();
      resetApp();
    } catch (error) {
      console.error("? Sign out error:", error);
      // ? Even if signOut throws, force clear the UI so user isn't stuck
      Session.clearUserEmail();
      Session.clearOtpVerified();
      Session.clearOtpUser();
      Session.clearCurrentPage();
      Session.clearDbUserId();
      localStorage.removeItem("backgroundAnalyses");
      localStorage.removeItem("wellnessBuddy_lastBgNutritionId");
      localStorage.removeItem("dashboard_activeTab");
      try {
        GalleryMonitor.clearLocalBackgroundAnalyses();
      } catch (err) {
        debugLog(
          "[signOut] clearLocalBackgroundAnalyses failed (non-critical)",
          { err: err?.message },
        );
      }
      // Keep "userSignedOut" flag to block re-auth
      sessionStorage.clear();
      resetApp();
    } finally {
      setLoading(false);
      // Reset the sign-out flag after a longer delay on iOS to prevent re-auth
      setTimeout(() => {
        signOutInProgress.current = false;
      }, 3000);
    }
  };

  const handleOtpVerified = async (isNewUser = false) => {
    debugLog("?? [handleOtpVerified] Called with isNewUser:", isNewUser);

    // Get the OTP user from localStorage
    const otpUserRaw = Session.getOtpUserRaw();

    // Phase 3d-a: Observe in shadow FSM (no behaviour change).
    authFsm.send({
      type: authFsm.E.OTP_VERIFIED,
      isNewUser,
      email: Session.getUserEmail(),
    });

    if (otpUserRaw) {
      try {
        const parsedUser = JSON.parse(otpUserRaw);

        // DEBUG: Log the parsed user object to see what status value we're getting
        console.log("?? [handleOtpVerified] Parsed user object:", parsedUser);
        console.log("?? [handleOtpVerified] Status field:", parsedUser?.status);
        console.log(
          "?? [handleOtpVerified] Status (capital):",
          parsedUser?.Status,
        );

        // Fast-path inactive check: the verify-otp API already returns the
        // user's current Status in the stored object. If it's already
        // 'Inactive', show the Account Restricted modal immediately � do NOT
        // rely on a separate network call that can time out or fail-open.
        // Check both lowercase 'status' and capital 'Status' for compatibility
        const userStatus = (
          parsedUser?.status ||
          parsedUser?.Status ||
          ""
        ).toLowerCase();
        console.log("?? [handleOtpVerified] Normalized status:", userStatus);

        if (userStatus === "inactive") {
          console.log(
            "?? [handleOtpVerified] User is inactive (fast-path check), showing restricted modal",
          );
          debugLog(
            "?? [handleOtpVerified] User is inactive (fast-path check), showing restricted modal",
          );
          authFsm.send({
            type: authFsm.E.USER_STATUS_RESOLVED,
            result: "inactive",
          });

          // CRITICAL: Set all state synchronously so React batches them and triggers ONE re-render
          // with all the correct state. The modal will render because user is set but isOtpVerified is false.
          setUser(parsedUser);
          setIsUserActive(false);
          setShowInactiveModal(true);

          console.log(
            "?? [handleOtpVerified] State set - user:",
            parsedUser.email,
            "showInactiveModal: true",
          );
          return;
        }

        // Check user status with timeout for iOS
        let isActive = true;
        try {
          const statusPromise = checkUserStatus(parsedUser);
          const timeoutPromise = new Promise((resolve) =>
            setTimeout(() => resolve(true), 5000),
          );
          isActive = await Promise.race([statusPromise, timeoutPromise]);
        } catch (statusError) {
          console.warn(
            "?? [handleOtpVerified] Status check failed, proceeding:",
            statusError,
          );
          isActive = true; // Default to active on error
        }

        if (!isActive) {
          // User is inactive � set user + mark OTP verified so the app renders
          // past the login gate and shows the InactiveUserModal (which fires in
          // checkUserStatus via setShowInactiveModal). Without isOtpVerified=true
          // the modal never renders and the user is stuck on the OTP screen.
          const userEmail = parsedUser.email || parsedUser.Email;
          if (userEmail) Session.setUserEmail(userEmail);
          Session.clearUserSignedOut();
          setForceLoggedOut(false);
          setUser(parsedUser);
          setIsOtpVerified(true);
          Session.markOtpVerified();
          return;
        }

        setIsOtpVerified(true);
        Session.markOtpVerified();

        // ? User is logging in via OTP ? clear the sign-out gate
        Session.clearUserSignedOut();
        setForceLoggedOut(false);

        // Store user email in localStorage for API calls
        const userEmail = parsedUser.email || parsedUser.Email;
        if (userEmail) {
          Session.setUserEmail(userEmail);
          debugLog(
            "? [handleOtpVerified] Stored user email in localStorage:",
            userEmail,
          );
        }

        setUser(parsedUser);

        // Check profile completion for all users ? new users will always have missing
        // fields and the CompleteProfilePage gate will show. The SetupWizard handles
        // coach/team linking (a separate flow), not personal detail collection.
        if (userEmail) {
          await checkProfileCompletion(userEmail, parsedUser);
        }
      } catch (error) {
        console.error("Failed to check OTP user status:", error);
        // On iOS, if everything fails, still try to log in
        Session.clearUserSignedOut();
        setForceLoggedOut(false);
        setIsOtpVerified(true);
        Session.markOtpVerified();
      }
    } else {
      // No OTP user found, proceed with verification
      Session.clearUserSignedOut();
      Session.clearAccountDeleted();
      setForceLoggedOut(false);
      setIsOtpVerified(true);
      Session.markOtpVerified();
    }
  };

  // useDeferredValue for lazy pages ? must be declared BEFORE any early returns (Rules of Hooks)
  const deferredShowDashboard = useDeferredValue(showDashboard);
  const deferredShowWellnessCounselling = useDeferredValue(
    showWellnessCounselling,
  );

  // [BUG 3 FIX] No full-screen loading spinners anywhere. New installs and
  // returning users alike fall straight through to Login / Home. The native
  // Capacitor splash already covers app cold-start; once React mounts we go
  // directly to the correct route. Background auth/profile checks continue
  // silently � they just don't show a UI spinner.

  // -------------------------------------------------------------------------
  // HIGHEST PRIORITY: Show waiting modal if contacting coach
  // This MUST be before ALL other render branches so nothing can block it
  // -------------------------------------------------------------------------
  if (isWaitingForCoachOTP) {
    console.log("? [RENDER] Showing waiting modal (highest priority)");
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 999999,
          background: "rgba(0,0,0,0.75)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px",
        }}
        ref={(el) => {
          if (el)
            console.log("??? [Waiting Modal] RENDERED AS TOP-LEVEL ???");
        }}
      >
        <div
          style={{
            background: "white",
            borderRadius: "20px",
            padding: "40px",
            maxWidth: "400px",
            width: "100%",
            textAlign: "center",
            boxShadow: "0 25px 50px rgba(0,0,0,0.4)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: "28px",
            }}
          >
            <div
              style={{
                width: "72px",
                height: "72px",
                border: "5px solid #22c55e",
                borderTopColor: "transparent",
                borderRadius: "50%",
                animation: "wv-spin 1s linear infinite",
              }}
            ></div>
          </div>
          <h2
            style={{
              fontSize: "26px",
              fontWeight: "bold",
              color: "#111827",
              marginBottom: "14px",
            }}
          >
            Contacting Your Coach...
          </h2>
          <p
            style={{
              color: "#6b7280",
              fontSize: "16px",
              lineHeight: "1.7",
              margin: 0,
            }}
          >
            We've sent a request to your coach. Please wait while we prepare the
            verification screen.
          </p>
        </div>
        <style>{`@keyframes wv-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }
  // -------------------------------------------------------------------------

  // CRITICAL: Render Inactive User Modal at the TOP, before any early returns
  // This ensures it shows even if we're stuck in a loading state
  const inactiveModalPortal = showInactiveModal ? (
    <InactiveUserModal
      userEmail={
        user?.email || user?.Email || Session.getUserEmail() || "your account"
      }
      onClose={handleInactiveModalClose}
      onContactCoach={handleContactCoach}
    />
  ) : null;

  if (authLoading) {
    // On native, show the logo overlay instead of a blank screen � the native
    // splash may have already faded, so returning null would show white.
    console.log("?? [RENDER] Blocked by authLoading");
    if (Capacitor.isNativePlatform()) {
      return (
        <>
          {inactiveModalPortal}
          <div
            aria-hidden="true"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 10000,
              background: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <img
              src="/logo.png"
              alt=""
              style={{ width: 120, height: 120, objectFit: "contain" }}
            />
          </div>
        </>
      );
    }
    return inactiveModalPortal;
  }

  // ? OTP user restore in progress � stay invisible until restored.
  if (isOtpVerified && !user) {
    console.log("?? [RENDER] Blocked by OTP restore (isOtpVerified && !user)");
    if (Capacitor.isNativePlatform()) {
      return (
        <>
          {inactiveModalPortal}
          <div
            aria-hidden="true"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 10000,
              background: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <img
              src="/logo.png"
              alt=""
              style={{ width: 120, height: 120, objectFit: "contain" }}
            />
          </div>
        </>
      );
    }
    return inactiveModalPortal;
  }

  // ? Profile check in progress � stay invisible until check is done.
  if (profileChecking) {
    console.log("?? [RENDER] Blocked by profileChecking");
    if (Capacitor.isNativePlatform()) {
      return (
        <>
          {inactiveModalPortal}
          <div
            aria-hidden="true"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 10000,
              background: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <img
              src="/logo.png"
              alt=""
              style={{ width: 120, height: 120, objectFit: "contain" }}
            />
          </div>
        </>
      );
    }
    return inactiveModalPortal;
  }

  // ? iOS Sign-out gate: user explicitly signed out ? always show Login
  // This prevents Firebase silent re-auth from bypassing the logout
  if (forceLoggedOut) {
    return (
      <>
        {inactiveModalPortal}
        <Login
          onSignIn={isMobileDevice() ? handleSignIn : handlePopupSignIn}
          loading={loading}
          error={error}
          onOtpVerified={handleOtpVerified}
        />
      </>
    );
  }

  // Authentication flow
  if (!user && !isOtpVerified) {
    console.log("?? [Render] Condition 1: !user && !isOtpVerified", {
      user,
      isOtpVerified,
      showInactiveModal,
    });
    return (
      <>
        <Login
          onSignIn={isMobileDevice() ? handleSignIn : handlePopupSignIn}
          loading={loading}
          error={error}
          onOtpVerified={handleOtpVerified}
        />
        {showInactiveModal && (
          <InactiveUserModal
            userEmail={
              user?.email ||
              user?.Email ||
              Session.getUserEmail() ||
              "your account"
            }
            onClose={handleInactiveModalClose}
            onContactCoach={handleContactCoach}
          />
        )}
        {showUserNotFoundModal && (
          <UserNotFoundModal
            userEmail={user?.email || user?.Email || "your account"}
            onClose={handleUserNotFoundModalClose}
          />
        )}
        {isWaitingForCoachOTP &&
          ReactDOM.createPortal(
            <div
              data-waiting-modal="true"
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 999999,
                background: "rgba(0,0,0,0.7)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "16px",
                backdropFilter: "blur(8px)",
              }}
              ref={(el) => {
                if (el)
                  console.log(
                    "??? [Waiting Modal] DOM RENDERED (branch1) ???",
                  );
              }}
            >
              <div
                style={{
                  background: "white",
                  borderRadius: "16px",
                  padding: "32px",
                  maxWidth: "400px",
                  width: "100%",
                  textAlign: "center",
                  boxShadow: "0 25px 50px rgba(0,0,0,0.3)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    marginBottom: "24px",
                  }}
                >
                  <div
                    style={{
                      width: "64px",
                      height: "64px",
                      border: "4px solid #22c55e",
                      borderTopColor: "transparent",
                      borderRadius: "50%",
                      animation: "spin 1s linear infinite",
                    }}
                  ></div>
                </div>
                <h2
                  style={{
                    fontSize: "24px",
                    fontWeight: "bold",
                    color: "#111",
                    marginBottom: "12px",
                  }}
                >
                  Contacting Your Coach...
                </h2>
                <p
                  style={{ color: "#666", fontSize: "16px", lineHeight: "1.6" }}
                >
                  We've sent a request to your coach. Please wait while we
                  prepare the verification screen.
                </p>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            </div>,
            document.body,
          )}
      </>
    );
  }
  const isGoogleUserCheck = user && isGoogleUser(user);
  console.log("?? [Render] Checking Google user", {
    user: !!user,
    isOtpVerified,
    isGoogleUserCheck,
    showInactiveModal,
  });

  if (!isOtpVerified && !isGoogleUserCheck) {
    console.log(
      "?? [Render] Condition 2: !isOtpVerified && !isGoogleUserCheck",
    );
    return (
      <>
        <Login
          onSignIn={isMobileDevice() ? handleSignIn : handlePopupSignIn}
          loading={loading}
          error={error}
          onOtpVerified={handleOtpVerified}
        />
        {showInactiveModal && (
          <InactiveUserModal
            userEmail={
              user?.email ||
              user?.Email ||
              Session.getUserEmail() ||
              "your account"
            }
            onClose={handleInactiveModalClose}
            onContactCoach={handleContactCoach}
          />
        )}
        {showUserNotFoundModal && (
          <UserNotFoundModal
            userEmail={user?.email || user?.Email || "your account"}
            onClose={handleUserNotFoundModalClose}
          />
        )}
        {/* Inactive-reactivation coach OTP screen � rendered here so isOtpVerified
            stays false and no background checkUserStatus effects re-trigger */}
        {showValidateOTP && isInactiveReactivationFlow && (
          <Suspense fallback={null}>
            <ValidateOTP
              key="reactivation"
              isReactivationFlow={true}
              onClose={() => {
                setShowValidateOTP(false);
                setIsInactiveReactivationFlow(false);
                handleSignOut();
              }}
              onSuccess={() => {
                setShowValidateOTP(false);
                setIsInactiveReactivationFlow(false);
                // Coach approved ? DB now has Status='Active' (validate-otp sets it)
                // Now it's safe to mark OTP verified and enter the app
                setIsOtpVerified(true);
                Session.markOtpVerified();
              }}
              onLogout={handleSignOut}
            />
          </Suspense>
        )}

        {/* Waiting for Coach OTP - Portal renders to document.body */}
        {isWaitingForCoachOTP &&
          ReactDOM.createPortal(
            <div
              data-waiting-modal="true"
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 999999,
                background: "rgba(0,0,0,0.7)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "16px",
                backdropFilter: "blur(8px)",
              }}
              ref={(el) => {
                if (el)
                  console.log(
                    "??? [Waiting Modal] DOM RENDERED AND VISIBLE ???",
                  );
              }}
            >
              <div
                style={{
                  background: "white",
                  borderRadius: "16px",
                  padding: "32px",
                  maxWidth: "400px",
                  width: "100%",
                  textAlign: "center",
                  boxShadow: "0 25px 50px rgba(0,0,0,0.3)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    marginBottom: "24px",
                  }}
                >
                  <div
                    style={{
                      width: "64px",
                      height: "64px",
                      border: "4px solid #22c55e",
                      borderTopColor: "transparent",
                      borderRadius: "50%",
                      animation: "spin 1s linear infinite",
                    }}
                  ></div>
                </div>
                <h2
                  style={{
                    fontSize: "24px",
                    fontWeight: "bold",
                    color: "#111",
                    marginBottom: "12px",
                  }}
                >
                  Contacting Your Coach...
                </h2>
                <p
                  style={{ color: "#666", fontSize: "16px", lineHeight: "1.6" }}
                >
                  We've sent a request to your coach. Please wait while we
                  prepare the verification screen.
                </p>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            </div>,
            document.body,
          )}
      </>
    );
  }

  // Full page dashboard with lazy loading (replaces Nutrition Dashboard, Weight Tracking, Weight Insights)
  if (deferredShowDashboard) {
    return (
      <Suspense fallback={null}>
        <Dashboard
          user={user}
          onBack={showMainPage}
          apiBaseUrl={apiBaseUrl}
          initialTab={dashboardInitialTab}
          userRole={userRole}
          bmrUpdateKey={bmrUpdateKey}
          educationRefreshKey={educationRefreshKey}
          watchBurnedCalories={watchBurnedCalories}
          initialSelectedMember={dashboardInitialSelectedMember}
          initialDate={dashboardInitialDate}
          initialMealId={dashboardInitialMealId}
        />
      </Suspense>
    );
  }

  // Wellness Counselling - Full page view
  if (deferredShowWellnessCounselling) {
    return (
      <Suspense fallback={null}>
        <WellnessCounselling
          user={user}
          onBack={() => setShowWellnessCounselling(false)}
        />
      </Suspense>
    );
  }

  // Main app interface
  return (
    <LocationGuard>
      <div
        className="h-screen w-screen bg-gradient-to-br from-green-50 to-green-100 flex flex-col overflow-hidden"
        style={{
          paddingLeft: "env(safe-area-inset-left)",
          paddingRight: "env(safe-area-inset-right)",
        }}
      >
        {/* Permission primer � shown once on first install after auth.
          Appears on top of the launch overlay so the transition is seamless:
          white launch overlay ? primer ? OS dialogs ? camera.
          After the user taps Allow (or Skip), handlePermissionsGranted fires
          permissionsReady ? camera auto-opens ? launch overlay closes. */}
        {showPermissionPrimer && (
          <PermissionPrimerModal
            onContinue={handlePermissionsGranted}
            onSkip={handlePermissionsGranted}
          />
        )}
        {/* Launch overlay � covers the home screen from app start until the
          native camera overlay appears. Looks identical to the native splash
          (white + centred logo) so the transition is seamless: native splash
          fades, our overlay is already there, then camera opens on top.
          Dismissed right before openCamera() is called (see camera effect). */}
        {showLaunchOverlay && (
          <div
            aria-hidden="true"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 10000,
              background: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <img
              src="/logo.png"
              alt=""
              style={{ width: 120, height: 120, objectFit: "contain" }}
            />
          </div>
        )}

        {/* ? Share-pending overlay � covers the home screen during the brief
          window between native-camera close and WhatsApp share-sheet open.
          Glitter animations keep the user engaged so they don't navigate away. */}
        {sharingPendingImage && (
          <>
            <style>{`
            @keyframes _wb_shimmer {
              0%   { transform: translateX(-120%) skewX(-18deg); }
              100% { transform: translateX(350%)  skewX(-18deg); }
            }
            @keyframes _wb_sparkle {
              0%   { opacity: 0; transform: translateY(0)    scale(0);   }
              15%  { opacity: 1; transform: translateY(-14px) scale(1.1); }
              75%  { opacity: 0.9; transform: translateY(-55px) scale(0.75); }
              100% { opacity: 0; transform: translateY(-75px) scale(0);   }
            }
            @keyframes _wb_glow_pulse {
              0%, 100% { box-shadow: 0 0 0 0 rgba(255,215,0,0.55), 0 0 24px 6px rgba(255,140,0,0.25); }
              50%       { box-shadow: 0 0 0 14px rgba(255,215,0,0), 0 0 40px 12px rgba(255,140,0,0.4); }
            }
            @keyframes _wb_dot {
              0%, 80%, 100% { transform: scale(0.55); opacity: 0.35; }
              40%           { transform: scale(1.05); opacity: 1; }
            }
            @keyframes _wb_pill_in {
              from { opacity: 0; transform: translateY(18px) scale(0.95); }
              to   { opacity: 1; transform: translateY(0)    scale(1);    }
            }
            @keyframes _wb_stars_spin {
              from { transform: rotate(0deg);   }
              to   { transform: rotate(360deg); }
            }
          `}</style>

            <div
              aria-hidden="true"
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 9999,
                background: "linear-gradient(160deg,#0a0a0a 0%,#111 100%)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "16px 12px 32px",
                gap: 0,
              }}
            >
              {/* -- Photo with shimmer + glow ring -- */}
              <div
                style={{
                  position: "relative",
                  maxWidth: "100%",
                  width: "100%",
                  flex: "1 1 auto",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 18,
                  animation: "_wb_glow_pulse 2s ease-in-out infinite",
                  overflow: "hidden",
                }}
              >
                <img
                  src={sharingPendingImage}
                  alt=""
                  style={{
                    maxWidth: "100%",
                    maxHeight: "100%",
                    width: "100%",
                    objectFit: "contain",
                    display: "block",
                    borderRadius: 18,
                  }}
                />

                {/* Shimmer sweep */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    overflow: "hidden",
                    borderRadius: 18,
                    pointerEvents: "none",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "45%",
                      height: "100%",
                      background:
                        "linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.22) 50%,transparent 100%)",
                      animation: "_wb_shimmer 1.7s ease-in-out infinite",
                      animationDelay: "0.4s",
                    }}
                  />
                </div>

                {/* Sparkle particles � distributed across image width */}
                {[
                  { color: "#FFD700", left: "8%", delay: 0 },
                  { color: "#FF69B4", left: "20%", delay: 0.25 },
                  { color: "#00CFFF", left: "35%", delay: 0.1 },
                  { color: "#7CFC00", left: "50%", delay: 0.45 },
                  { color: "#FFD700", left: "63%", delay: 0.15 },
                  { color: "#FF8C00", left: "76%", delay: 0.35 },
                  { color: "#E88EFF", left: "88%", delay: 0.05 },
                  { color: "#00CFFF", left: "30%", delay: 0.55 },
                  { color: "#FFD700", left: "55%", delay: 0.65 },
                  { color: "#FF69B4", left: "72%", delay: 0.3 },
                ].map((p, i) => (
                  <div
                    key={i}
                    style={{
                      position: "absolute",
                      bottom: "8%",
                      left: p.left,
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: p.color,
                      boxShadow: `0 0 6px 2px ${p.color}99`,
                      animation: `_wb_sparkle ${
                        1.3 + i * 0.12
                      }s ease-out infinite`,
                      animationDelay: `${p.delay}s`,
                      pointerEvents: "none",
                    }}
                  />
                ))}
              </div>

              {/* -- Bottom status pill -- */}
              <div
                style={{
                  marginTop: 24,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  background: "rgba(255,255,255,0.10)",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                  borderRadius: 999,
                  padding: "11px 24px",
                  border: "1px solid rgba(255,255,255,0.18)",
                  animation:
                    "_wb_pill_in 0.45s cubic-bezier(0.34,1.56,0.64,1) both",
                  animationDelay: "0.1s",
                  boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
                  flexShrink: 0,
                }}
              >
                {/* Spinning star icon */}
                <span
                  style={{
                    display: "inline-block",
                    fontSize: 20,
                    animation: "_wb_stars_spin 3s linear infinite",
                  }}
                >
                  ?
                </span>

                <span
                  style={{
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 700,
                    letterSpacing: 0.3,
                    whiteSpace: "nowrap",
                  }}
                >
                  Getting ready to share
                </span>

                {/* Bouncing dots */}
                <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: "#FFD700",
                        boxShadow: "0 0 4px 1px #FFD70088",
                        animation: "_wb_dot 1.3s ease-in-out infinite",
                        animationDelay: `${i * 0.22}s`,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
        <Header
          user={user}
          userRole={userRole}
          onShowBackgroundHistory={showDashboardPage}
          onShowWellnessEnrollment={() =>
            startTransition(() => setShowWellnessCounselling(true))
          }
          onShowWellnessCounselling={() =>
            startTransition(() => setShowWellnessCounselling(true))
          }
          onShowNutritionCentersMap={() =>
            startTransition(() => setShowNutritionCentersMap(true))
          }
          onShowRegisterCenter={null}
          onSignOut={handleSignOut}
          onLeaderboardRefresh={handleLeaderboardRefresh}
          // manualModeActive={manualModeActive}   // AI TOGGLE DISABLED
          // onToggleManualMode={toggleManualMode}  // AI TOGGLE DISABLED
          onProfileSaved={(profileData) => {
            const email = user?.email || Session.getUserEmail() || "";
            profileCompletedRef.current = false;
            checkProfileCompletion(email, null, { afterSave: true });
            // If a new BMR was saved, force NutritionDashboard to re-fetch it
            if (profileData?.bmr) {
              setBmrUpdateKey((prev) => prev + 1);
            }
          }}
        />

        {/* Weight Loss Leaderboard Strip - Configure in src/config/leaderboardConfig.js */}
        <WeightLossLeaderboard
          ref={leaderboardRef}
          apiBaseUrl={apiBaseUrl}
          topN={LEADERBOARD_CONFIG.TOP_N}
        />

        {/* Discipline Leaderboard Strip - Top 10 Discipline Champions */}
        <DisciplineLeaderboard
          ref={disciplineLeaderboardRef}
          apiBaseUrl={apiBaseUrl}
          topN={10}
        />

        <div
          className="flex-1 overflow-y-auto px-2 xs:px-3 pt-0.5 flex flex-col"
          style={{
            paddingBottom: "max(env(safe-area-inset-bottom, 0px), 16px)",
          }}
        >
          <div className="max-w-lg w-full mx-auto space-y-2 xs:space-y-3 py-1 flex-1 flex flex-col">
            {/* Back button toast message */}
            {toast.visible && (
              <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] left-1/2 transform -translate-x-1/2 bg-white text-gray-800 px-4 py-2 rounded-lg shadow-xl z-[9999] text-sm border border-gray-200 whitespace-nowrap">
                {toast.message}
              </div>
            )}

            {/* Today's Nutrition Carousel � Calories � Macros � Heart Healthy � Low Carb */}
            <HomeNutritionCarousel
              user={user}
              apiBaseUrl={apiBaseUrl}
              bmrUpdateKey={bmrUpdateKey}
              nutritionRefreshKey={nutritionRefreshKey}
            />

            <ImageUpload
              onImageSelect={handleImageSelect}
              imagePreview={imagePreview}
              loading={loading}
              loadingState={loadingState}
              imageType={imageType}
              detectedFoodNames={detectedFoodNames}
              ref={fileInputRef}
              onHelpClick={() => setShowHowToUse(!showHowToUse)}
              educationWindow={educationWindow}
              onCameraStateChange={handleCameraStateChange}
            />

            {/* No inline buttons here anymore - moved to sticky footer at bottom */}

            {error &&
              (() => {
                const isAiUnavailable = error.includes(
                  "AI model is temporarily unavailable",
                );

                if (isAiUnavailable) {
                  // Silently clear the error ? no modal shown
                  setTimeout(() => {
                    setError(null);
                    setImagePreview(null);
                    lastImageFileRef.current = null;
                  }, 0);
                  return null;
                }

                return (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl shadow-sm overflow-hidden">
                    <div className="flex items-start gap-2 px-4 pt-3 pb-2">
                      <span className="text-lg leading-none flex-shrink-0 mt-0.5">
                        ??
                      </span>
                      <p className="text-sm text-amber-800 leading-relaxed break-words flex-1">
                        {error.replace(/^[?????????????]\s*/, "")}
                      </p>
                      <button
                        onClick={() => {
                          setError(null);
                          setImagePreview(null);
                          lastImageFileRef.current = null;
                        }}
                        className="flex-shrink-0 p-1.5 rounded-lg hover:bg-black/10 transition-colors text-gray-400 hover:text-gray-600 mt-0.5"
                        aria-label="Dismiss"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>
                    {lastImageFileRef.current && (
                      <div className="px-4 pb-3">
                        <TouchFeedbackButton
                          onClick={handleRetryAnalysis}
                          className="w-full bg-green-600 text-white px-3 py-2 rounded-lg text-xs font-semibold hover:bg-green-700 active:bg-green-800 transition-colors text-center"
                        >
                          Retry
                        </TouchFeedbackButton>
                      </div>
                    )}
                  </div>
                );
              })()}

            {/* Share Image + Link button removed: auto-share fires directly
              to WhatsApp as soon as food is identified (see auto-share
              useEffect above). The analysis stays visible after the user
              returns from WhatsApp so they can review their nutrition data. */}

            {/* Hidden off-screen template captured to image for the instant-share
              button. Matches the post-analysis NutritionCard share template
              (profile header + photo) minus the nutrition breakdown. */}
            {imageType === "food" &&
              (imagePreview || processedImageRef.current) && (
                <FoodImageShareCard
                  ref={foodShareCardRef}
                  user={user}
                  savedUserName={savedUserName}
                  savedProfileImage={savedProfileImage}
                  sharePhotoBase64={sharePhotoBase64}
                  imageSrc={imagePreview || processedImageRef.current}
                />
              )}

            {imageType === "food" && nutritionData && (
              <NutritionCard
                data={nutritionData}
                onDataUpdate={(updatedData) => setNutritionData((prev) => ({ ...prev, ...updatedData }))}
                user={user}
                savedUserName={savedUserName}
                savedProfileImage={savedProfileImage}
                sharePhotoBase64={sharePhotoBase64}
                imagePreview={imagePreview}
                selectedImage={selectedImage}
                savedMealId={savedNutritionMealId}
                onClose={() => {
                  setNutritionData(null);
                  setImagePreview(null);
                  setSelectedImage(null);
                  setSavedNutritionMealId(null);
                  foodCaptureIdRef.current = null;
                  processedImageRef.current = null;
                  foodShareImageDataUrlRef.current = null;
                  setFoodShareUrl(null);
                }}
              />
            )}

            {/* Education Meeting Result */}
            {imageType === "education" && educationResult && (
              <EducationLogCard
                educationData={educationResult}
                imagePreview={imagePreview}
                user={user}
                savedUserName={savedUserName}
                savedProfileImage={savedProfileImage}
                sharePhotoBase64={sharePhotoBase64}
                onClose={() => {
                  setEducationResult(null);
                  setImagePreview(null);
                  setSelectedImage(null);
                }}
              />
            )}

            {/* Smartwatch / Fitness App Activity Result */}
            {imageType === "smartwatch" && watchResult && (
              <WatchActivityCard
                watchData={watchResult}
                imagePreview={imagePreview}
                user={user}
                apiBaseUrl={apiBaseUrl}
                onSaved={({ caloriesBurned }) => {
                  // Refresh Education tab
                  setEducationRefreshKey((k) => k + 1);
                  // Push burned calories to NutritionDashboard via Dashboard prop
                  if (caloriesBurned > 0)
                    setWatchBurnedCalories(caloriesBurned);
                }}
                onClose={() => {
                  setWatchResult(null);
                  setImagePreview(null);
                  setSelectedImage(null);
                  setImageType(null);
                }}
              />
            )}

            {/* Weight Loss Celebration - Shows confetti and joyful message on Home screen */}
            <CelebrationConfetti
              show={showWeightCelebration}
              message={weightCelebrationMessage}
              onComplete={() => {
                setShowWeightCelebration(false);
              }}
            />

            {imageType === "weight" && weightResult && (
              <>
                {/* Hidden container for sharing - includes image + card */}
                <div
                  ref={weightAnalysisShareRef}
                  className="fixed -left-[9999px] top-0"
                  style={{ position: "fixed", left: "-9999px", width: 460 }}
                >
                  <div
                    style={{
                      background: "white",
                      borderRadius: 20,
                      boxShadow: "0 10px 40px rgba(0,0,0,0.15)",
                      border: "2px solid #2dd4bf",
                    }}
                  >
                    {/* User header strip */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 16,
                        padding: "32px 28px",
                        background:
                          "linear-gradient(135deg, #0d9488 0%, #059669 100%)",
                        borderRadius: "18px 18px 0 0",
                        minHeight: 110,
                      }}
                    >
                      {/* Profile photo ? div+backgroundImage for reliable html2canvas rendering */}
                      {savedProfileImage ||
                      sharePhotoBase64 ||
                      user?.photoURL ? (
                        <div
                          style={{
                            width: 64,
                            height: 64,
                            borderRadius: "50%",
                            border: "3px solid rgba(255,255,255,0.95)",
                            backgroundImage: `url(${
                              savedProfileImage ||
                              sharePhotoBase64 ||
                              user.photoURL
                            })`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                            flexShrink: 0,
                            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 64,
                            height: 64,
                            borderRadius: "50%",
                            border: "3px solid rgba(255,255,255,0.9)",
                            background: "rgba(255,255,255,0.25)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <span
                            style={{
                              color: "white",
                              fontWeight: 800,
                              fontSize: 26,
                              lineHeight: 1,
                            }}
                          >
                            {(user?.displayName || user?.email || "U")
                              .charAt(0)
                              .toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p
                          style={{
                            color: "white",
                            fontWeight: 800,
                            fontSize: 19,
                            lineHeight: 1.2,
                            margin: "0 0 6px 0",
                          }}
                        >
                          {savedUserName ||
                            user?.displayName ||
                            user?.name ||
                            "Wellness User"}
                        </p>
                        <p
                          style={{
                            color: "rgba(187,247,236,0.95)",
                            fontSize: 13,
                            margin: 0,
                            lineHeight: 1,
                          }}
                        >
                          {new Date().toLocaleDateString(undefined, {
                            dateStyle: "medium",
                          })}{" "}
                          {new Date().toLocaleTimeString(undefined, {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      <p
                        style={{
                          color: "rgba(187,247,236,0.85)",
                          fontSize: 16,
                          margin: 0,
                          lineHeight: 1,
                          alignSelf: "flex-end",
                          flexShrink: 0,
                          fontWeight: 600,
                        }}
                      >
                        {getVersionString()}
                      </p>
                    </div>

                    {/* Weight Image for sharing */}
                    {imagePreview && (
                      <div style={{ background: "black", overflow: "hidden" }}>
                        <img
                          src={imagePreview}
                          alt="Weight Scale"
                          style={{
                            width: "100%",
                            height: 256,
                            objectFit: "contain",
                            display: "block",
                          }}
                        />
                      </div>
                    )}

                    {/* Card content for sharing - Simple and Clean */}
                    <div
                      style={{
                        background: "white",
                        padding: 32,
                        borderRadius: "0 0 18px 18px",
                      }}
                    >
                      <h2
                        style={{
                          fontSize: 24,
                          fontWeight: 700,
                          color: "#059669",
                          textAlign: "center",
                          margin: "0 0 24px 0",
                        }}
                      >
                        Weight Analysis
                      </h2>

                      <div
                        style={{
                          background: "#f5f3ff",
                          borderRadius: 16,
                          padding: 24,
                          textAlign: "center",
                        }}
                      >
                        <p
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: "#7c3aed",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            margin: "0 0 8px 0",
                          }}
                        >
                          Weight
                        </p>
                        <p
                          style={{
                            fontSize: 48,
                            fontWeight: 700,
                            color: "#6d28d9",
                            margin: 0,
                            lineHeight: 1.1,
                          }}
                        >
                          {weightResult.weightValue}
                          <span
                            style={{
                              fontSize: 22,
                              fontWeight: 400,
                              marginLeft: 8,
                            }}
                          >
                            {weightResult.unit}
                          </span>
                        </p>
                      </div>

                      {/* Ideal Weight Strip (share card) */}
                      {idealWeight && (
                        <div
                          style={{
                            marginTop: 16,
                            borderRadius: 16,
                            padding: "14px 18px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            background: "#eff6ff",
                            border: "1px solid #bfdbfe",
                          }}
                        >
                          <div>
                            <p
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                color: "#2563eb",
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                                margin: "0 0 4px 0",
                              }}
                            >
                              Ideal Weight
                            </p>
                            <p
                              style={{
                                fontSize: 11,
                                color: "#6b7280",
                                margin: 0,
                              }}
                            >
                              Based on height {idealWeight.heightCm} cm
                            </p>
                          </div>
                          <div style={{ textAlign: "right", color: "#1d4ed8" }}>
                            <p
                              style={{
                                fontSize: 22,
                                fontWeight: 700,
                                margin: 0,
                              }}
                            >
                              {(() => {
                                const current = weightResult?.weightValue;
                                const isLoss =
                                  current && current > idealWeight.value + 0.5;
                                const isGain =
                                  current && current < idealWeight.min - 0.5;
                                if (isLoss)
                                  return `${idealWeight.value} ${idealWeight.unit}`;
                                if (isGain)
                                  return `${idealWeight.min} ${idealWeight.unit}`;
                                return `${idealWeight.value} ${idealWeight.unit}`;
                              })()}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Weight Diff Strip */}
                      {weightDiff && (
                        <div
                          style={{
                            marginTop: 20,
                            borderRadius: 16,
                            padding: "14px 18px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            background:
                              weightDiff.change < 0
                                ? "#f0fdf4"
                                : weightDiff.change > 0
                                ? "#fff1f2"
                                : "#f9fafb",
                            border: `1px solid ${
                              weightDiff.change < 0
                                ? "#bbf7d0"
                                : weightDiff.change > 0
                                ? "#fecdd3"
                                : "#e5e7eb"
                            }`,
                          }}
                        >
                          <div>
                            <p
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                color: "#6b7280",
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                                margin: "0 0 4px 0",
                              }}
                            >
                              vs Previous
                            </p>
                            <p
                              style={{
                                fontSize: 16,
                                fontWeight: 700,
                                color: "#374151",
                                margin: "0 0 2px 0",
                              }}
                            >
                              {weightDiff.previous} {weightResult.unit}
                            </p>
                            <p
                              style={{
                                fontSize: 11,
                                color: "#9ca3af",
                                margin: 0,
                              }}
                            >
                              {new Date(
                                weightDiff.previousDate,
                              ).toLocaleDateString(undefined, {
                                dateStyle: "medium",
                              })}
                            </p>
                          </div>
                          <div
                            style={{
                              textAlign: "right",
                              color:
                                weightDiff.change < 0
                                  ? "#16a34a"
                                  : weightDiff.change > 0
                                  ? "#ef4444"
                                  : "#6b7280",
                            }}
                          >
                            <p
                              style={{
                                fontSize: 22,
                                fontWeight: 700,
                                margin: "0 0 2px 0",
                              }}
                            >
                              {weightDiff.change > 0
                                ? "?"
                                : weightDiff.change < 0
                                ? "?"
                                : "�"}{" "}
                              {weightDiff.change === 0
                                ? "No change"
                                : Math.abs(weightDiff.change) < 1
                                ? `${Math.round(
                                    Math.abs(weightDiff.change) * 1000,
                                  )} g`
                                : `${Math.abs(weightDiff.change).toFixed(2)} ${
                                    weightResult.unit
                                  }`}
                            </p>
                            <p
                              style={{
                                fontSize: 13,
                                fontWeight: 600,
                                margin: 0,
                              }}
                            >
                              {weightDiff.change < 0
                                ? "Lost"
                                : weightDiff.change > 0
                                ? "Gained"
                                : ""}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Visible card */}
                <div className="bg-white rounded-xl shadow-lg border-2 border-white-200 p-6">
                  <h2 className="text-xl font-bold text-green-700 flex items-center mb-4">
                    Weight Analysis
                  </h2>

                  <div className="bg-purple-50 rounded-lg p-4 border border-purple-100 text-center flex flex-col items-center">
                    <div className="flex items-center justify-between w-full mb-1">
                      <p className="text-sm text-purple-600 font-medium">
                        Weight
                      </p>
                      {!isEditingWeight && (
                        <button
                          onClick={() => {
                            setEditWeightValue(
                              String(weightResult.weightValue),
                            );
                            setWeightEditError("");
                            setIsEditingWeight(true);
                          }}
                          className="flex items-center gap-1 text-xs text-purple-500 hover:text-purple-700 transition-colors"
                          title="Edit weight"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Edit
                        </button>
                      )}
                    </div>

                    {isEditingWeight ? (
                      <div className="w-full mt-1">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={editWeightValue}
                            onChange={(e) => setEditWeightValue(e.target.value)}
                            className="flex-1 border border-purple-300 rounded-lg px-3 py-2 text-xl font-bold text-purple-700 text-center focus:outline-none focus:ring-2 focus:ring-purple-400"
                            inputMode="decimal"
                            step="0.1"
                            min="20"
                            max="300"
                            autoFocus
                          />
                          <span className="text-sm text-purple-600">
                            {weightResult.unit}
                          </span>
                        </div>
                        {weightEditError && (
                          <p className="text-xs text-red-500 mt-1 text-center">
                            {weightEditError}
                          </p>
                        )}
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={handleWeightEditSave}
                            disabled={isSavingWeightEdit}
                            className="flex-1 flex items-center justify-center gap-1 py-2 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                          >
                            {isSavingWeightEdit ? (
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Check className="w-4 h-4" />
                            )}
                            {isSavingWeightEdit ? "Saving?" : "Save"}
                          </button>
                          <button
                            onClick={() => {
                              setIsEditingWeight(false);
                              setWeightEditError("");
                            }}
                            disabled={isSavingWeightEdit}
                            className="flex-1 flex items-center justify-center gap-1 py-2 bg-gray-100 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                          >
                            <XIcon className="w-4 h-4" />
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-3xl font-bold text-purple-700">
                        {weightResult.weightValue}
                        <span className="text-lg font-normal ml-1">
                          {weightResult.unit}
                        </span>
                      </p>
                    )}
                  </div>

                  <div className="mt-3 text-center text-xs text-gray-500">
                    Logged at{" "}
                    {new Date(
                      weightResult.loggedAt || Date.now(),
                    ).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </div>

                  {/* Ideal weight (visible card) */}
                  {idealWeight && (
                    <div className="mt-3 flex items-center justify-between px-4 py-3 rounded-xl bg-blue-50 border border-blue-100">
                      <div>
                        <p className="text-xs text-blue-600 font-semibold uppercase tracking-wide">
                          Ideal Weight
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Based on height {idealWeight.heightCm} cm
                        </p>
                      </div>
                      <div className="text-blue-700 font-bold text-lg">
                        {idealWeight.value} {idealWeight.unit}
                      </div>
                    </div>
                  )}

                  {/* Weight diff vs previous entry */}
                  {weightDiff && (
                    <div
                      className={`mt-3 flex items-center justify-between px-4 py-3 rounded-xl ${
                        weightDiff.change < 0
                          ? "bg-green-50 border border-green-100"
                          : weightDiff.change > 0
                          ? "bg-red-50 border border-red-100"
                          : "bg-gray-50 border border-gray-100"
                      }`}
                    >
                      <div>
                        <p className="text-xs text-gray-500">
                          vs Previous entry
                        </p>
                        <p className="text-sm font-semibold text-gray-700">
                          {weightDiff.previous} {weightResult.unit}
                        </p>
                      </div>
                      <div
                        className={`font-bold text-lg ${
                          weightDiff.change < 0
                            ? "text-green-600"
                            : weightDiff.change > 0
                            ? "text-red-500"
                            : "text-gray-500"
                        }`}
                      >
                        {weightDiff.change > 0
                          ? "?"
                          : weightDiff.change < 0
                          ? "?"
                          : "�"}{" "}
                        {weightDiff.change === 0
                          ? "No change"
                          : `${Math.abs(weightDiff.change)} ${
                              weightResult.unit
                            }`}
                        {weightDiff.change < 0 && (
                          <span className="text-sm ml-1">??</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Share Button at Bottom - Only show if there's an image */}
                  {imagePreview && (
                    <button
                      onClick={async (e) => {
                        // Prevent event bubbling to avoid triggering parent click handlers
                        if (e) {
                          e.preventDefault();
                          e.stopPropagation();
                        }

                        if (isWeightSharing) return;
                        setIsWeightSharing(true);
                        // Yield so React paints the spinner before any heavy work.
                        await new Promise((r) => setTimeout(r, 0));
                        try {
                          const shareOpts = {
                            title: `Weight Record - ${weightResult.weightValue} ${weightResult.unit}`,
                            text: "",
                            fileName: `wellness-valley-weight-${weightResult.weightValue}${weightResult.unit}.png`,
                          };

                          // Fast path: pre-captured image (skips html2canvas).
                          const cached = cachedWeightShareDataUrlRef.current;
                          if (cached) {
                            const ok = await shareCachedDataUrl(
                              cached,
                              shareOpts,
                            );
                            if (ok) return;
                          }

                          // Fallback: capture live (slower).
                          await new Promise((resolve) =>
                            setTimeout(resolve, 100),
                          );
                          await captureAndShare(
                            weightAnalysisShareRef.current,
                            shareOpts,
                          );
                        } catch (error) {
                          console.error("Failed to share:", error);
                        } finally {
                          setIsWeightSharing(false);
                        }
                      }}
                      disabled={isWeightSharing}
                      className={`w-full mt-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all duration-200 shadow-md ${
                        isWeightSharing
                          ? "opacity-50 cursor-not-allowed"
                          : "hover:shadow-lg active:scale-[0.98]"
                      }`}
                      style={{ touchAction: "manipulation" }}
                    >
                      {isWeightSharing ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Sharing...</span>
                        </>
                      ) : (
                        <>
                          <Share2 className="w-5 h-5" />
                          <span>Share Weight</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </>
            )}

            {/* Saving Toast */}
            {saveLoading && (
              <div className="fixed bottom-0 left-0 right-0 flex justify-center z-50">
                <div className="bg-green-600 text-white px-6 py-3 rounded-t-xl shadow-lg animate-pulse font-semibold">
                  {imageType === "weight"
                    ? "Saving your weight progress..."
                    : imageType === "education"
                    ? "Saving your study session..."
                    : "Saving your nutrition analysis..."}
                </div>
              </div>
            )}

            {/* Error Toast */}
            {saveError && (
              <div className="fixed bottom-0 left-0 right-0 flex justify-center z-50">
                <div className="bg-red-600 text-white px-6 py-3 rounded-t-xl shadow-lg font-semibold">
                  {saveError}
                </div>
              </div>
            )}

            {showHowToUse && (
              <div className="bg-white rounded-xl shadow-lg border border-green-200 p-4 relative">
                {" "}
                <button
                  onClick={() => setShowHowToUse(false)}
                  className="absolute top-4 right-4 text-gray-600 text-xl hover:text-gray-800 transition-colors focus:outline-none"
                  aria-label="Close"
                >
                  {" "}
                  ?{" "}
                </button>{" "}
                <h3 className="font-semibold text-green-700 mb-2">
                  ?? How to use:
                </h3>{" "}
                <div className="space-y-3">
                  {" "}
                  <div>
                    {" "}
                    <h4 className="font-medium text-green-600 mb-1">
                      {" "}
                      ?? Image Analysis:{" "}
                    </h4>
                    <ol className="text-sm text-gray-600 space-y-1 ml-4">
                      <li>1. Take a clear photo of your food or weight</li>
                      <li>
                        2. Make sure the food or weight are well-lit and visible
                      </li>
                      <li>
                        3. View detailed nutrition breakdown for detected foods
                        or weights
                      </li>
                    </ol>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <h4 className="font-semibold text-green-700 mb-2">
                    ?? Tips for better results:
                  </h4>
                  <ul className="text-xs text-gray-600 space-y-1">
                    <li>? Take photos in good lighting conditions </li>
                    <li>? Ensure food items or weights are clearly visible</li>
                    <li>? Avoid cluttered backgrounds </li>
                    <li>
                      ? For text queries, be specific about preparation methods{" "}
                    </li>
                  </ul>
                </div>
              </div>
            )}

            {/* Spacer so page content isn't hidden behind the floating buttons */}
            <div className="min-h-[88px]" />

            {/* ?? Floating Camera & Gallery FABs � fixed so always visible */}
            {user &&
              !authLoading &&
              isOtpVerified &&
              !profileChecking &&
              !showSetupWizard &&
              !showDashboard &&
              !showRegisterCenter &&
              !showWellnessCounselling &&
              !showValidateOTP &&
              !showCompleteProfile && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-30 flex gap-5 items-end pointer-events-none">
                  {/* Gallery Button */}
                  <button
                    onClick={() => fileInputRef.current?.openGallery?.()}
                    disabled={loading}
                    className="w-14 h-14 p-0 rounded-full shadow-2xl transition-all duration-200 active:scale-90 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed pointer-events-auto"
                    title="Choose from Gallery"
                    aria-label="Gallery access"
                    style={{ filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.3))" }}
                  >
                    <img
                      src="/gallery.png"
                      alt="Gallery"
                      className="w-full h-full object-cover rounded-full pointer-events-none select-none"
                      draggable={false}
                    />
                  </button>

                  {/* Camera Button � primary, slightly larger */}
                  <button
                    onClick={() => fileInputRef.current?.openCamera?.()}
                    disabled={loading}
                    className="w-16 h-16 p-0 rounded-full shadow-2xl transition-all duration-200 active:scale-90 hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed pointer-events-auto"
                    title="Take Photo"
                    aria-label="Camera access"
                    style={{ filter: "drop-shadow(0 6px 16px rgba(0,0,0,0.35))" }}
                  >
                    <img
                      src="/app.png"
                      alt="Camera"
                      className="w-full h-full object-cover rounded-full scale-110 pointer-events-none select-none"
                      draggable={false}
                    />
                  </button>
                </div>
              )}
          </div>
        </div>

        {/* Version badge - positioned in header area like web view */}
        {/* <div className="fixed top-12 right-4 z-10">
        <p className="text-[9px] sm:text-[10px] font-light tracking-wide opacity-50" style={{ color: '#888888' }}>
          {getVersionString()}
        </p>
      </div> */}

        {/* Inactive User Modal */}
        {showInactiveModal && (
          <InactiveUserModal
            userEmail={user?.email || user?.Email || "your account"}
            onClose={handleInactiveModalClose}
            onContactCoach={handleContactCoach}
          />
        )}

        {/* Manual Mode Toast */}
        {manualModeToast && (
          <div
            key={manualModeToast}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none animate-manual-toast"
          >
            <span
              className={`text-xs font-semibold tracking-wide ${
                manualModeToast === "enabled"
                  ? "text-green-500"
                  : "text-gray-400"
              }`}
            >
              {manualModeToast === "enabled"
                ? "? Manual mode enabled"
                : "? Manual mode disabled"}
            </span>
          </div>
        )}

        {/* User Not Found Modal */}
        {showUserNotFoundModal && (
          <UserNotFoundModal
            userEmail={user?.email || user?.Email || "your account"}
            onClose={handleUserNotFoundModalClose}
          />
        )}

        {/* PR 3 � Unknown / low-confidence capture disambiguation modal */}
        <UnknownCaptureModal
          isOpen={unknownCaptureModal.open}
          onClose={() =>
            setUnknownCaptureModal({ open: false, pendingSharePromise: null })
          }
          onPick={(chosenType) => {
            // Re-tag the capture row to the user's choice so the share link
            // resolves correctly and listAnalyses includes it in the right tab.
            updatePendingCaptureType(
              unknownCaptureModal.pendingSharePromise,
              chosenType,
            );
            setUnknownCaptureModal({ open: false, pendingSharePromise: null });
            setImageType(chosenType);
            if (chosenType === "food") {
              setManualMealType(
                getMealTypeFromTime(
                  imageTimestamp ? new Date(imageTimestamp) : new Date(),
                ),
              );
              setShowManualFoodModal(true);
            } else if (chosenType === "weight") {
              fetchLastWeight();
              setCurrentWeightImage(null);
              setShowManualWeightModal(true);
            } else if (chosenType === "education") {
              setShowManualEducationModal(true);
            }
          }}
        />

        {/* PR-E � Unknown capture share-link viewer (image + Retry / Edit / Delete) */}
        <UnknownShareViewer
          isOpen={unknownShareView.open}
          imageBase64={unknownShareView.imageBase64}
          canMutate={unknownShareView.canMutate}
          retrying={unknownShareView.retrying}
          error={unknownShareView.error}
          onRetry={handleUnknownShareRetry}
          onEdit={handleUnknownShareEdit}
          onDelete={handleUnknownShareDelete}
          onClose={() =>
            setUnknownShareView({
              open: false,
              captureId: null,
              imageBase64: null,
              canMutate: false,
              retrying: false,
              error: null,
            })
          }
        />

        {/* 2026-06-09 � undo banner for unknown capture deletion (share-link viewer) */}
        {unknownShareUndo && (
          <UnknownCaptureUndoBanner
            captureId={unknownShareUndo.captureId}
            userId={unknownShareUndo.userId}
            imageBase64={unknownShareUndo.imageBase64}
            expiresAt={unknownShareUndo.expiresAt}
            onUndo={async ({ captureId, userId }) => {
              await undoDeleteCapture({ captureId, userId });
              setUnknownShareUndo(null);
              showToast("Restored");
            }}
            onExpire={() => {
              setUnknownShareUndo(null);
            }}
          />
        )}

        {/* PR-E � dedicated food search modal whose save promotes unknown ? food */}
        <SmartFoodSearchModal
          isOpen={shareEditView.open}
          onClose={() => setShareEditView({ open: false, captureId: null })}
          onSave={handleShareEditSave}
          mealType={manualMealType}
          apiBaseUrl={apiBaseUrl}
          userId={user?.id}
          timeLabel="What was in this photo?"
        />

        {/* Smart Food Search Modal (replaces ManualFoodEntryModal � shows history + global search) */}
        <SmartFoodSearchModal
          isOpen={showManualFoodModal}
          onClose={() => {
            setShowManualFoodModal(false);
            setManualMealType("");
          }}
          onSave={handleManualFoodSave}
          mealType={manualMealType}
          apiBaseUrl={apiBaseUrl}
          userId={user?.id}
          timeLabel="It's food time! Do you want to add manually?"
          altSwitchButtons={getAltSwitchButtons("food")}
        />

        {/* Manual Education Entry Modal */}
        <ManualEducationEntryModal
          isOpen={showManualEducationModal}
          onClose={() => setShowManualEducationModal(false)}
          onBack={() => {
            setShowManualEducationModal(false);
            if (manualModeActive) openBestManualModal();
          }}
          altSwitchButtons={getAltSwitchButtons("education")}
          onSave={async (data) => {
            setShowManualEducationModal(false);
            setError(null);
            // Clear uploaded image ? it's unrelated to this education log
            setImagePreview(null);
            setSelectedImage(null);
            setImageType("education");
            setLoadingState("saving");
            setSaveLoading(true);
            await saveEducationLog(
              {
                platform: data.platform,
                topic: data.topic,
                confidence: 0.9,
                participantCount: null,
              },
              null,
              null,
              null,
            );
          }}
        />

        {/* Manual Watch Entry Modal */}
        <ManualWatchEntryModal
          isOpen={showManualWatchModal}
          onClose={() => setShowManualWatchModal(false)}
          onBack={() => setShowManualWatchModal(false)}
          onSave={async (data) => {
            setShowManualWatchModal(false);
            setError(null);
            // Clear any uploaded image so the watch card doesn't show the wrong photo
            setImagePreview(null);
            setSelectedImage(null);
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
            setImageType("smartwatch");
            setWatchResult({
              caloriesBurned: data.caloriesBurned,
              source: data.source,
              loggedAt: new Date().toISOString(),
              userId: resolvedUserId,
              isManualEntry: true,
            });
          }}
        />


        {/* Duplicate Food Modal */}
        {showDuplicateModal && duplicateInfo && (
          <DuplicateFoodModal
            foodName={
              duplicateInfo.duplicateFoodName || duplicateInfo.originalFoodName
            }
            mealType={duplicateInfo.mealType}
            duplicateCount={duplicateInfo.duplicateCount}
            onConfirm={handleDuplicateConfirm}
            onCancel={handleDuplicateCancel}
          />
        )}

        {/* Duplicate Weight Modal */}
        {showDuplicateWeightModal && duplicateWeightInfo && (
          <DuplicateFoodModal
            isWeight={true}
            weightValue={duplicateWeightInfo.existingWeight}
            unit={duplicateWeightInfo.unit}
            timeDifference={duplicateWeightInfo.timeDifference}
            existingTime={duplicateWeightInfo.existingTime}
            onConfirm={handleDuplicateWeightConfirm}
            onCancel={handleDuplicateWeightCancel}
          />
        )}

        {/* Club Selection Modal */}
        <ClubSelectionModal
          isOpen={showClubSelectionModal}
          onClose={() => {
            setShowClubSelectionModal(false);
            setPendingEducationData(null);
            setPendingWeightData(null);
            setPendingFoodData(null);
            setSaveLoading(false);
            setLoadingState("idle");
          }}
          nearbyCenters={nearbyCenters}
          onSelectClub={handleClubSelection}
        />

        {/* Custom Alert Modal (for image validation and other critical messages) */}
        <CustomAlertModal
          isOpen={alertModal.isOpen}
          onClose={() => {
            setAlertModal({ ...alertModal, isOpen: false });
            // Clear all weight images when closing validation error modal
            setImagePreview(null);
            setCurrentWeightImage(null);
            setPendingWeightImage(null);
            // Clear error state to prevent error box from showing
            setError(null);
          }}
          title={alertModal.title}
          message={alertModal.message}
          type={alertModal.type}
          confirmText={alertModal.confirmText}
          cancelText={alertModal.cancelText}
          onConfirm={alertModal.onConfirm}
        />

        {/* Weight Progress Tips Modal (shows when weight moves opposite to goal) */}
        <WeightProgressTipsModal
          isOpen={showWeightProgressModal}
          onClose={() => {
            setShowWeightProgressModal(false);
            weightProgressCheck.reset();
          }}
          onOpenGallery={() => {
            fileInputRef.current?.openGallery?.();
          }}
          comparison={weightProgressCheck.comparison}
          goalMode={weightProgressCheck.goalMode}
          userName={savedUserName}
        />

        {/* Weight Goal Mode Setup Prompt � forced for users who never set their goal */}
        <WeightGoalSetupPrompt
          isOpen={showGoalModePrompt}
          onSave={async (selectedMode) => {
            const email = goalModePromptEmail || user?.email;
            if (!email) return;
            const res = await fetch(`${apiBaseUrl}/api/user/profile`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email, weightGoalMode: selectedMode }),
            });
            if (!res.ok) throw new Error("Failed to save goal mode");
            setShowGoalModePrompt(false);
            setGoalModePromptEmail(null);
          }}
        />

        {/* New User Profile Modal - shown for first-time users to complete their profile */}
        <UserProfileModal
          isOpen={showNewUserProfileModal}
          onClose={() => setShowNewUserProfileModal(false)}
          user={user}
          onProfileUpdate={() => {
            debugLog("? [NewUserProfile] Profile updated successfully");
          }}
        />

        {/* -- Mandatory Profile Completion Gate ------------------------------
           Renders above ALL other content (z-[300]) until every required
           field (height, gender, age, diet) is saved to the database.
           The user cannot dismiss this page until the form is complete.
      ------------------------------------------------------------------- */}
        {showCompleteProfile && !profileChecking && user && (
          <CompleteProfilePage
            user={user}
            apiBaseUrl={apiBaseUrl}
            showPictureSection={true}
            snoozeData={profilePicSnoozeData}
            userId={user.id || user.UserId || Session.getDbUserId()}
            onComplete={async (savedData) => {
              const email =
                user?.email || user?.Email || Session.getUserEmail() || "";
              profileCompletedRef.current = true;
              Session.markProfileComplete(email);
              setShowCompleteProfile(false);
              setProfileChecking(false);

              // If picture was saved, update user state immediately
              if (savedData?.profileImage) {
                setUser((prevUser) => ({
                  ...prevUser,
                  profileImage: savedData.profileImage,
                  ProfileImage: savedData.profileImage,
                  photoURL: savedData.profileImage,
                }));
              } else {
                // Picture was snoozed ? snooze data already saved to DB by handleRemindLater
                setProfilePicSnoozeData(null);
              }
            }}
          />
        )}

        {/* -- Mandatory Profile Picture Upload Gate ? DISABLED -------------
      {showMandatoryProfilePictureModal && !showCompleteProfile && user && (
        <MandatoryProfilePictureModal
          user={user}
          apiBaseUrl={apiBaseUrl}
          snoozeData={profilePicSnoozeData}
          onRemindLater={async () => {
            const userId = user.id || user.UserId || Session.getDbUserId();
            if (userId) {
              try {
                const res = await fetch(`${apiBaseUrl}/api/user/snooze-pic`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ userId }),
                });
                const data = await res.json();
                if (data.success) {
                  setProfilePicSnoozeData(data.snooze);
                  debugLog("? [Profile Picture] Snooze saved to DB:", data.snooze);
                }
              } catch (err) {
                console.error("? [Profile Picture] Failed to save snooze to DB:", err);
              }
            }
            setShowMandatoryProfilePictureModal(false);
          }}
          onComplete={async (uploadedImage) => {
            debugLog("? [Profile Picture] Profile picture uploaded successfully");
            const userEmail = user.email || user.Email;
            if (userEmail) {
              Session.markProfilePictureUploaded(userEmail);
            }
            
            // Immediately update user state with the uploaded image for instant UI update
            if (uploadedImage) {
              setUser((prevUser) => ({
                ...prevUser,
                profileImage: uploadedImage,
                ProfileImage: uploadedImage, // Some components use ProfileImage
                photoURL: uploadedImage, // Some components use photoURL
              }));
              debugLog("? [Profile Picture] User state updated immediately with new profile picture");
            }
            
            // Also fetch updated user profile in background to ensure consistency
            try {
              debugLog("?? [Profile Picture] Refreshing user profile data in background...");
              const res = await fetch(
                `${apiBaseUrl}/api/user/profile?email=${encodeURIComponent(userEmail)}&_t=${Date.now()}`,
                { cache: "no-store", headers: { "Cache-Control": "no-cache" } }
              );
              
              if (res.ok) {
                const data = await res.json();
                if (data.success && data.data && data.data.profileImage) {
                  // Update again with server data to ensure consistency
                  setUser((prevUser) => ({
                    ...prevUser,
                    profileImage: data.data.profileImage,
                    ProfileImage: data.data.profileImage,
                    photoURL: data.data.profileImage,
                  }));
                  debugLog("? [Profile Picture] User state synced with server data");
                }
              }
            } catch (err) {
              console.error("? [Profile Picture] Failed to refresh user profile:", err);
              // Don't block user - they already have the image from immediate update
            }
            
            setShowMandatoryProfilePictureModal(false);
          }}
        />
      )}
      ------------------------------------------------------------------- */}

        {/* Nutrition Centers Map */}
        {showNutritionCentersMap && (
          <Suspense
            fallback={
              <LoadingSpinner message="Loading nutrition centers map..." />
            }
          >
            <NutritionCentersMap
              user={user}
              onBack={() => setShowNutritionCentersMap(false)}
              onEditCenter={(center) => {
                setEditCenterData(center);
                // Keep map mounted in background - don't unmount
                // setShowNutritionCentersMap(false);
                setShowRegisterCenter(true);
              }}
              onRegisterCenter={() => {
                setEditCenterData(null);
                setShowNutritionCentersMap(false);
                setShowRegisterCenter(true);
              }}
            />
          </Suspense>
        )}

        {/* Register Nutrition Center */}
        {showRegisterCenter && (
          <Suspense fallback={null}>
            <NutritionCenterRegistration
              user={user}
              initialCenter={editCenterData}
              onBack={() => {
                setShowRegisterCenter(false);
                if (editCenterData) {
                  // came from Physical Club Report via Edit � map already visible, just close form
                  // No need to re-open map: setShowNutritionCentersMap(true);
                }
                setEditCenterData(null);
              }}
            />
          </Suspense>
        )}

        {/* Setup Wizard - Team ID + Coach Selection */}
        {showSetupWizard && (
          <Suspense fallback={null}>
            <SetupWizard
              userEmail={user?.email || user?.Email || Session.getUserEmail()}
              onClose={() => setShowSetupWizard(false)}
              onNavigateToOTP={() => {
                setShowSetupWizard(false);
                setShowValidateOTP(true);
              }}
              onLogout={handleSignOut}
            />
          </Suspense>
        )}

        {/* OTP Validation Page */}
        {showValidateOTP && (
          <Suspense fallback={null}>
            <ValidateOTP
              key={isInactiveReactivationFlow ? "reactivation" : "setup"}
              isReactivationFlow={isInactiveReactivationFlow}
              onClose={() => {
                console.log("?? [ValidateOTP onClose] User closed modal", {
                  isInactiveReactivationFlow,
                });
                setShowValidateOTP(false);
                if (isInactiveReactivationFlow) {
                  // User cancelled reactivation � sign them out cleanly
                  setIsInactiveReactivationFlow(false);
                  handleSignOut();
                } else {
                  // Regular login flow - go back to setup wizard only if not inactive
                  if (isUserActive) {
                    setShowSetupWizard(true);
                  } else {
                    console.log(
                      "?? [ValidateOTP onClose] User is inactive, not showing setup wizard",
                    );
                  }
                }
              }}
              onSuccess={() => {
                console.log(
                  "?? [ValidateOTP onSuccess] OTP verified, closing modal",
                  { isInactiveReactivationFlow, isUserActive },
                );
                setShowValidateOTP(false);
                if (isInactiveReactivationFlow) {
                  // Reactivation complete � re-run status check to enter app
                  setIsInactiveReactivationFlow(false);
                  const storedUser = Session.getOtpUser();
                  if (storedUser) {
                    try {
                      checkUserStatus(JSON.parse(storedUser));
                    } catch (_e) {
                      /* ignore */
                    }
                  }
                } else {
                  // Regular login flow - only show setup wizard if user is active
                  // If inactive, the checkUserStatus will show the inactive modal
                  console.log(
                    "?? [ValidateOTP onSuccess] Regular login flow, checking user status before showing setup wizard",
                  );
                }
                // Setup complete, user can now access dashboard
              }}
              onLogout={handleSignOut}
            />
          </Suspense>
        )}

        {/* ?? Floating Bug Button - Show Correction Logs (Web & Android) */}
        {/* {user && (
        <button
          onClick={() => setShowCorrectionModal(true)}
          disabled={correctionLogs.length === 0}
          className={`fixed bottom-24 right-4 xs:right-6 md:bottom-8 md:right-8 z-50 text-white p-4 rounded-full shadow-lg transition-all duration-200 ${
            correctionLogs.length > 0 
              ? 'bg-orange-500 hover:bg-orange-600 hover:shadow-xl active:scale-95 hover:scale-110 cursor-pointer' 
              : 'bg-gray-400 cursor-not-allowed opacity-50'
          }`}
          title={correctionLogs.length > 0 ? "View food correction logs" : "No correction logs yet"}
          aria-label="View food correction logs"
        >
          <Bug className="w-6 h-6" />
          {correctionLogs.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center animate-pulse">
              {correctionLogs.length}
            </span>
          )}
        </button>
      )} */}

        {/* Fixed buttons removed - now using sticky footer layout inside scrollable content */}

        {/* ?? Correction Logs Modal (Web & Android Optimized) */}
        {showCorrectionModal && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-[9999] flex items-center justify-center p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowCorrectionModal(false);
            }}
          >
            <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              {/* Header */}
              <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-4 md:p-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bug className="w-6 h-6 md:w-8 md:h-8" />
                  <div>
                    <h2 className="text-xl md:text-2xl font-bold">
                      Food Correction Logs
                    </h2>
                    <p className="text-orange-100 text-xs md:text-sm">
                      AI Detection vs User Corrections ({correctionLogs.length}{" "}
                      entries)
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCorrectionModal(false)}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
                  aria-label="Close modal"
                >
                  <svg
                    className="w-5 h-5 md:w-6 md:h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-gray-900">
                {correctionLogs.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <Bug className="w-16 h-16 mx-auto mb-4 opacity-20" />
                    <p className="text-lg font-semibold">
                      No correction logs yet
                    </p>
                    <p className="text-sm">
                      Upload food images to see correction logs
                    </p>
                  </div>
                ) : (
                  correctionLogs.map((log, index) => (
                    <div
                      key={index}
                      className="bg-gray-950 rounded-lg p-4 md:p-5 border border-gray-700 font-mono text-xs md:text-sm"
                    >
                      {/* Timestamp Header */}
                      <div className="text-gray-400 mb-3 pb-2 border-b border-gray-700">
                        <span className="text-blue-400">
                          ?? {new Date(log.timestamp).toLocaleString()}
                        </span>
                        {log.wasAutoCorrected && (
                          <span className="ml-3 bg-green-900 text-green-300 px-2 py-1 rounded text-xs">
                            ? AUTO-CORRECTED
                          </span>
                        )}
                      </div>

                      {/* Main Correction Flow Box */}
                      <div className="bg-gray-800 rounded p-4 mb-3 border border-gray-600">
                        <div className="text-blue-400 font-bold mb-2">
                          +----------------------------------------------------------------
                        </div>
                        <div className="text-blue-400 font-bold mb-1">
                          ? ?? FOOD CORRECTION FLOW
                        </div>
                        <div className="text-blue-400 font-bold mb-2">
                          �----------------------------------------------------------------
                        </div>

                        <div className="text-white mb-1">
                          <span className="text-gray-400">?</span> ??{" "}
                          <span className="text-cyan-400">
                            AI Detected Name:
                          </span>
                          <span className="ml-4 text-yellow-300">
                            "{log.aiDetected}"
                          </span>
                        </div>

                        {log.aiDetected.trim().toLowerCase() ===
                        log.userCorrected.trim().toLowerCase() ? (
                          <div className="text-white mb-2">
                            <span className="text-gray-400">?</span> ?{" "}
                            <span className="text-cyan-400">Status:</span>
                            <span className="ml-2 text-green-300">
                              No Correction - User accepted AI suggestion
                            </span>
                          </div>
                        ) : (
                          <div className="text-white mb-2">
                            <span className="text-gray-400">?</span> ??{" "}
                            <span className="text-cyan-400">
                              User Corrected To:
                            </span>
                            <span className="ml-2 text-green-300">
                              "{log.userCorrected}"
                            </span>
                          </div>
                        )}

                        <div className="text-white mb-2">
                          <span className="text-gray-400">?</span> ??{" "}
                          <span className="text-cyan-400">
                            Final Display Name:
                          </span>
                          <span className="ml-2 text-green-300">
                            "{log.finalDisplay}"
                          </span>
                        </div>

                        <div className="text-blue-400 font-bold">
                          +----------------------------------------------------------------
                        </div>
                      </div>

                      {/* Individual Console Logs */}
                      <div className="space-y-1 text-gray-300">
                        <div>
                          <span className="text-blue-400">
                            ?? [AI-DETECTED]
                          </span>
                          <span className="ml-2">
                            Original:{" "}
                            <span className="text-yellow-300">
                              {log.aiDetected}
                            </span>
                          </span>
                        </div>

                        {log.aiDetected.trim().toLowerCase() ===
                        log.userCorrected.trim().toLowerCase() ? (
                          <div>
                            <span className="text-green-400">
                              ? [NO-CORRECTION]
                            </span>
                            <span className="ml-2">
                              User accepted AI suggestion
                            </span>
                          </div>
                        ) : (
                          <div>
                            <span className="text-green-400">
                              ?? [USER-CORRECTED]
                            </span>
                            <span className="ml-2">
                              Mapped to:{" "}
                              <span className="text-green-300">
                                {log.userCorrected}
                              </span>
                            </span>
                          </div>
                        )}

                        <div>
                          <span className="text-purple-400">
                            ?? [FINAL-DISPLAY]
                          </span>
                          <span className="ml-2">
                            Will show:{" "}
                            <span className="text-green-300">
                              {log.finalDisplay}
                            </span>
                          </span>
                        </div>
                      </div>

                      {/* Structured Data Object */}
                      <div className="mt-3 pt-3 border-t border-gray-700">
                        <div className="text-gray-400">[CORRECTION-DATA]</div>
                        <pre className="text-xs text-gray-300 mt-1 overflow-x-auto">
                          {JSON.stringify(
                            {
                              aiDetected: log.aiDetected,
                              userCorrected: log.userCorrected,
                              finalDisplay: log.finalDisplay,
                              userCount: log.userCount,
                              portion: log.portion,
                              calories: log.calories,
                              timestamp: log.timestamp,
                            },
                            null,
                            2,
                          )}
                        </pre>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="bg-gray-50 p-4 flex flex-col sm:flex-row justify-between items-center gap-3 border-t">
                <button
                  onClick={() => {
                    setCorrectionLogs([]);
                    setShowCorrectionModal(false);
                  }}
                  className="text-sm text-red-600 hover:text-red-700 font-semibold hover:underline transition-colors order-2 sm:order-1"
                >
                  Clear All Logs
                </button>
                <div className="flex gap-2 order-1 sm:order-2">
                  <button
                    onClick={() => {
                      // Copy logs to clipboard for web users
                      const logText = correctionLogs
                        .map(
                          (log) =>
                            `${new Date(log.timestamp).toLocaleString()}\n` +
                            `AI: ${log.aiDetected} ? Corrected: ${log.userCorrected} ? Final: ${log.finalDisplay}\n` +
                            `Stats: Users ${log.userCount} | ${log.portion} | ${log.calories}cal\n`,
                        )
                        .join("\n");
                      navigator.clipboard
                        ?.writeText(logText)
                        .then(() => alert("Logs copied to clipboard!"))
                        .catch(() => debugLog("Copy not supported"));
                    }}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg font-semibold transition-colors text-sm"
                  >
                    ?? Copy Logs
                  </button>
                  <button
                    onClick={() => setShowCorrectionModal(false)}
                    className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CRITICAL: Waiting Modal - Rendered as Portal directly to document.body */}
        {isWaitingForCoachOTP &&
          ReactDOM.createPortal(
            <div
              data-waiting-modal="true"
              className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4"
              style={{ zIndex: 999999 }}
              ref={(el) => {
                if (el)
                  console.log(
                    "??? [Waiting Modal] DOM RENDERED AND VISIBLE ???",
                  );
              }}
            >
              <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center animate-fadeIn">
                <div className="flex justify-center mb-6">
                  <div className="animate-spin rounded-full h-20 w-20 border-b-4 border-green-500"></div>
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-4">
                  Contacting Your Coach...
                </h2>
                <p className="text-gray-600 text-lg leading-relaxed">
                  We've sent a request to your coach. Please wait while we
                  prepare the verification screen.
                </p>
              </div>
            </div>,
            document.body,
          )}
      </div>
    </LocationGuard>
  );
}

// Wrap app in NutritionRefreshProvider for global nutrition data refresh
const AppWithProviders = () => (
  <NutritionRefreshProvider>
    <WellnessValleyApp />
  </NutritionRefreshProvider>
);

export default AppWithProviders;
