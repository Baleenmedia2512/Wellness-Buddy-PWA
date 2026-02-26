// src/App.js
import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  lazy,
  Suspense,
} from "react";
import { useIonRouter } from "@ionic/react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { PushNotifications } from "@capacitor/push-notifications";
import { SplashScreen } from "@capacitor/splash-screen";
import { Bug, Share2 } from "lucide-react";
import ImageUpload from "./components/ImageUpload";
import NutritionCard from "./components/NutritionCard";
import EducationLogCard from "./components/EducationLogCard";
import TestImageGuide from "./components/TestImageGuide";
import LoadingSpinner from "./components/LoadingSpinner";
import Login from "./components/Login";
import InactiveUserModal from "./components/InactiveUserModal";
import UserNotFoundModal from "./components/UserNotFoundModal";
import Header from "./components/Header";
import {
  getUserContext,
  clearContextCache,
} from "./services/userContextService";
import {
  initializeBackButton,
  cleanupBackButton,
} from "./utils/backButtonHandler";
import { getUserId, clearUserIdCache } from "./services/getUserId";
import { getVersionString } from "./config/version";
import {
  saveNutritionAnalysis,
  deleteNutritionAnalysis,
} from "./services/nutritionSaveService";
import { geminiService } from "./services/geminiService";
import { imageTypeDetector } from "./services/imageTypeDetector";
import { weightDetectionService } from "./services/weightDetectionService";
import { educationDetectionService } from "./services/educationDetectionService";
import { duplicateDetectionService } from "./services/duplicateDetectionService";
import { applyUserCorrections } from "./services/foodCorrectionService";
import { captureAndShare } from "./utils/shareUtils";
import ManualWeightEntryModal from "./components/ManualWeightEntryModal";
import DuplicateFoodModal from "./components/DuplicateFoodModal";
import UserProfileModal from "./components/UserProfileModal";
import WeightLossLeaderboard from "./components/WeightLossLeaderboard";
import LEADERBOARD_CONFIG from "./config/leaderboardConfig";

import GalleryMonitor from "./services/galleryMonitor";
import {
  signInWithGoogle,
  signInWithGooglePopup,
  signOutUser,
  handleRedirectResult,
  onAuthStateChange,
  isGoogleUser,
  isMobileDevice,
  cleanup,
} from "./services/firebase";
import TouchFeedbackButton from "./components/TouchFeedbackButton";

// ✅ ANDROID OPTIMIZATION: Lazy load heavy components
const Dashboard = lazy(() => import("./components/Dashboard"));
const AdminDashboard = lazy(() => import("./components/AdminDashboard"));
const DisciplineReport = lazy(() => import("./components/DisciplineReport"));
const SetupWizard = lazy(() => import("./pages/SetupWizard"));
const ValidateOTP = lazy(() => import("./pages/ValidateOTP"));

function WellnessValleyApp() {
  const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [nutritionData, setNutritionData] = useState(null);
  const [savedNutritionMealId, setSavedNutritionMealId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingState, setLoadingState] = useState("analyzing"); // 'analyzing' | 'saving'
  const [detectedFoodNames, setDetectedFoodNames] = useState([]); // AI-detected food names
  const [error, setError] = useState(null);
  const [showTestGuide, setShowTestGuide] = useState(false);
  const [showDashboard, setShowDashboard] = useState(
    localStorage.getItem("currentPage") === "dashboard" ||
      localStorage.getItem("currentPage") === "nutrition-dashboard" ||
      localStorage.getItem("currentPage") === "weight-tracking" ||
      localStorage.getItem("currentPage") === "weight-insights",
  );
  const [dashboardInitialTab, setDashboardInitialTab] = useState(null); // 'nutrition' | 'weight' | null
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isOtpVerified, setIsOtpVerified] = useState(
    localStorage.getItem("isOtpVerified") === "true",
  );
  const [showInactiveModal, setShowInactiveModal] = useState(false);
  const [showUserNotFoundModal, setShowUserNotFoundModal] = useState(false);
  const [isUserActive, setIsUserActive] = useState(true); // Track if user is active
  const [showManualWeightModal, setShowManualWeightModal] = useState(false);
  const [currentWeightImage, setCurrentWeightImage] = useState(null);
  const [imageType, setImageType] = useState(null); // 'food' | 'weight' | 'education'
  const [weightResult, setWeightResult] = useState(null); // Store weight detection results
  const [educationResult, setEducationResult] = useState(null); // Store education meeting results
  const fileInputRef = useRef(null);
  const weightAnalysisShareRef = useRef(null);

  // Duplicate food detection state
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState(null);
  const [pendingSaveData, setPendingSaveData] = useState(null);

  // Duplicate weight detection state
  const [showDuplicateWeightModal, setShowDuplicateWeightModal] =
    useState(false);
  const [duplicateWeightInfo, setDuplicateWeightInfo] = useState(null);
  const [pendingWeightSaveData, setPendingWeightSaveData] = useState(null);

  // New user profile modal state - show profile page for first-time users
  const [showNewUserProfileModal, setShowNewUserProfileModal] = useState(false);

  // User context state - stored and reused for AI personalization
  const [userContext, setUserContext] = useState(null);
  const [userContextLoading, setUserContextLoading] = useState(false);

  // User role state - for role-based access control
  const [userRole, setUserRole] = useState("user");

  // Admin dashboard state
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);

  // Discipline report state (for coaches) - with localStorage persistence
  const [showDisciplineReport, setShowDisciplineReport] = useState(
    localStorage.getItem("currentPage") === "discipline-report",
  );

  // Setup wizard state
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [showValidateOTP, setShowValidateOTP] = useState(false);

  // 🐛 Food Correction Debug Logs State
  const [correctionLogs, setCorrectionLogs] = useState([]);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);

  // 🔄 Retry state - store last image file for retry capability
  const lastImageFileRef = useRef(null);

  // Help instructions visibility state
  const [showHowToUse, setShowHowToUse] = useState(false);

  // Weight analysis share state
  const [isWeightSharing, setIsWeightSharing] = useState(false);

  // ---------- Helpers for BgNutrition fast-path + ack -----------------

  // // Make a compact, user-friendly title from foods[]
  // const titleFromFoods = (foods = []) => {
  //   const list = Array.isArray(foods) ? foods : [];
  //   const count = list.length;
  //   if (count === 0) return 'Food';
  //   const safe = (v) => (v?.toString?.() || '').trim();
  //   const first = safe(list[0]?.name) || 'Food';
  //   if (count === 1) return first;
  //   if (count === 2) {
  //     const second = safe(list[1]?.name) || 'another item';
  //     return `${first} & ${second}`;
  //   }
  //   return `${first} + ${count - 1} more`;
  // };

  // const loadCachedBgPopup = () => {
  //   try {
  //     const raw = localStorage.getItem('wellnessBuddy_cachedBgPopup');
  //     if (!raw) return null;
  //     const cached = JSON.parse(raw);
  //     if (!cached?.analysisId) return null;
  //     const ackId = localStorage.getItem('wellnessBuddy_lastBgNutritionId');
  //     if (ackId && String(ackId) === String(cached.analysisId)) return null;

  //     // Optional TTL (6h) to avoid very old resurfacing
  //     const MAX_AGE_MS = 1000 * 60 * 60 * 6;
  //     if (cached.cachedAt && Date.now() - cached.cachedAt > MAX_AGE_MS) {
  //       localStorage.removeItem('wellnessBuddy_cachedBgPopup');
  //       return null;
  //     }
  //     return cached;
  //   } catch {
  //     return null;
  //   }
  // };

  // const persistBgCache = (popup) => {
  //   try {
  //     localStorage.setItem(
  //       'wellnessBuddy_cachedBgPopup',
  //       JSON.stringify({ ...popup, cachedAt: Date.now() })
  //     );
  //   } catch {}
  // };

  // const clearBgCache = () => {
  //   try { localStorage.removeItem('wellnessBuddy_cachedBgPopup'); } catch {}
  // };

  // const ackBgPopup = (analysisId) => {
  //   try {
  //     if (analysisId != null) {
  //       localStorage.setItem('wellnessBuddy_lastBgNutritionId', String(analysisId));
  //     }
  // clearBgCache(); // ensure it won’t repaint on refresh
  // } catch {}
  // };

  // --------------------------------------------------------------------

  // Navigation hook for back button handling
  const ionRouter = useIonRouter();

  // Toast state for back button exit message
  const [toast, setToast] = useState({ message: "", visible: false });

  // Show toast message
  const showToast = (message) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast({ message: "", visible: false }), 2000);
  };

  // 🐛 Keyboard shortcut for closing correction modal (ESC key on web)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && showCorrectionModal) {
        setShowCorrectionModal(false);
      }
    };

    if (showCorrectionModal) {
      window.addEventListener('keydown', handleKeyDown);
      // Prevent body scroll when modal is open (web only)
      document.body.style.overflow = 'hidden';
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [showCorrectionModal]);

  // ✅ CRITICAL FIX: Force splash screen dismissal on app load

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      // Double-check splash screen is hidden after React renders
      const timer = setTimeout(() => {
        SplashScreen.hide().catch(err => {
          console.log('Splash screen already hidden');
        });
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, []);
  // useEffect(() => {
  //   if (Capacitor.isNativePlatform()) {
  //     // Double-check splash screen is hidden after React renders
  //     const timer = setTimeout(() => {
  //       SplashScreen.hide().catch((err) => {
  //         console.log("Splash screen already hidden");
  //       });
  //     }, 500);

  //     return () => clearTimeout(timer);
  //   }
  // }, []);

  // Initialize back button handler
  useEffect(() => {
    const goBack = () => {
      if (showDisciplineReport) {
        showMainPage();
        return true;
      }
      if (showDashboard) {
        showMainPage();
        return true;
      }
      return ionRouter.canGoBack() && ionRouter.goBack();
    };

    initializeBackButton(
      goBack,
      showToast,
      !showDashboard && !showDisciplineReport,
    );
    return () => cleanupBackButton();
  }, [ionRouter, showDashboard, showDisciplineReport]);

  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // Add a ref to track if status check is in progress
  const statusCheckInProgress = useRef(false);

  // Add a ref to track if sign-out is in progress
  const signOutInProgress = useRef(false);

  // Add a ref to track if image processing is in progress (prevents React StrictMode double-calls)
  const imageProcessingInProgress = useRef(false);

  // Check user status (Active/Inactive) using lookup-user-id API
  const checkUserStatus = useCallback(
    async (user) => {
      if (!user) {
        return true; // If no user, skip check
      }

      // Skip status check if this is a fresh Google sign-in that's being saved
      const isFreshSignIn =
        sessionStorage.getItem("freshGoogleSignIn") === "true";
      if (isFreshSignIn) {
        return true; // Skip check, allow access - sign-in handler will check after save
      }

      // Prevent multiple simultaneous checks
      if (statusCheckInProgress.current) {
        return true; // Skip if already checking
      }

      try {
        statusCheckInProgress.current = true;

        const userEmail = user.email || user.Email;

        if (!userEmail) {
          return true;
        }

        const response = await fetch(`${apiBaseUrl}/api/lookup-user-id`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: userEmail }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // User not found in database
        if (!data.success || data.userNotFound) {
          setShowUserNotFoundModal(true);
          setIsUserActive(false);
          return false;
        }

        // User found but inactive
        if (data.success && !data.isActive) {
          setShowInactiveModal(true);
          setIsUserActive(false);
          return false;
        }

        // User is active - clear any modal states and store role
        setShowInactiveModal(false);
        setShowUserNotFoundModal(false);
        setIsUserActive(true);

        // Store user role for access control
        if (data.role) {
          setUserRole(data.role);
        }

        return true;
      } catch (error) {
        console.error("Error checking user status:", error);
        // On error, allow user to continue (fail-open)
        setIsUserActive(true);
        return true;
      } finally {
        statusCheckInProgress.current = false;
      }
    },
    [apiBaseUrl],
  );

  // Helper functions for navigation with localStorage persistence
  const showDashboardPage = useCallback(async () => {
    // Re-check user status in real-time before opening dashboard
    if (user) {
      const isActive = await checkUserStatus(user);
      if (!isActive) {
        setError(
          "Your account is inactive. Please contact support to reactivate.",
        );
        return;
      }
    }

    // Clear nutrition data and image preview when switching to dashboard
    if (nutritionData) setNutritionData(null);
    if (imagePreview) setImagePreview(null);

    // Set the initial tab based on the last analyzed image type
    if (imageType === "weight") {
      setDashboardInitialTab("weight");
    } else if (imageType === "food") {
      setDashboardInitialTab("nutrition");
    } else if (imageType === "education") {
      setDashboardInitialTab("education");
    } else {
      setDashboardInitialTab(null); // Use default/last used tab
    }
    setShowDashboard(true);
    localStorage.setItem("currentPage", "dashboard");
  }, [user, checkUserStatus, nutritionData, imagePreview, imageType]);

  const showMainPage = () => {
    setShowDashboard(false);
    setShowDisciplineReport(false);
    setDashboardInitialTab(null); // Clear initial tab when going back
    localStorage.setItem("currentPage", "main");
  };

  const requestAllPermissions = async () => {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await PushNotifications.requestPermissions();
    } catch (err) {
      console.warn("❌ Permission request failed:", err);
    }
  };

  const handleInactiveModalClose = async () => {
    setShowInactiveModal(false);

    // Add small delay to ensure modal is visible before sign out
    await new Promise((resolve) => setTimeout(resolve, 300));

    await handleSignOut();
  };

  const handleUserNotFoundModalClose = async () => {
    setShowUserNotFoundModal(false);

    // Add small delay to ensure modal is visible before sign out
    await new Promise((resolve) => setTimeout(resolve, 300));

    await handleSignOut();
  };

  const handleSaveUserCache = async (user) => {
    if (user && Capacitor.isNativePlatform()) {
      try {
        const dbUserId = await getUserId(user);
        if (dbUserId && user.email) {
          GalleryMonitor.setCurrentUser(String(dbUserId), user.email);
        }
      } catch (err) {
        console.warn("Failed to set current user for background service:", err);
      }
    }
  };

  // Set up StatusBar to appear above content (not overlaid)
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      import("@capacitor/status-bar")
        .then(({ StatusBar }) => {
          StatusBar.setOverlaysWebView({ overlay: false });
        })
        .catch((err) => {
          console.warn("StatusBar plugin not available:", err);
        });
    }
  }, []);

  useEffect(() => {
    const initializeGalleryMonitoring = async () => {
      if (Capacitor.isNativePlatform()) {
        await GalleryMonitor.initialize();

        App.addListener("appStateChange", ({ isActive }) => {
          if (isActive) {
            GalleryMonitor.checkGallery();
          }
        });

        const { GalleryMonitorPlugin } = await import(
          "./plugins/galleryMonitorPlugin"
        );
        const listener = await GalleryMonitorPlugin.addListener(
          "notificationClicked",
          (data) => {
            if (data && data.action === "openBackgroundHistory") {
              showDashboardPage();
            }
          },
        );

        return () => {
          listener.remove();
        };
      }
    };

    let cleanupFn;
    initializeGalleryMonitoring().then((fn) => {
      cleanupFn = fn;
    });

    return () => {
      App.removeAllListeners();
      if (cleanupFn) cleanupFn();
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
            console.log(
              "✅ [Redirect] Attached database UserId to user object:",
              resultUser.id,
            );
          }
          setUser(resultUser);
          setAuthLoading(false);
        }
      } catch (error) {
        console.error("❌ Redirect result error:", error);
        setError("Authentication failed. Please try again.");
        setAuthLoading(false);
      }
    };
    checkRedirectResult();
  }, []);

  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (user) => {
      // If sign-out is in progress, ignore auth state changes
      if (signOutInProgress.current) {
        return;
      }

      if (user) {
        // Get database UserId if not already attached
        if (!user.id) {
          const dbUserId = await getUserId(user);
          if (dbUserId) {
            user.id = dbUserId;
            console.log(
              "✅ [Auth State] Attached database UserId to user object:",
              user.id,
            );
          }
        }

        // Store user email in localStorage for API calls
        const userEmail = user.email || user.Email;
        if (userEmail) {
          localStorage.setItem("userEmail", userEmail);
          console.log(
            "✅ [Auth State] Stored user email in localStorage:",
            userEmail,
          );
        }

        // Load user context for AI personalization
        if (user.id) {
          console.log("🔄 [Auth State] Loading user context...");
          setUserContextLoading(true);
          try {
            const context = await getUserContext(user.id);
            setUserContext(context);
            console.log("✅ [Auth State] User context stored in state");
          } catch (error) {
            console.error("❌ [Auth State] Failed to load context:", error);
          } finally {
            setUserContextLoading(false);
          }
        }

        // Skip status check if this is a fresh Google sign-in that's being saved
        // The handleSignIn/handlePopupSignIn functions will handle status check after save
        const isFreshSignIn =
          sessionStorage.getItem("freshGoogleSignIn") === "true";

        if (!isFreshSignIn) {
          // Check user status before allowing access (for existing sessions)
          const isActive = await checkUserStatus(user);

          if (!isActive) {
            // Don't clear user state immediately - let modal show first
            // Modal close handler will sign out and clear state
            setUser(user); // Keep user state so modal can show user email
            setAuthLoading(false);
            return;
          }

          // Check setup wizard status for active users
          if (isActive && userEmail) {
            console.log("🔄 [Auth State] Checking setup wizard status...");

            // Check if user manually skipped setup (check localStorage first for quick bypass)
            const setupSkipped = localStorage.getItem("setupSkipped");
            if (setupSkipped === "true") {
              console.log(
                "⏭️ [Auth State] User skipped setup (localStorage), bypassing wizard",
              );
              // Don't show setup wizard - user chose to skip
              return;
            }

            try {
              const statusResponse = await fetch(
                `${apiBaseUrl}/api/user/status?email=${encodeURIComponent(
                  userEmail,
                )}`,
              );

              if (statusResponse.ok) {
                const statusData = await statusResponse.json();
                console.log("📋 [Auth State] Setup status:", statusData);

                // Check if user skipped setup (from database)
                if (statusData.setupSkipped) {
                  console.log(
                    "⏭️ [Auth State] User skipped setup (database), bypassing wizard",
                  );
                  localStorage.setItem("setupSkipped", "true");
                  return;
                }

                // Show setup wizard if not complete
                if (!statusData.setupComplete) {
                  if (statusData.pendingRequest) {
                    // User has pending OTP validation
                    console.log(
                      "📧 [Auth State] Pending OTP detected, showing OTP modal",
                    );
                    setShowValidateOTP(true);
                  } else {
                    // User needs to complete setup wizard
                    console.log(
                      "🔧 [Auth State] Setup incomplete, showing setup wizard",
                    );
                    setShowSetupWizard(true);
                  }
                } else {
                  console.log("✅ [Auth State] Setup already complete");
                }
              } else {
                console.warn(
                  "⚠️ [Auth State] Setup status check failed:",
                  statusResponse.status,
                );
              }
            } catch (setupError) {
              console.warn(
                "⚠️ [Auth State] Failed to check setup status:",
                setupError,
              );
              // Continue without blocking - setup check is not critical
            }
          }
        } else {
          // Don't clear the flag here - let the sign-in handler clear it after save completes
          console.log(
            "🔐 [Auth State] Fresh sign-in detected, skipping status check",
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
        console.log(
          "🔐 [Auth State] Skipping handleSaveUserCache for fresh sign-in",
        );
      }
    });
    return () => unsubscribe();
  }, [checkUserStatus]);

  // Subscribe to user context updates (from profile edits, food corrections, etc.)
  useEffect(() => {
    if (!user?.id) return;

    const {
      subscribeToContextUpdates,
    } = require("./services/userContextService");
    const unsubscribe = subscribeToContextUpdates((updatedContext) => {
      console.log("✅ [App] User context updated in state:", {
        corrections: updatedContext?.personalCorrections?.length || 0,
        diet: updatedContext?.dietPreference,
      });
      setUserContext(updatedContext);
    });

    return unsubscribe;
  }, [user?.id]);

  // Setup for authenticated users
  useEffect(() => {
    if (user) {
      requestAllPermissions();
      handleSaveUserCache(user);
    }
  }, [user]);

  // Handle OTP user restoration
  useEffect(() => {
    const restoreOtpUser = async () => {
      if (isOtpVerified && !user) {
        const otpUser = localStorage.getItem("otpUser");

        if (otpUser) {
          try {
            const parsedUser = JSON.parse(otpUser);

            // Get database UserId if not already attached
            if (!parsedUser.id) {
              const dbUserId = await getUserId(parsedUser);
              if (dbUserId) {
                parsedUser.id = dbUserId;
                console.log(
                  "✅ [OTP Restore] Attached database UserId to user object:",
                  parsedUser.id,
                );
              }
            }

            // Store user email in localStorage for API calls
            const userEmail = parsedUser.email || parsedUser.Email;
            if (userEmail) {
              localStorage.setItem("userEmail", userEmail);
              console.log(
                "✅ [OTP Restore] Stored user email in localStorage:",
                userEmail,
              );
            }

            // Load user context for AI personalization
            if (parsedUser.id) {
              console.log("🔄 [OTP Restore] Loading user context...");
              setUserContextLoading(true);
              try {
                const context = await getUserContext(parsedUser.id);
                setUserContext(context);
                console.log("✅ [OTP Restore] User context stored in state");
              } catch (error) {
                console.error(
                  "❌ [OTP Restore] Failed to load context:",
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
            handleSaveUserCache(parsedUser);
          } catch (error) {
            console.error("Failed to restore OTP user:", error);
            localStorage.removeItem("otpUser");
            setIsOtpVerified(false);
          }
        }
      }
    };

    restoreOtpUser();
  }, [isOtpVerified, user, checkUserStatus]);

  // Periodic user status check (every 60 seconds)
  useEffect(() => {
    if (!user) return;

    const statusCheckInterval = setInterval(async () => {
      await checkUserStatus(user);
    }, 60000); // Check every 60 seconds

    return () => clearInterval(statusCheckInterval);
  }, [user, checkUserStatus]);

  // Check setup wizard status whenever user is set/updated
  useEffect(() => {
    const checkSetupStatus = async () => {
      if (!user || !isUserActive) return;

      const userEmail = user.email || user.Email;
      if (!userEmail) return;

      console.log(
        "🔄 [Setup Check] Checking setup wizard status for existing user...",
      );

      // Check if user manually skipped setup (check localStorage first for quick bypass)
      const setupSkipped = localStorage.getItem("setupSkipped");
      if (setupSkipped === "true") {
        console.log(
          "⏭️ [Setup Check] User skipped setup (localStorage), bypassing wizard",
        );
        return;
      }

      try {
        const statusResponse = await fetch(
          `${apiBaseUrl}/api/user/status?email=${encodeURIComponent(
            userEmail,
          )}`,
        );

        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          console.log("📋 [Setup Check] Setup status:", statusData);

          // Check if user skipped setup (from database)
          if (statusData.setupSkipped) {
            console.log(
              "⏭️ [Setup Check] User skipped setup (database), bypassing wizard",
            );
            localStorage.setItem("setupSkipped", "true");
            return;
          }

          // Show setup wizard if not complete
          if (!statusData.setupComplete) {
            if (statusData.pendingRequest) {
              // User has pending OTP validation
              console.log(
                "📧 [Setup Check] Pending OTP detected, showing OTP modal",
              );
              setShowValidateOTP(true);
            } else {
              // User needs to complete setup wizard
              console.log(
                "🔧 [Setup Check] Setup incomplete, showing setup wizard",
              );
              setShowSetupWizard(true);
            }
          } else {
            console.log("✅ [Setup Check] Setup already complete");
          }
        } else {
          console.warn(
            "⚠️ [Setup Check] Setup status check failed:",
            statusResponse.status,
          );
        }
      } catch (setupError) {
        console.warn(
          "⚠️ [Setup Check] Failed to check setup status:",
          setupError,
        );
      }
    };

    // Run check after a short delay to ensure auth is fully complete
    const timeoutId = setTimeout(() => {
      checkSetupStatus();
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [user, isUserActive, apiBaseUrl]);

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

  // ✅ ANDROID PERFORMANCE: Optimized image compression with async processing
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
   * Perform actual weight save to database (called after duplicate check)
   */
  const performWeightSave = async (
    weightData,
    imageBase64,
    cachedUserId = null,
  ) => {
    try {
      // Use cached userId if provided, otherwise get it
      let userId = cachedUserId || user?.id;
      if (!userId) {
        userId = await getUserId(user);
      }

      if (!userId) {
        throw new Error("User not authenticated or not found in database");
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
      };

      // console.log('💾 Saving weight entry...', { weightValue: weightData.weightValue, unit: weightData.unit });

      const response = await fetch(`${apiBaseUrl}/api/save-weight-entry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to save weight entry");
      }

      console.log("✅ Weight entry saved successfully");

      // Hide saving overlay
      setSaveLoading(false);
      setLoadingState("idle");

      // Show success popup (similar to nutrition save)
      setError(null);

      // Keep imagePreview and selectedImage visible (like food images)
      // Don't reset them here
    } catch (err) {
      console.error("❌ Save weight error:", err);
      setSaveLoading(false);
      setLoadingState("idle");
      setError(err.message || "Failed to save weight entry");
      throw err;
    }
  };

  /**
   * Save weight entry to database with duplicate check
   */
  const saveWeightEntry = async (weightData, imageBase64) => {
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

        if (duplicateCheck.isDuplicate) {
          // Found duplicate - hide saving overlay and show confirmation modal
          // console.log('⚠️ Duplicate weight detected:', duplicateCheck);
          setSaveLoading(false); // Hide saving overlay while showing duplicate modal
          setLoadingState("idle");
          setDuplicateWeightInfo(duplicateCheck);
          setPendingWeightSaveData({
            weightData: weightData,
            imageBase64: imageBase64,
            userId: userId, // Cache userId for later use
          });
          setShowDuplicateWeightModal(true);
          return; // Stop here to wait for user confirmation
        }
      } catch (duplicateCheckErr) {
        // If duplicate check fails, log it but continue with save (fail-open)
        console.warn(
          "⚠️ Duplicate check failed, proceeding with save:",
          duplicateCheckErr,
        );
      }

      // No duplicate or duplicate check failed - proceed with save (pass cached userId)
      await performWeightSave(weightData, imageBase64, userId);
    } catch (err) {
      console.error("❌ Save weight error:", err);
      setError(err.message || "Failed to save weight entry");
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
      console.error("❌ Manual weight save error:", err);
      throw err; // Re-throw to show error in modal
    }
  };

  /**
   * Save education meeting log to database (AUTO-SAVE)
   * @param {Object} educationData - { platform, topic, confidence, participantCount }
   * @param {string} imageBase64 - Base64 encoded image
   */
  const saveEducationLog = async (educationData, imageBase64) => {
    try {
      console.log("💾 Auto-saving education log:", educationData);

      // Get the actual database UserId
      let userId = user?.id;
      if (!userId) {
        userId = await getUserId(user);
      }

      if (!userId) {
        throw new Error("User not authenticated or not found in database");
      }

      const response = await fetch(`${apiBaseUrl}/api/save-education-log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userId,
          imageBase64: imageBase64,
          platform: educationData.platform,
          topic: educationData.topic,
          confidence: educationData.confidence,
          deviceInfo: window.navigator.userAgent,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to save education log");
      }

      console.log("✅ Education log auto-saved successfully:", data.id);
      setSaveLoading(false);
      setLoadingState("idle");
    } catch (error) {
      console.error("❌ Failed to auto-save education log:", error);
      setError(
        error.message || "Failed to save education log. Please try again.",
      );
      setSaveLoading(false);
      setLoadingState("idle");
    }
  };

  // Helper function to perform nutrition save
  const performNutritionSave = async (saveData) => {
    try {
      console.log("🔵 [App] Starting nutrition save:", {
        userId: saveData.userId,
        imagePath: saveData.imagePath,
        hasImageBase64: !!saveData.imageBase64,
      });
      setSaveLoading(true);

      const saveRes = await saveNutritionAnalysis(saveData);
      console.log("✅ [App] Save successful:", saveRes);

      if (process.env.NODE_ENV !== "production") {
        // console.log('✅ Save successful:', saveRes);
      }

      // Store meal ID for NutritionCard auto-save updates
      setSavedNutritionMealId(saveRes.id || saveRes.insertId);
      console.log("✅ [App] Meal ID stored:", saveRes.id || saveRes.insertId);

      // ✅ ANDROID FIX: Don't auto-show popup - data is saved silently
      // Users can view saved data from Dashboard/Insights button
    } catch (err) {
      console.error("❌ [App] Save failed:", err);
      console.error("❌ [App] Error message:", err.message);
      console.error("❌ [App] Error stack:", err.stack);
      const friendlySaveError = getFriendlyErrorMessage(err);
      setSaveError(friendlySaveError);
      throw err;
    } finally {
      setSaveLoading(false);
      console.log("✅ [App] Save loading finished");
    }
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
        );
      } catch (err) {
        console.error(
          "❌ Weight save error after duplicate confirmation:",
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
    setImagePreview(null);
    setSelectedImage(null);

    // Reset ALL file inputs to allow selecting the same image again
    if (fileInputRef.current && fileInputRef.current.resetInputs) {
      fileInputRef.current.resetInputs();
    }
  };

  const handleImageSelect = async (file) => {
    if (imageProcessingInProgress.current) {
      console.log(
        "Image processing already in progress, skipping duplicate call",
      );
      return;
    }
    imageProcessingInProgress.current = true;

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
        "📸 Image file is too large. Please choose a smaller image (max 10MB).",
      );
      imageProcessingInProgress.current = false;
      return;
    }

    setSelectedImage(file);
    setError(null);
    setNutritionData(null);
    setWeightResult(null);
    setImageType(null);
    setSaveError(null);
    setDetectedFoodNames([]); // Clear previous detection
    setLoadingState("analyzing"); // Reset to analyzing state
    lastImageFileRef.current = file; // Store for retry

    // ✅ ANDROID PERFORMANCE: Use async FileReader for non-blocking operation
    try {
      const imageBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // ✅ ANDROID PERFORMANCE: Intelligent compression based on platform and size
      const isAndroid = Capacitor.isNativePlatform();
      const imageSizeMB = imageBase64.length / (1024 * 1024);

      let processedImage = imageBase64;
      let compressionApplied = false;

      // Aggressive compression for Android or large images
      if (isAndroid) {
        // Android: Always compress for speed
        if (imageSizeMB > 0.5) {
          // > 500KB
          const maxWidth = 1280; // Optimal for Android
          const quality = imageSizeMB > 2 ? 0.75 : 0.85; // More aggressive for larger images
          processedImage = await compressImage(imageBase64, quality, maxWidth);
          compressionApplied = true;
        }
      } else {
        // Web: Compress only if needed
        if (imageSizeMB > 2) {
          // > 2MB
          processedImage = await compressImage(imageBase64, 0.8, 1920);
          compressionApplied = true;
        }
      }

      if (compressionApplied && process.env.NODE_ENV !== "production") {
        const newSizeMB = processedImage.length / (1024 * 1024);
        // console.log(`🗜️ Image compressed: ${imageSizeMB.toFixed(2)}MB → ${newSizeMB.toFixed(2)}MB (${((1 - newSizeMB/imageSizeMB) * 100).toFixed(1)}% reduction)`);
      }

      // Set preview and loading together to ensure overlay shows
      setImagePreview(processedImage);
      setLoading(true); // Ensure loading is true when preview shows

      // Set current user for token tracking on imageTypeDetector (unified detection)
      if (user?.id && user?.email) {
        imageTypeDetector.setCurrentUser(user.id, user.email);
      }

      // ✅ Detect image type using Gemini AI (single unified call)
      const detectedType = await imageTypeDetector.detectImageType(file);
      console.log('🔍 [DEBUG] Image Type Detection Result:', {
        type: detectedType.type,
        confidence: detectedType.confidence,
        hasDetails: !!detectedType.details,
        hasFoods: detectedType.details?.foods?.length || 0,
        fullResponse: detectedType
      });

      // 🍽️ Early detection: If food items detected, show them immediately
      if (detectedType.details?.foods && detectedType.details.foods.length > 0) {
        const foodNames = detectedType.details.foods.map(f => f.name);
        console.log('🍽️ [AI-DETECTED] Food items identified:', foodNames.join(', '));
        setDetectedFoodNames(foodNames); // Show detected names in UI immediately
      }

      // ✅ PRIORITY 1: Check for education meeting (AUTO-SAVE)
      if (detectedType.type === "education" && detectedType.confidence > 0.7) {
        console.log("🎓 Education meeting detected, analyzing...");
        setImageType("education");

        try {
          // Use data from unified detection (no second API call needed)
          const educationData = {
            success: true,
            platform: detectedType.details.platform || "Online Meeting",
            topic: detectedType.details.topic || "Education Meeting",
            confidence: detectedType.confidence || 0,
            participantCount: detectedType.details.participantCount || null,
          };

          if (educationData && educationData.success) {
            console.log("✅ Education data extracted:", educationData);

            setEducationResult({
              platform: educationData.platform,
              topic: educationData.topic, // Already has fallback to "Education Meeting"
              confidence: educationData.confidence,
              participantCount: educationData.participantCount,
            });

            // AUTO-SAVE to database immediately
            setLoadingState("saving");
            setSaveLoading(true);
            await saveEducationLog(educationData, processedImage);
          } else {
            setError("Unable to analyze meeting screenshot. Please try again.");
          }
        } catch (err) {
          console.error("❌ Education analysis failed:", err);
          setError("Failed to analyze meeting screenshot: " + err.message);
        }

        setLoading(false);
        return;
      }

      // ✅ PRIORITY 2: Check for weight scale
      if (detectedType.type === "weight" && detectedType.confidence > 0.6) {
        // It's a weight scale - try to extract weight
        console.log("🔍 Weight scale detected, extracting metrics...");
        setImageType("weight");

        // Use weight data from unified detection (no second API call needed)
        let detectedWeight;

        if (detectedType.details?.weightValue) {
          // Weight was already extracted in the unified detection call
          console.log("✅ Using weight data from unified detection");
          detectedWeight = {
            success: true,
            weightValue: detectedType.details.weightValue,
            unit: detectedType.details.unit || "kg",
            confidence: detectedType.confidence,
            bmi: detectedType.details.bmi,
            bodyFat: detectedType.details.bodyFat,
            muscleMass: detectedType.details.muscleMass,
            bmr: detectedType.details.bmr,
          };
        } else {
          // Fallback: Weight value not extracted, need manual entry
          console.log(
            "⚠️ Weight value not detected in unified call, opening manual entry",
          );
          setCurrentWeightImage(processedImage);
          setShowManualWeightModal(true);
          setLoading(false);
          return;
        }

        if (detectedWeight.success && detectedWeight.weightValue) {
          // Successfully detected weight - save to database AND show result
          // console.log('✅ Weight detected:', detectedWeight);

          // Convert lbs to kg if needed
          let weightToSave = { ...detectedWeight };
          if (detectedWeight.unit === "lbs") {
            console.log(
              `🔄 Converting ${detectedWeight.weightValue} lbs to kg...`,
            );
            weightToSave.weightValue = weightDetectionService.convertWeight(
              detectedWeight.weightValue,
              "lbs",
              "kg",
            );
            weightToSave.unit = "kg";
            console.log(`✅ Converted to ${weightToSave.weightValue} kg`);
          }

          setWeightResult(weightToSave); // Store for display below upload box
          setLoadingState("saving");
          setSaveLoading(true); // Show saving overlay
          await saveWeightEntry(weightToSave, processedImage);
          // Don't clear imagePreview or return - let it show like food images
        } else {
          // Weight detection failed - show manual entry modal
          console.log("⚠️ Weight detection failed, opening manual entry modal");
          setCurrentWeightImage(processedImage);
          setShowManualWeightModal(true);
          setLoading(false);
          return;
        }

        setLoading(false);
        return;
      }

      // It's a food image - use nutrition data from unified detection
      setImageType("food");
      console.log('🍽️ [DEBUG] Processing as FOOD image');
      console.log('🍽️ [DEBUG] Food details check:', {
        hasDetails: !!detectedType.details,
        hasFoodsArray: !!detectedType.details?.foods,
        foodsLength: detectedType.details?.foods?.length || 0,
        foodsData: detectedType.details?.foods
      });

      try {
        // Use nutrition data already extracted from unified detection (no second API call)
        let result;

        if (
          detectedType.details?.foods &&
          detectedType.details.foods.length > 0
        ) {
          console.log("✅ Using nutrition data from unified detection");

          let foods = detectedType.details.foods;
          
          // 🎯 Update detected food names for display
          const foodNames = foods.map(f => f.name);
          setDetectedFoodNames(foodNames);
          console.log('🍽️ [AI-DETECTED] Food names:', foodNames.join(', '));

          // 🔴 CRITICAL: Preserve original AI-detected names BEFORE any corrections
          // This ensures we always know what the AI originally detected, even after auto-corrections
          foods = foods.map(food => ({
            ...food,
            originalAiName: food.name // Store the fresh AI detection
          }));
          console.log('✅ [PRESERVE] Original AI names saved:', foods.map(f => `${f.name}`).join(', '));

          // 🎯 APPLY USER'S PAST CORRECTIONS AUTOMATICALLY
          // console.log("📋 [CORRECTION] Starting auto-correction process...");
          // console.log(
          //   "📋 [CORRECTION] Foods before correction:",
          //   foods.map((f) => f.name),
          // );
          try {
            const userId = user?.id || (await getUserId(user));
            // console.log("📋 [CORRECTION] User ID for corrections:", userId);
            if (userId) {
              const correctedFoods = await applyUserCorrections(foods, userId);
              // console.log(
              //   "📋 [CORRECTION] Foods after correction:",
              //   correctedFoods.map((f) => f.name),
              // );
              foods = correctedFoods;
              
              // 🐛 Capture ALL food detections for debug modal (corrections + no corrections)
              const newLogs = correctedFoods.map(food => ({
                timestamp: new Date().toISOString(),
                aiDetected: food.originalAiName || food.name,
                userCorrected: food.name,
                finalDisplay: food.name,
                wasAutoCorrected: food.wasAutoCorrected || false,
                correctionSource: food.correctionSource || null,
                userCount: food.correctionMetadata?.userCount || 0,
                portion: food.portion || 'N/A',
                calories: food.nutrition?.calories || 0,
              }));
              
              if (newLogs.length > 0) {
                setCorrectionLogs(prev => [...newLogs, ...prev].slice(0, 50)); // Keep last 50 logs
                console.log('🐛 [DEBUG-LOGS] Captured', newLogs.length, 'food detection(s)');
              }
            } else {
              console.warn(
                "⚠️ [CORRECTION] No userId available, skipping corrections",
              );
            }
          } catch (error) {
            console.error(
              "❌ [CORRECTION] Failed to apply corrections:",
              error,
            );
            console.warn(
              "⚠️ Failed to apply corrections, using original AI detection:",
              error,
            );
          }
          // console.log(
          //   "📋 [CORRECTION] Final foods to be used:",
          //   foods.map((f) => f.name),
          // );

          // 🎯 ALWAYS recalculate totals from corrected foods (don't use original AI total)
          // Original code used: detectedType.details.total || foods.reduce(...)
          // This caused bug where corrected food (317 cal) showed wrong total (300 cal from AI)
          const total = foods.reduce(
            (acc, food) => ({
              calories: acc.calories + (food.nutrition?.calories || food.calories || 0),
              protein: acc.protein + (food.nutrition?.protein || food.protein || 0),
              carbs: acc.carbs + (food.nutrition?.carbs || food.carbs || 0),
              fat: acc.fat + (food.nutrition?.fat || food.fat || 0),
              fiber: acc.fiber + (food.nutrition?.fiber || food.fiber || 0),
            }),
            { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
          );
          
          console.log('📊 [App.js] Calculated total from corrected foods:', {
            totalCalories: total.calories,
            totalCarbs: total.carbs,
            totalProtein: total.protein,
            foodCount: foods.length
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

          // Transform to format expected by NutritionCard
          result = {
            nutrition: {
              calories: Math.round(total.calories || 0),
              protein: Math.round(total.protein || 0),
              carbs: Math.round(total.carbs || 0),
              fat: Math.round(total.fat || 0),
              fiber: Math.round(total.fiber || 0),
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
              // 🎯 Extract nutrition values from the corrected food object
              const nutritionValues = {
                calories: Math.round(food.nutrition?.calories || food.calories || 0),
                protein: Math.round(food.nutrition?.protein || food.protein || 0),
                carbs: Math.round(food.nutrition?.carbs || food.carbs || 0),
                fat: Math.round(food.nutrition?.fat || food.fat || 0),
                fiber: Math.round(food.nutrition?.fiber || food.fiber || 0),
              };
              
              console.log(`📊 [App.js] Mapping food "${food.name}" to detailedItem:`);
              console.log(`   From food object - Top-level: cal=${food.calories} carbs=${food.carbs} protein=${food.protein}`);
              console.log(`   From food object - Nested: cal=${food.nutrition?.calories} carbs=${food.nutrition?.carbs} protein=${food.nutrition?.protein}`);
              console.log(`   To detailedItem: cal=${nutritionValues.calories} carbs=${nutritionValues.carbs} protein=${nutritionValues.protein}`);
              
              return {
                name: food.name,
                originalAiName: food.originalAiName,  // 🔴 Preserve original AI detection
                wasAutoCorrected: food.wasAutoCorrected,  // 🔴 Track if auto-corrected
                correctionSource: food.correctionSource,  // 🔴 Track correction source
                correctionMetadata: food.correctionMetadata,  // 🔴 Full correction metadata
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
          console.error("❌ [DEBUG] No food data extracted from image");
          console.error("❌ [DEBUG] Detection details:", detectedType.details);
          console.error("❌ [DEBUG] Full detectedType object:", JSON.stringify(detectedType, null, 2));
          
          const errorDetails = detectedType.details?.error || '';
          const detectionReason = detectedType.details?.reason || '';
          let errorMessage = '';
          
          // 1. Check for API/Service errors (quota, timeout, rate limits)
          const isApiError = errorDetails && (
            errorDetails.includes('quota') || 
            errorDetails.includes('API') || 
            errorDetails.includes('timeout') ||
            errorDetails.includes('429') ||
            errorDetails.includes('503') ||
            errorDetails.includes('overloaded') ||
            errorDetails.includes('rate limit')
          );
          
          // 2. Check for network errors
          const isNetworkError = errorDetails && (
            errorDetails.includes('network') ||
            errorDetails.includes('Failed to fetch') ||
            errorDetails.includes('connection') ||
            errorDetails.toLowerCase().includes('internet')
          );
          
          // 3. Check if image is not food (weight scale, body, etc.)
          const isNonFoodImage = detectedType.type && (
            detectedType.type === 'weight_scale' ||
            detectedType.type === 'body' ||
            detectedType.type === 'not_food' ||
            detectionReason.toLowerCase().includes('scale') ||
            detectionReason.toLowerCase().includes('body') ||
            detectionReason.toLowerCase().includes('not food')
          );
          
          // 4. Image quality issues
          const isQualityIssue = detectionReason && (
            detectionReason.toLowerCase().includes('blurry') ||
            detectionReason.toLowerCase().includes('unclear') ||
            detectionReason.toLowerCase().includes('dark') ||
            detectionReason.toLowerCase().includes('low quality') ||
            detectionReason.toLowerCase().includes('poor lighting')
          );
          
          // Set appropriate error message
          if (isApiError) {
            errorMessage = "🤖 The AI model is temporarily unavailable. Please try again later.";
          } else if (isNetworkError) {
            errorMessage = "🌐 Please check your internet connection (WiFi or mobile data) and try again.";
          } else if (isNonFoodImage) {
            errorMessage = "⚠️ Please take a photo of food, weight scale, or educational content.";
          } else if (isQualityIssue) {
            errorMessage = "📸 Please take a clear photo with good lighting.";
          } else {
            errorMessage = "🍽️ Could not detect food items. Please take a clear photo of your meal.";
          }
          
          setError(errorMessage);
          setLoading(false);
          return;
        }

        setNutritionData(result);

        // Check for duplicate food before saving
        setLoadingState("saving"); // Switch to saving state
        setSaveLoading(true);
        try {
          // Edge case: User might be null or invalid
          if (!user) {
            console.error("No user available for duplicate check");
            throw new Error("Please sign in to save nutrition data");
          }

          const userIdentifier =
            user.email || user.id || user.uid || "anonymous";

          // Get actual userId for duplicate check
          let actualUserId = user?.id;
          if (!actualUserId) {
            try {
              actualUserId = await getUserId(user);
            } catch (userIdError) {
              console.error("Failed to get userId:", userIdError);
              // Edge case: If userId lookup fails, proceed without duplicate check
              await performNutritionSave({
                userId: userIdentifier,
                imagePath: file.name,
                imageBase64: processedImage,
                analysisResult: result,
                deviceInfo: window.navigator.userAgent,
                userEmail: user?.email || user?.Email || 'unknown'
              });
              return;
            }
          }

          // Edge case: userId still invalid after lookup
          if (!actualUserId) {
            console.warn(
              "Could not determine userId, skipping duplicate check",
            );
            await performNutritionSave({
              userId: userIdentifier,
              imagePath: file.name,
              imageBase64: processedImage,
              analysisResult: result,
              deviceInfo: window.navigator.userAgent,
              userEmail: user?.email || user?.Email || 'unknown'
            });
            return;
          }

          // Check for duplicates in current meal time slot
          let duplicateCheck;
          try {
            duplicateCheck =
              await duplicateDetectionService.checkForDuplicateFood({
                userId: actualUserId,
                analysisResult: result,
              });
          } catch (duplicateError) {
            // Edge case: Duplicate check failed (network error, etc.)
            console.error(
              "Duplicate check failed, proceeding with save:",
              duplicateError,
            );
            await performNutritionSave({
              userId: userIdentifier,
              imagePath: file.name,
              imageBase64: processedImage,
              analysisResult: result,
              deviceInfo: window.navigator.userAgent,
              userEmail: user?.email || user?.Email || 'unknown'
            });
            return;
          }

          // Edge case: Invalid duplicate check response
          if (!duplicateCheck || typeof duplicateCheck !== "object") {
            console.warn(
              "Invalid duplicate check response, proceeding with save",
            );
            await performNutritionSave({
              userId: userIdentifier,
              imagePath: file.name,
              imageBase64: processedImage,
              analysisResult: result,
              deviceInfo: window.navigator.userAgent,
              userEmail: user?.email || user?.Email || 'unknown'
            });
            return;
          }

          if (duplicateCheck.isDuplicate) {
            // Found duplicate - show confirmation modal
            console.log("⚠️ Duplicate food detected:", duplicateCheck);
            setDuplicateInfo(duplicateCheck);
            setPendingSaveData({
              userId: userIdentifier,
              imagePath: file.name,
              imageBase64: processedImage,
              analysisResult: result,
              deviceInfo: window.navigator.userAgent,
              userEmail: user?.email || user?.Email || 'unknown'
            });
            setShowDuplicateModal(true);
            setSaveLoading(false);
          } else {
            // No duplicate - proceed with save
            await performNutritionSave({
              userId: userIdentifier,
              imagePath: file.name,
              imageBase64: processedImage,
              analysisResult: result,
              deviceInfo: window.navigator.userAgent,
              userEmail: user?.email || user?.Email || 'unknown'
            });
          }
        } catch (err) {
          // Handle save errors
          console.error("❌ Save failed:", err.message);

          const friendlySaveError = getFriendlyErrorMessage(err);
          setSaveError(friendlySaveError);
          setSaveLoading(false);
        }
      } catch (err) {
        const friendlyMessage = getFriendlyErrorMessage(err);
        setError(friendlyMessage);
        console.error("❌ Gemini analysis error:", err);
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

      setError("Failed to process image: " + errorMessage);
      console.error("❌ Image processing error:", err);
    } finally {
      setLoading(false);
      imageProcessingInProgress.current = false;
    }
  };

  // 🔄 Retry food analysis with the last image
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
    } else if (rawMessage.includes("503") || rawMessage.includes("overloaded")) {
      return "The AI model is temporarily unavailable. Please try again later.";
    } else if (rawMessage.includes("quota") || rawMessage.includes("exceeded")) {
      return "The AI model is temporarily unavailable. Please try again later.";
    } else if (rawMessage.includes("API key is not configured")) {
      return "The AI model is temporarily unavailable. Please try again later.";
    } else if (rawMessage.includes("models/") && rawMessage.includes("not found")) {
      return "The AI model is temporarily unavailable. Please try again later.";
    }

    // Network and connectivity errors  
    else if (rawMessage.includes("network") || rawMessage.includes("Failed to fetch")) {
      return "🌐 Please check your internet connection (WiFi or mobile data) and try again.";
    } else if (rawMessage.includes("timeout")) {
      return "🌐 Please check your internet connection (WiFi or mobile data) and try again.";
    } else if (rawMessage.includes("connection")) {
      return "🌐 Please check your internet connection (WiFi or mobile data) and try again.";
    }

    // Server errors
    else if (rawMessage.includes("500") || rawMessage.includes("Internal Server Error")) {
      return "The AI model is temporarily unavailable. Please try again later.";
    } else if (rawMessage.includes("Server returned an unexpected response format")) {
      return "💾 Unable to save your analysis right now. Your food data is still displayed above.";
    }

    // Image and analysis errors
    else if (rawMessage.includes("Image file is too large")) {
      return "📸 Image file is too large. Please use a smaller photo (max 10MB).";
    } else if (rawMessage.includes("No food items detected")) {
      return "🍽️ Could not detect food items. Please take a clear photo of your meal.";
    } else if (rawMessage.includes("Invalid response format")) {
      return "🤖 The AI model is temporarily unavailable. Please try again later.";
    }

    // Generic fallback
    else if (rawMessage.toLowerCase().includes("analysis")) {
      return "💾 Unable to save your analysis. The nutrition data is still shown above.";
    }

    return "❌ Something went wrong. Please try again.";
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
    setEducationResult(null); // Clear education results
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

    localStorage.removeItem("isOtpVerified");
    localStorage.removeItem("otpUser");
    localStorage.removeItem("currentPage");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSignIn = async (forceRedirect = false) => {
    try {
      setLoading(true);
      setError(null);

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
            localStorage.setItem("userEmail", userEmail);
            console.log(
              "✅ [handleSignIn] Stored user email in localStorage:",
              userEmail,
            );
          }
          
          // Save user to backend first
          const saveResult = await saveUserToBackend(user);
          console.log("📦 [handleSignIn] saveResult:", saveResult);
          const isNewUser = saveResult?.isNewUser === true;
          console.log("🆕 [handleSignIn] isNewUser:", isNewUser);

          // Clear the safety timeout immediately after save completes
          clearTimeout(safetyTimeout);

          // ⚠️ CRITICAL: Check if sign-out was triggered while we were saving
          if (signOutInProgress.current) {
            sessionStorage.removeItem("freshGoogleSignIn");
            return;
          }

          // ✅ CRITICAL: Clear the fresh sign-in flag NOW
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
            // Show profile modal for new users to complete their profile
            if (isNewUser) {
              console.log("🆕 [handleSignIn] New user - showing profile modal");
              // Small delay to ensure user state is set before showing modal
              setTimeout(() => {
                setShowNewUserProfileModal(true);
              }, 500);
            }
          } else {
            // User was saved but is inactive or not found - modal will show
            setUser(user); // Keep user state so modal can show user email
          }
        } catch (saveError) {
          // If save fails, still allow user to proceed (fail-open for backend issues)
          console.error(
            "⚠️ Backend save/check failed, allowing user access:",
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
        console.log("🔄 Redirect initiated, waiting for result...");
        // Don't clear timeout yet for redirect flow
      }
    } catch (error) {
      console.error("❌ Sign in error:", error);
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
            localStorage.setItem("userEmail", userEmail);
            console.log(
              "✅ [handlePopupSignIn] Stored user email in localStorage:",
              userEmail,
            );
          }
          
          // Save user to backend first
          const saveResult = await saveUserToBackend(user);
          console.log("📦 [handlePopupSignIn] saveResult:", saveResult);
          const isNewUser = saveResult?.isNewUser === true;
          console.log("🆕 [handlePopupSignIn] isNewUser:", isNewUser);

          // Clear the safety timeout immediately after save completes
          clearTimeout(safetyTimeout);

          // ⚠️ CRITICAL: Check if sign-out was triggered while we were saving
          if (signOutInProgress.current) {
            sessionStorage.removeItem("freshGoogleSignIn");
            return;
          }

          // ✅ CRITICAL: Clear the fresh sign-in flag NOW
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
            // Show profile modal for new users to complete their profile
            if (isNewUser) {
              console.log(
                "🆕 [handlePopupSignIn] New user - showing profile modal",
              );
              // Small delay to ensure user state is set before showing modal
              setTimeout(() => {
                setShowNewUserProfileModal(true);
              }, 500);
            }
          } else {
            // User was saved but is inactive or not found - modal will show
            setUser(user); // Keep user state so modal can show user email
          }
        } catch (saveError) {
          // If save fails, still allow user to proceed (fail-open for backend issues)
          console.error(
            "⚠️ Backend save/check failed, allowing user access:",
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
      console.error("❌ Popup sign-in error:", error);
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
      const response = await fetch(`${apiBaseUrl}/api/save-google-user`, {
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
        console.log(
          "✅ [saveUserToBackend] User saved successfully, isNewUser:",
          data.isNewUser,
        );

        // If this is a new user, trigger the profile modal
        if (data.isNewUser) {
          console.log(
            "🆕 [saveUserToBackend] New user detected, will show profile modal",
          );
        }
      } else {
        console.warn(
          "⚠️ [saveUserToBackend] Save completed with warning:",
          data,
        );
      }

      return data;
    } catch (error) {
      console.error(
        "❌ [saveUserToBackend] Failed to save user to backend:",
        error,
      );
      throw error; // Re-throw so caller can handle
    }
  };

  const handleSignOut = async () => {
    try {
      setLoading(true);

      // Set sign-out in progress flag to prevent concurrent sign-in
      signOutInProgress.current = true;

      // Clear the fresh sign-in flag immediately to prevent re-login issues
      sessionStorage.removeItem("freshGoogleSignIn");

      // Clear user context cache
      clearContextCache();
      setUserContext(null);
      setUserContextLoading(false);
      console.log("🗑️ [Sign Out] User context cache and state cleared");

      // Clear userId session cache
      clearUserIdCache();
      console.log("🗑️ [Sign Out] UserId cache cleared");

      if (Capacitor.isNativePlatform()) {
        try {
          await GalleryMonitor.clearCurrentUser();
        } catch (clearError) {
          console.error(
            "⚠️ Failed to clear GalleryMonitor user (method may not exist):",
            clearError,
          );
          // Continue with sign out even if this fails
        }
      }
      await signOutUser();
      resetApp();
    } catch (error) {
      console.error("❌ Sign out error:", error);
      setError("Failed to sign out. Please try again.");
    } finally {
      setLoading(false);
      // Reset the sign-out flag after a delay to allow cleanup
      setTimeout(() => {
        signOutInProgress.current = false;
      }, 1000);
    }
  };

  const handleOtpVerified = async (isNewUser = false) => {
    console.log("🔐 [handleOtpVerified] Called with isNewUser:", isNewUser);

    // Get the OTP user from localStorage
    const otpUser = localStorage.getItem("otpUser");

    if (otpUser) {
      try {
        const parsedUser = JSON.parse(otpUser);

        // Check user status before allowing access
        const isActive = await checkUserStatus(parsedUser);

        if (!isActive) {
          // Set user state so modal can show user email
          setUser(parsedUser);
          // Set OTP verified to false to prevent login completion
          setIsOtpVerified(false);
          // Don't set isOtpVerified to true - keep at login screen with modal
          return;
        }

        setIsOtpVerified(true);
        localStorage.setItem("isOtpVerified", "true");
        
        // Store user email in localStorage for API calls
        const userEmail = parsedUser.email || parsedUser.Email;
        if (userEmail) {
          localStorage.setItem("userEmail", userEmail);
          console.log(
            "✅ [handleOtpVerified] Stored user email in localStorage:",
            userEmail,
          );
        }
        
        setUser(parsedUser);

        // Show profile modal for new users
        if (isNewUser || parsedUser.isNewUser) {
          console.log(
            "🆕 [handleOtpVerified] New user - showing profile modal",
          );
          setTimeout(() => {
            setShowNewUserProfileModal(true);
          }, 500);
        }
      } catch (error) {
        console.error("Failed to check OTP user status:", error);
      }
    } else {
      // No OTP user found, proceed with verification
      setIsOtpVerified(true);
      localStorage.setItem("isOtpVerified", "true");
    }
  };

  // Loading state
  if (authLoading) {
    return <LoadingSpinner context="normal" />;
  }

  // Authentication flow
  if (!user && !isOtpVerified) {
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
            userEmail={user?.email}
            onClose={handleInactiveModalClose}
          />
        )}
        {showUserNotFoundModal && (
          <UserNotFoundModal
            userEmail={user?.email}
            onClose={handleUserNotFoundModalClose}
          />
        )}
      </>
    );
  }
  const isGoogleUserCheck = user && isGoogleUser(user);
  if (!isOtpVerified && !isGoogleUserCheck) {
    return (
      <>
        <Login
          onSignIn={isMobileDevice() ? handleSignIn : handlePopupSignIn}
          loading={loading}
          error={error}
          onOtpVerified={handleOtpVerified}
          forceOtpVerification={true}
        />
        {showInactiveModal && (
          <InactiveUserModal
            userEmail={user?.email}
            onClose={handleInactiveModalClose}
          />
        )}
        {showUserNotFoundModal && (
          <UserNotFoundModal
            userEmail={user?.email}
            onClose={handleUserNotFoundModalClose}
          />
        )}
      </>
    );
  }

  // Full page dashboard with lazy loading (replaces Nutrition Dashboard, Weight Tracking, Weight Insights)
  if (showDashboard) {
    return (
      <Suspense fallback={<LoadingSpinner context="normal" />}>
        <Dashboard
          user={user}
          onBack={showMainPage}
          apiBaseUrl={apiBaseUrl}
          initialTab={dashboardInitialTab}
        />
      </Suspense>
    );
  }

  // Discipline Report for all users
  if (showDisciplineReport) {
    return (
      <Suspense
        fallback={<LoadingSpinner message="Loading discipline report..." />}
      >
        <DisciplineReport
          user={user}
          onBack={() => {
            setShowDisciplineReport(false);
            localStorage.setItem("currentPage", "main");
          }}
          apiBaseUrl={apiBaseUrl}
          userRole={userRole}
        />
      </Suspense>
    );
  }

  // Main app interface
  return (
    <div className="h-screen w-screen bg-gradient-to-br from-green-50 to-green-100 flex flex-col overflow-hidden">
      <Header
        user={user}
        onShowBackgroundHistory={showDashboardPage}
        onShowAdminDashboard={
          userRole === "admin" || userRole === "developer"
            ? () => setShowAdminDashboard(true)
            : null
        }
        onShowDisciplineReport={() => {
          setShowDisciplineReport(true);
          localStorage.setItem("currentPage", "discipline-report");
        }}
        onSignOut={handleSignOut}
      />

      {/* Weight Loss Leaderboard Strip - Configure in src/config/leaderboardConfig.js */}
      <WeightLossLeaderboard 
        apiBaseUrl={apiBaseUrl} 
        topN={LEADERBOARD_CONFIG.TOP_N} 
        useDemoData={LEADERBOARD_CONFIG.USE_DEMO_DATA}
      />

      <div className="flex-1 overflow-y-auto px-4 pt-28 pb-6">
        <div className="max-w-md w-full mx-auto space-y-6">
        {/* Back button toast message */}
        {toast.visible && (
          <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-white text-gray-800 px-4 py-2 rounded-lg shadow-xl z-[9999] text-sm border border-gray-200">
            {toast.message}
          </div>
        )}

        <ImageUpload
          onImageSelect={handleImageSelect}
          imagePreview={imagePreview}
          loading={loading}
          loadingState={loadingState}
          imageType={imageType}
          detectedFoodNames={detectedFoodNames}
          ref={fileInputRef}
          onHelpClick={() => setShowHowToUse(!showHowToUse)}
        />

        {error && (
          <div className="bg-white border border-red-200 text-red-600 px-4 py-3 rounded-xl shadow-sm">
            <div className="flex items-start space-x-3">
              <div className="text-xl">⚠️</div>
              <div className="flex-1">
                <p className="font-semibold">Error</p>
                <p className="text-sm leading-relaxed whitespace-pre-line">{error}</p>
              </div>
            </div>
            {lastImageFileRef.current && (
              <div className="mt-2 flex gap-2 justify-end">
                <TouchFeedbackButton
                  onClick={handleRetryAnalysis}
                  className="bg-green-600 text-white px-3 py-1.5 rounded-md text-xs font-medium hover:bg-green-700 active:bg-green-800 transition-colors"
                >
                  Retry
                </TouchFeedbackButton>
                <TouchFeedbackButton
                  onClick={() => { setError(null); setImagePreview(null); lastImageFileRef.current = null; }}
                  className="px-3 py-1.5 rounded-md text-xs font-medium border border-gray-300 text-gray-500 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                >
                  Dismiss
                </TouchFeedbackButton>
              </div>
            )}
          </div>
        )}

        {imageType === "food" && nutritionData && (
          <NutritionCard
            data={nutritionData}
            user={user}
            imagePreview={imagePreview}
            selectedImage={selectedImage}
            savedMealId={savedNutritionMealId}
            onClose={() => {
              setNutritionData(null);
              setImagePreview(null);
              setSelectedImage(null);
              setSavedNutritionMealId(null);
            }}
          />
        )}

        {/* Education Meeting Result */}
        {imageType === "education" && educationResult && (
          <EducationLogCard
            educationData={educationResult}
            imagePreview={imagePreview}
            onClose={() => {
              setEducationResult(null);
              setImagePreview(null);
              setSelectedImage(null);
            }}
          />
        )}

        {imageType === "weight" && weightResult && (
          <>
            {/* Hidden container for sharing - includes image + card */}
            <div
              ref={weightAnalysisShareRef}
              className="fixed -left-[9999px] top-0 w-[400px]"
              style={{ position: "fixed", left: "-9999px" }}
            >
              <div className="bg-white rounded-2xl shadow-xl border-2 border-teal-400 overflow-hidden">
                {/* Weight Image for sharing */}
                {imagePreview && (
                  <div className="relative bg-black">
                    <img
                      src={imagePreview}
                      alt="Weight Scale"
                      className="w-full h-64 object-contain"
                    />
                  </div>
                )}

                {/* Card content for sharing - Simple and Clean */}
                <div className="bg-white p-8">
                  <h2 className="text-2xl font-bold text-emerald-600 mb-6 text-center">Weight Analysis</h2>
                  
                  <div className="bg-purple-50 rounded-2xl p-6 text-center">
                    <p className="text-sm font-semibold text-purple-600 mb-2 uppercase tracking-wide">Weight</p>
                    <p className="text-5xl font-bold text-purple-700">
                      {weightResult.weightValue}
                      <span className="text-2xl font-normal ml-2">{weightResult.unit}</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Visible card */}
            <div className="bg-white rounded-xl shadow-lg border-2 border-white-200 p-6">
              <h2 className="text-xl font-bold text-green-700 flex items-center mb-4">
                Weight Analysis
              </h2>

              <div className="bg-purple-50 rounded-lg p-4 border border-purple-100 text-center flex flex-col items-center">
                <p className="text-sm text-purple-600 font-medium mb-1">
                  Weight
                </p>

                <p className="text-3xl font-bold text-purple-700">
                  {weightResult.weightValue}
                  <span className="text-lg font-normal ml-1">
                    {weightResult.unit}
                  </span>
                </p>
              </div>

              {/* Share Button at Bottom - Only show if there's an image */}
              {imagePreview && (
                <button
                  onClick={async () => {
                    if (isWeightSharing) return;
                    setIsWeightSharing(true);
                    try {
                      // Small delay to ensure hidden container is fully rendered
                      await new Promise(resolve => setTimeout(resolve, 100));
                      
                      await captureAndShare(weightAnalysisShareRef.current, {
                        title: `Weight Record - ${weightResult.weightValue} ${weightResult.unit}`,
                        text: `My weight: ${weightResult.weightValue} ${weightResult.unit}\n\nTracked with Wellness Valley \uD83D\uDC9A`,
                        fileName: `wellness-valley-weight-${weightResult.weightValue}${weightResult.unit}.png`,
                      });
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

{showHowToUse && ( <div className="bg-white rounded-xl shadow-lg border border-green-200 p-4 relative"> <button onClick={() => setShowHowToUse(false)} className="absolute top-4 right-4 text-gray-600 text-xl hover:text-gray-800 transition-colors focus:outline-none" aria-label="Close" > × </button> <h3 className="font-semibold text-green-700 mb-2">📋 How to use:</h3> <div className="space-y-3"> <div> <h4 className="font-medium text-green-600 mb-1"> 📸 Image Analysis: </h4>
              <ol className="text-sm text-gray-600 space-y-1 ml-4">
                <li>1. Take a clear photo of your food or weight</li>
                <li>
                  2. Make sure the food or weight are well-lit and visible
                </li>
                <li>
                  3. View detailed nutrition breakdown for detected foods or
                  weights
                </li>
              </ol>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-gray-200">
            <h4 className="font-semibold text-green-700 mb-2">
              💡 Tips for better results:
            </h4>
            <ul className="text-xs text-gray-600 space-y-1">
              <li>• Take photos in good lighting conditions </li>
              <li>• Ensure food items or weights are clearly visible</li>
              <li>• Avoid cluttered backgrounds </li>
              <li>
                • For text queries, be specific about preparation methods{" "}
              </li>
            </ul>
          </div>
        </div>
        )}

        <TestImageGuide
          isVisible={showTestGuide}
          onClose={() => setShowTestGuide(false)}
        />
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
        />
      )}

      {/* User Not Found Modal */}
      {showUserNotFoundModal && (
        <UserNotFoundModal
          userEmail={user?.email || user?.Email || "your account"}
          onClose={handleUserNotFoundModalClose}
        />
      )}

      {/* Manual Weight Entry Modal */}
      <ManualWeightEntryModal
        isOpen={showManualWeightModal}
        onClose={() => {
          setShowManualWeightModal(false);
          setCurrentWeightImage(null);
          setLoading(false);
        }}
        onSave={handleManualWeightSave}
        imagePreview={currentWeightImage}
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
          onConfirm={handleDuplicateWeightConfirm}
          onCancel={handleDuplicateWeightCancel}
        />
      )}

      {/* New User Profile Modal - shown for first-time users to complete their profile */}
      <UserProfileModal
        isOpen={showNewUserProfileModal}
        onClose={() => setShowNewUserProfileModal(false)}
        user={user}
        onProfileUpdate={() => {
          console.log("✅ [NewUserProfile] Profile updated successfully");
        }}
      />

      {/* Admin Dashboard */}
      {showAdminDashboard && (
        <Suspense
          fallback={<LoadingSpinner message="Loading admin dashboard..." />}
        >
          <AdminDashboard
            onClose={() => setShowAdminDashboard(false)}
            user={user}
          />
        </Suspense>
      )}

      {/* Setup Wizard - Team ID + Coach Selection */}
      {showSetupWizard && (
        <Suspense fallback={<LoadingSpinner message="Loading setup..." />}>
          <SetupWizard
            userEmail={
              user?.email || user?.Email || localStorage.getItem("userEmail")
            }
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
        <Suspense fallback={<LoadingSpinner message="Loading validation..." />}>
          <ValidateOTP
            onClose={() => {
              setShowValidateOTP(false);
              setShowSetupWizard(true);
            }}
            onSuccess={() => {
              setShowValidateOTP(false);
              // Setup complete, user can now access dashboard
            }}
            onLogout={handleSignOut}
          />
        </Suspense>
      )}

      {/* 🐛 Floating Bug Button - Show Correction Logs (Web & Android) */}
      {/* {user && (
        <button
          onClick={() => setShowCorrectionModal(true)}
          disabled={correctionLogs.length === 0}
          className={`fixed bottom-24 right-6 md:bottom-8 md:right-8 z-50 text-white p-4 rounded-full shadow-lg transition-all duration-200 ${
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

      {/* 🐛 Correction Logs Modal (Web & Android Optimized) */}
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
                  <h2 className="text-xl md:text-2xl font-bold">Food Correction Logs</h2>
                  <p className="text-orange-100 text-xs md:text-sm">
                    AI Detection vs User Corrections ({correctionLogs.length} entries)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCorrectionModal(false)}
                className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
                aria-label="Close modal"
              >
                <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-gray-900">
              {correctionLogs.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Bug className="w-16 h-16 mx-auto mb-4 opacity-20" />
                  <p className="text-lg font-semibold">No correction logs yet</p>
                  <p className="text-sm">Upload food images to see correction logs</p>
                </div>
              ) : (
                correctionLogs.map((log, index) => (
                  <div
                    key={index}
                    className="bg-gray-950 rounded-lg p-4 md:p-5 border border-gray-700 font-mono text-xs md:text-sm"
                  >
                    {/* Timestamp Header */}
                    <div className="text-gray-400 mb-3 pb-2 border-b border-gray-700">
                      <span className="text-blue-400">📅 {new Date(log.timestamp).toLocaleString()}</span>
                      {log.wasAutoCorrected && (
                        <span className="ml-3 bg-green-900 text-green-300 px-2 py-1 rounded text-xs">
                          ✅ AUTO-CORRECTED
                        </span>
                      )}
                    </div>

                    {/* Main Correction Flow Box */}
                    <div className="bg-gray-800 rounded p-4 mb-3 border border-gray-600">
                      <div className="text-blue-400 font-bold mb-2">
                        ╔════════════════════════════════════════════════════════════════
                      </div>
                      <div className="text-blue-400 font-bold mb-1">
                        ║ 🔄 FOOD CORRECTION FLOW
                      </div>
                      <div className="text-blue-400 font-bold mb-2">
                        ╠════════════════════════════════════════════════════════════════
                      </div>
                      
                      <div className="text-white mb-1">
                        <span className="text-gray-400">║</span> 🤖 <span className="text-cyan-400">AI Detected Name:</span>
                        <span className="ml-4 text-yellow-300">"{log.aiDetected}"</span>
                      </div>
                      
                      {log.aiDetected.trim().toLowerCase() === log.userCorrected.trim().toLowerCase() ? (
                        <div className="text-white mb-2">
                          <span className="text-gray-400">║</span> ✓ <span className="text-cyan-400">Status:</span>
                          <span className="ml-2 text-green-300">No Correction - User accepted AI suggestion</span>
                        </div>
                      ) : (
                        <div className="text-white mb-2">
                          <span className="text-gray-400">║</span> 👤 <span className="text-cyan-400">User Corrected To:</span>
                          <span className="ml-2 text-green-300">"{log.userCorrected}"</span>
                        </div>
                      )}
                      
                      <div className="text-white mb-2">
                        <span className="text-gray-400">║</span> 📊 <span className="text-cyan-400">Final Display Name:</span>
                        <span className="ml-2 text-green-300">"{log.finalDisplay}"</span>
                      </div>
                      
                      <div className="text-blue-400 font-bold">
                        ╚════════════════════════════════════════════════════════════════
                      </div>
                    </div>

                    {/* Individual Console Logs */}
                    <div className="space-y-1 text-gray-300">
                      <div>
                        <span className="text-blue-400">🤖 [AI-DETECTED]</span> 
                        <span className="ml-2">Original: <span className="text-yellow-300">{log.aiDetected}</span></span>
                      </div>
                      
                      {log.aiDetected.trim().toLowerCase() === log.userCorrected.trim().toLowerCase() ? (
                        <div>
                          <span className="text-green-400">✓ [NO-CORRECTION]</span> 
                          <span className="ml-2">User accepted AI suggestion</span>
                        </div>
                      ) : (
                        <div>
                          <span className="text-green-400">👤 [USER-CORRECTED]</span> 
                          <span className="ml-2">Mapped to: <span className="text-green-300">{log.userCorrected}</span></span>
                        </div>
                      )}
                      
                      <div>
                        <span className="text-purple-400">📊 [FINAL-DISPLAY]</span> 
                        <span className="ml-2">Will show: <span className="text-green-300">{log.finalDisplay}</span></span>
                      </div>
                    </div>

                    {/* Structured Data Object */}
                    <div className="mt-3 pt-3 border-t border-gray-700">
                      <div className="text-gray-400">[CORRECTION-DATA]</div>
                      <pre className="text-xs text-gray-300 mt-1 overflow-x-auto">
{JSON.stringify({
  aiDetected: log.aiDetected,
  userCorrected: log.userCorrected,
  finalDisplay: log.finalDisplay,
  userCount: log.userCount,
  portion: log.portion,
  calories: log.calories,
  timestamp: log.timestamp
}, null, 2)}
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
                    const logText = correctionLogs.map(log => 
                      `${new Date(log.timestamp).toLocaleString()}\n` +
                      `AI: ${log.aiDetected} → Corrected: ${log.userCorrected} → Final: ${log.finalDisplay}\n` +
                      `Stats: Users ${log.userCount} | ${log.portion} | ${log.calories}cal\n`
                    ).join('\n');
                    navigator.clipboard?.writeText(logText)
                      .then(() => alert('Logs copied to clipboard!'))
                      .catch(() => console.log('Copy not supported'));
                  }}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg font-semibold transition-colors text-sm"
                >
                  📋 Copy Logs
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
    </div>
  );
}

export default WellnessValleyApp;
