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
import { Geolocation } from "@capacitor/geolocation";
import { Camera } from "@capacitor/camera";
import { SplashScreen } from "@capacitor/splash-screen";
import { Bug, Share2, Pencil, Check, X as XIcon } from "lucide-react";
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
import { locationAttendanceService } from "./services/locationAttendanceService";
import { validateImageFreshness } from "./utils/imageValidator";
import ManualWeightEntryModal from "./components/ManualWeightEntryModal";
import DuplicateFoodModal from "./components/DuplicateFoodModal";
import UserProfileModal from "./components/UserProfileModal";
import CompleteProfilePage from "./components/CompleteProfilePage";
import MandatoryProfilePictureModal from "./components/MandatoryProfilePictureModal";
import ClubSelectionModal from "./components/ClubSelectionModal";
import CustomAlertModal from "./components/CustomAlertModal";
import WeightLossLeaderboard from "./components/WeightLossLeaderboard";
import DisciplineLeaderboard from "./components/DisciplineLeaderboard";
import CoachScoreSummary from "./components/CoachScoreSummary";
import PersonalDisciplineScore from "./components/PersonalDisciplineScore";
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
const ActivityTimeReport = lazy(() => import("./components/ActivityTimeReport"));
const AttendanceReport = lazy(() => import("./components/AttendanceReport"));
const ClubAttendanceReport = lazy(() =>
  import("./components/ClubAttendanceReport"),
);
const NutritionCentersMap = lazy(() =>
  import("./components/NutritionCentersMap"),
);
const NutritionCenterRegistration = lazy(() =>
  import("./components/NutritionCenterRegistration"),
);
const SetupWizard = lazy(() => import("./pages/SetupWizard"));
const ValidateOTP = lazy(() => import("./pages/ValidateOTP"));

const WellnessUniversityEnrollment = lazy(() =>
  import("./pages/WellnessUniversityEnrollment"),
);
const WellnessUniversityReport = lazy(() =>
  import("./pages/WellnessUniversityReport"),
);
const WellnessCounselling = lazy(() =>
  import("./pages/WellnessCounselling"),
);
const StepCounter = lazy(() => import("./components/StepCounter"));
const ScreenTimePage = lazy(() => import("./pages/ScreenTimePage"));
const ReminderSettingsPage = lazy(() => import("./pages/ReminderSettingsPage"));

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
  const [bmrUpdateKey, setBmrUpdateKey] = useState(0); // Increment to force BMR re-fetch in NutritionDashboard
  const [showStepCounter, setShowStepCounter] = useState(false);
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
  const [imageTimestamp, setImageTimestamp] = useState(null); // EXIF timestamp from image
  // Education time window fetched from DB (e.g. 07:15 - 08:45) — no hardcoding
  const [educationWindow, setEducationWindow] = useState(null);
  const [weightResult, setWeightResult] = useState(null); // Store weight detection results
  const [savedWeightId, setSavedWeightId] = useState(null); // ID of the saved weight entry for editing
  const savedWeightIdRef = useRef(null); // Ref mirror — always current inside async handlers
  const [isEditingWeight, setIsEditingWeight] = useState(false); // Inline edit mode
  const [editWeightValue, setEditWeightValue] = useState(""); // Value being edited
  const [isSavingWeightEdit, setIsSavingWeightEdit] = useState(false); // Loading for edit save
  const [weightEditError, setWeightEditError] = useState(""); // Edit validation error
  const [pendingWeightImage, setPendingWeightImage] = useState(null); // Image waiting to be saved
  const [weightEntrySaved, setWeightEntrySaved] = useState(false); // Whether entry was saved to DB
  const [weightDiff, setWeightDiff] = useState(null); // { previous: number, change: number, date: string } | null
  const [educationResult, setEducationResult] = useState(null); // Store education meeting results
  const [sharePhotoBase64, setSharePhotoBase64] = useState(null); // CORS-safe base64 photo for share card
  const [savedProfileImage, setSavedProfileImage] = useState(null); // Custom profile image for share card
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

  // Club selection state
  const [showClubSelectionModal, setShowClubSelectionModal] = useState(false);
  const [nearbyCenters, setNearbyCenters] = useState([]);
  const [pendingEducationData, setPendingEducationData] = useState(null);

  // Custom alert modal state
  const [alertModal, setAlertModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    type: "info",
  });

  // New user profile modal state - show profile page for first-time users
  const [showNewUserProfileModal, setShowNewUserProfileModal] = useState(false);

  // Mandatory profile picture modal state - show when user has no valid profile picture
  const [showMandatoryProfilePictureModal, setShowMandatoryProfilePictureModal] = useState(false);

  // Ref to prevent race conditions re-showing the gate after a successful save.
  // Initialised from localStorage so it persists across page refreshes.
  const storedEmail = localStorage.getItem("userEmail") || "";
  const profileCompletedRef = useRef(
    storedEmail !== "" &&
      localStorage.getItem("profileComplete_v2_" + storedEmail) === "true",
  );

  // Profile update trigger - increment this to force Dashboard to refetch BMR
  const [profileUpdateTrigger, setProfileUpdateTrigger] = useState(0);
  // True while checkProfileCompletion() is in flight — gate must not render during this window.
  const [profileChecking, setProfileChecking] = useState(false);
  // Start hidden — only checkProfileCompletion() (called after setup is confirmed complete)
  // will turn this on, preventing the gate from flashing for new users going through SetupWizard.
  const [showCompleteProfile, setShowCompleteProfile] = useState(false);

  // User context state - stored and reused for AI personalization
  const [userContext, setUserContext] = useState(null);
  const [userContextLoading, setUserContextLoading] = useState(false);

  // User role state - for role-based access control
  const [userRole, setUserRole] = useState("user");

  // Admin dashboard state
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);

  // Discipline report state (for coaches) - with localStorage persistence
  const [showDisciplineReport, setShowDisciplineReport] = useState(false);
  const [showActivityTimeReport, setShowActivityTimeReport] = useState(false);

  // Step Counter state
  const showStepCounterPage = useCallback(() => {
    setShowStepCounter(true);
  }, []);

  // Screen Time state
  const [showScreenTime, setShowScreenTime] = useState(false);
  const showScreenTimePage = useCallback(() => {
    setShowScreenTime(true);
  }, []);

  // Reminders state
  const [showReminders, setShowReminders] = useState(false);
  const showRemindersPage = useCallback(() => {
    setShowReminders(true);
  }, []);

  // Attendance report state (for coaches)
  const [showAttendanceReport, setShowAttendanceReport] = useState(false);

  // Club attendance report state (for coaches/club owners)
  const [showClubAttendanceReport, setShowClubAttendanceReport] =
    useState(false);

  // Nutrition centers map state (for all users)
  const [showNutritionCentersMap, setShowNutritionCentersMap] = useState(false);

  // Register nutrition center state (for coaches)
  const [showRegisterCenter, setShowRegisterCenter] = useState(false);

  // Setup wizard state
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [showValidateOTP, setShowValidateOTP] = useState(false);

  // Wellness University state
  const [showWellnessEnrollment, setShowWellnessEnrollment] = useState(false);
  const [showWellnessReport, setShowWellnessReport] = useState(false);

  // Wellness Counselling state
  const [showWellnessCounselling, setShowWellnessCounselling] = useState(false);

  // 🐛 Food Correction Debug Logs State
  const [correctionLogs, setCorrectionLogs] = useState([]);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);

  // 🔄 Retry state - store last image file for retry capability
  const lastImageFileRef = useRef(null);

  // Ref for leaderboards to trigger manual refresh
  const leaderboardRef = useRef(null);
  const disciplineLeaderboardRef = useRef(null);
  const personalDisciplineRef = useRef(null);

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
      if (e.key === "Escape" && showCorrectionModal) {
        setShowCorrectionModal(false);
      }
    };

    if (showCorrectionModal) {
      window.addEventListener("keydown", handleKeyDown);
      // Prevent body scroll when modal is open (web only)
      document.body.style.overflow = "hidden";
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [showCorrectionModal]);

  // ✅ CRITICAL FIX: Force splash screen dismissal on app load

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      // Double-check splash screen is hidden after React renders
      const timer = setTimeout(() => {
        SplashScreen.hide().catch((err) => {
          console.log("Splash screen already hidden");
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
      if (showActivityTimeReport) {
        showMainPage();
        return true;
      }
      if (showDisciplineReport) {
        showMainPage();
        return true;
      }
      if (showDashboard) {
        showMainPage();
        return true;
      }
      if (showStepCounter) {
        setShowStepCounter(false);
        localStorage.setItem("currentPage", "main");
        return true;
      }
      if (showScreenTime) {
        setShowScreenTime(false);
        localStorage.setItem("currentPage", "main");
        return true;
      }
      return ionRouter.canGoBack() && ionRouter.goBack();
    };

    initializeBackButton(
      goBack,
      showToast,
      !showDashboard &&
        !showActivityTimeReport &&
        !showDisciplineReport &&
        !showStepCounter &&
        !showScreenTime,
    );
    return () => cleanupBackButton();
  }, [
    ionRouter,
    showDashboard,
    showActivityTimeReport,
    showDisciplineReport,
    showStepCounter,
    showScreenTime,
  ]);

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
  // Callback to refresh leaderboards after profile updates
  const handleLeaderboardRefresh = useCallback(() => {
    if (leaderboardRef.current) {
      leaderboardRef.current.refresh();
    }
    if (disciplineLeaderboardRef.current) {
      disciplineLeaderboardRef.current.refresh();
    }
    if (personalDisciplineRef.current) {
      personalDisciplineRef.current.refresh();
    }
  }, []);

  const showDashboardPage = useCallback(
    async (preferredTab = null) => {
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

      // Use explicitly requested tab when provided (e.g., profile menu shortcuts).
      if (
        preferredTab === "weight" ||
        preferredTab === "nutrition" ||
        preferredTab === "education"
      ) {
        setDashboardInitialTab(preferredTab);
      } else if (imageType === "weight") {
        // Set the initial tab based on the last analyzed image type
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
    },
    [user, checkUserStatus, nutritionData, imagePreview, imageType],
  );

  const showMainPage = () => {
    setShowDashboard(false);
    setShowActivityTimeReport(false);
    setShowDisciplineReport(false);
    setShowStepCounter(false);
    setShowScreenTime(false);
    setDashboardInitialTab(null); // Clear initial tab when going back

    // Clear weight result, education result, and images when going back to main page
    if (weightResult) {
      setWeightResult(null);
      setPendingWeightImage(null);
      setWeightEntrySaved(false);
      setSavedWeightId(null);
      savedWeightIdRef.current = null;
    }
    if (educationResult) setEducationResult(null);
    if (nutritionData) setNutritionData(null);
    if (imagePreview) setImagePreview(null);
    if (selectedImage) setSelectedImage(null);
    if (imageType) setImageType(null);

    // Reset file inputs to allow selecting the same image again
    if (fileInputRef.current && fileInputRef.current.resetInputs) {
      fileInputRef.current.resetInputs();
    }

    localStorage.setItem("currentPage", "main");
  };

  const requestAllPermissions = async () => {
    if (!Capacitor.isNativePlatform()) return;
    try {
      console.log("📱 Requesting all permissions at once...");

      // Request camera/gallery permissions
      await Camera.requestPermissions({ permissions: ["camera", "photos"] });

      // Request push notification permissions
      await PushNotifications.requestPermissions();

      // Request location permissions for attendance tracking
      await Geolocation.requestPermissions();

      console.log("✅ All permissions requested");
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
          } else {
            // App going to background — reset sub-pages so reopening shows dashboard
            const page = localStorage.getItem("currentPage");
            if (page === "step-counter" || page === "screen-time") {
              localStorage.setItem("currentPage", "main");
              setShowStepCounter(false);
              setShowScreenTime(false);
            }
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
            localStorage.setItem("dbUserId", String(dbUserId));
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

  // ── Profile completion check ──────────────────────────────────────────────
  // Fetches the user profile and shows the blocking CompleteProfilePage if any
  // mandatory field (height, dietType) is missing.
  const checkProfileCompletion = useCallback(
    async (userEmail) => {
      if (!userEmail) return;
      // Skip if user already completed profile in this session (prevents race conditions)
      if (profileCompletedRef.current) return;
      // Mark check in-flight so the gate doesn’t render while we’re fetching
      setProfileChecking(true);
      try {
        const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        let latestData = null;

        // Retry a few times because profile writes can be briefly stale right after save.
        for (let attempt = 0; attempt < 3; attempt++) {
          const res = await fetch(
            `${apiBaseUrl}/api/get-user-profile?email=${encodeURIComponent(
              userEmail,
            )}&_t=${Date.now()}_${attempt}`,
            { cache: "no-store", headers: { "Cache-Control": "no-cache" } },
          );
          if (!res.ok) continue;

          const data = await res.json();
          if (!data.success || !data.data) continue;
          latestData = data.data;

          if (latestData.profileComplete) {
            profileCompletedRef.current = true;
            localStorage.setItem("profileComplete_v2_" + userEmail, "true");
            setProfileChecking(false);
            setShowCompleteProfile(false);
            return;
          }

          if (attempt < 2) {
            await sleep(450);
          }
        }

        console.log(
          "⚠️ [Profile] Mandatory fields missing — showing CompleteProfilePage",
          {
            height: latestData?.height ?? null,
            dietType: latestData?.dietType ?? null,
            phoneNumber: latestData?.phoneNumber ?? null,
          },
        );
        setProfileChecking(false);
        setShowCompleteProfile(true);
      } catch (err) {
        setProfileChecking(false);
        console.warn("⚠️ [Profile] Failed to check profile completion:", err);
      }
    },
    [apiBaseUrl],
  );
  // ─────────────────────────────────────────────────────────────────────────

  // ── Profile Picture Validation ──────────────────────────────────────────
  // Checks if user has a valid profile picture (not a letter avatar)
  const checkProfilePicture = useCallback(
    async (user) => {
      if (!user) return;

      const userEmail = user.email || user.Email;
      if (!userEmail) return;

      console.log("🖼️ [Profile Picture] Checking for valid profile picture...");

      try {
        const profilePictureKey = "profilePictureUploaded_" + userEmail;

        // Fetch user profile to check for ProfileImage in database (always check DB)
        const res = await fetch(
          `${apiBaseUrl}/api/get-user-profile?email=${encodeURIComponent(
            userEmail,
          )}&_t=${Date.now()}`,
          { cache: "no-store", headers: { "Cache-Control": "no-cache" } },
        );

        if (!res.ok) {
          console.warn("⚠️ [Profile Picture] Failed to fetch profile");
          return;
        }

        const data = await res.json();
        if (!data.success || !data.data) {
          console.warn("⚠️ [Profile Picture] Invalid response");
          return;
        }

        const profile = data.data;
        console.log("🔍 [Profile Picture] Database ProfileImage value:", profile.profileImage || "NULL");
        
        // Check if user has a valid profile image (either custom uploaded or Google photo)
        if (profile.profileImage) {
          // Accept custom uploaded images (base64)
          if (profile.profileImage.startsWith("data:image/")) {
            console.log("✅ [Profile Picture] User has custom uploaded profile picture");
            localStorage.setItem(profilePictureKey, "true");
            return;
          }
          
          // Accept Google profile picture URLs
          if (profile.profileImage.startsWith("https://")) {
            console.log("✅ [Profile Picture] User has Google profile picture:", profile.profileImage.substring(0, 50) + "...");
            localStorage.setItem(profilePictureKey, "true");
            return;
          }
        }

        // No valid profile picture found - show mandatory upload modal
        console.log("⚠️ [Profile Picture] No valid profile picture found, showing mandatory upload modal");
        // Clear localStorage flag in case it was set incorrectly
        localStorage.removeItem(profilePictureKey);
        setShowMandatoryProfilePictureModal(true);
      } catch (err) {
        console.error("❌ [Profile Picture] Check failed:", err);
        // Don't block the user on errors
      }
    },
    [apiBaseUrl],
  );
  // ─────────────────────────────────────────────────────────────────────────

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
            localStorage.setItem("dbUserId", String(dbUserId));
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
                  // Check if mandatory profile fields are filled
                  await checkProfileCompletion(userEmail);
                  // After profile completion check, check for profile picture
                  setTimeout(() => checkProfilePicture(user), 800);
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
  }, [checkUserStatus, checkProfileCompletion, checkProfilePicture]);

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

  // Fetch education time window from DB so ImageUpload uses live values (no hardcoding)
  useEffect(() => {
    const fetchEducationWindow = async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/api/get-time-windows`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();

        // API returns: { success: true, windows: { education: { start, end }, weight: {...}, ... } }
        if (data.success && data.windows?.education) {
          const eduWindow = data.windows.education;
          console.log("✅ Education window fetched from DB:", eduWindow);
          setEducationWindow(eduWindow);
        } else {
          console.warn("⚠️ Education window not found in response:", data);
        }
      } catch (err) {
        console.warn("⚠️ Failed to fetch education window from DB:", err.message);
      }
    };
    fetchEducationWindow();
  }, [apiBaseUrl]);

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
                localStorage.setItem("dbUserId", String(dbUserId));
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
            // Check if mandatory profile fields are filled
            await checkProfileCompletion(userEmail);
            // After profile completion check, check for profile picture
            setTimeout(() => checkProfilePicture(user), 800);
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
  }, [user, isUserActive, apiBaseUrl, checkProfileCompletion, checkProfilePicture]);

  // ⚡ PERFORMANCE: Preload user context when user logs in (warm the cache)
  useEffect(() => {
    const preloadUserContext = async () => {
      if (!user || !user.id) return;

      try {
        console.log("⚡ [PRELOAD] Warming user context cache...");
        const context = await getUserContext(user.id);
        if (context) {
          setUserContext(context);
          console.log(
            "✅ [PRELOAD] Context cached - image analysis will be faster",
          );
        }
      } catch (error) {
        console.warn("⚠️ [PRELOAD] Failed to preload context:", error);
      }
    };

    // Preload after a short delay to avoid blocking auth flow
    const timeoutId = setTimeout(preloadUserContext, 500);
    return () => clearTimeout(timeoutId);
  }, [user?.id]); // Re-run when user ID changes

  // Convert user profile photo to base64 for CORS-safe use in html2canvas share cards
  useEffect(() => {
    const photoUrl = user?.photoURL;
    if (!photoUrl) {
      setSharePhotoBase64(null);
      return;
    }
    let cancelled = false;
    fetch(photoUrl)
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
        if (!cancelled) setSharePhotoBase64(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setSharePhotoBase64(null);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.photoURL]);

  // Fetch saved custom profile image for share card
  useEffect(() => {
    if (!user?.email || !apiBaseUrl) { setSavedProfileImage(null); return; }
    fetch(`${apiBaseUrl}/api/get-user-profile?email=${encodeURIComponent(user.email)}&_t=${Date.now()}`, {
      cache: 'no-store', headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.success && data?.data?.profileImage) setSavedProfileImage(data.data.profileImage);
        else setSavedProfileImage(null);
      })
      .catch(() => setSavedProfileImage(null));
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
    captureTimestamp = null,
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
        // Use EXIF capture timestamp if available — otherwise fall back to upload time
        clientTimestamp: captureTimestamp || new Date().toISOString(),
        clientTimezoneOffset: new Date().getTimezoneOffset(),
      };

      // ❌ REMOVED: Don't reuse weight entry IDs - always create new records
      // This allows multiple weight entries per day with different timestamps
      // if (savedWeightIdRef.current) {
      //   payload.entryId = savedWeightIdRef.current;
      //   console.log("🔄 Reusing existing weight entry ID:", savedWeightIdRef.current);
      // }

      // console.log('💾 Saving weight entry...', { weightValue: weightData.weightValue, unit: weightData.unit });

      const response = await fetch(`${apiBaseUrl}/api/save-weight-entry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        // Weight validation failed - show user-friendly alert modal
        console.log('❌ Weight validation failed:', data.validation);
        
        // Build friendly, supportive message for user
        let alertMessage = data.message || "Failed to save weight entry";
        
        if (data.validation) {
          // Generic validation message without showing weight difference
          alertMessage = `We noticed a significant change from your last weigh-in.\n\nTip: Make sure the scale is on a flat, hard surface and shows a stable reading before taking the photo.`;
        }
        
        setAlertModal({
          isOpen: true,
          title: "⚖️ Wait, is that right?",
          message: alertMessage,
          type: "warning", // Changed from "error" to "warning" for yellow icon
        });
        
        // Clear loading states
        setSaveLoading(false);
        setLoadingState("idle");
        
        // Throw error so caller knows validation failed
        throw new Error(data.message || "Weight validation failed");
      }

      console.log("✅ Weight entry saved successfully");

      // ✅ ALWAYS update weight result with final saved weight (corrected or original)
      // Use data.data.weightValue which backend ALWAYS returns as the final saved weight
      const finalSavedWeight = data.data?.weightValue || data.correction?.correctedWeight || weightData.weightValue;
      setWeightResult({
        ...weightData,
        weightValue: finalSavedWeight,
        originalWeight: data.correction?.originalWeight || weightData.weightValue,
        loggedAt: captureTimestamp || new Date().toISOString(),
      });

      // Check if weight was auto-corrected
      if (data.correction && data.correction.wasCorrected) {
        // Show custom alert modal about auto-correction with user-friendly message
        const corrInfo = data.correction;
        const difference = Math.abs(corrInfo.originalWeight - corrInfo.correctedWeight).toFixed(1);
        
        setTimeout(() => {
          setAlertModal({
            isOpen: true,
            title: "✅ Weight Adjusted",
            message: `We noticed the scale showed ${corrInfo.originalWeight} kg, but based on your recent weight of ${corrInfo.previousWeight} kg, we adjusted it to ${corrInfo.correctedWeight} kg.\n\nThis helps keep your progress accurate!`,
            type: "info",
          });
        }, 500);
        
        console.log('🔄 Weight auto-corrected:', corrInfo);
      } else if (data.correction && data.correction.message) {
        // Weight changed significantly but within limits - only show if change is notable
        const change = Math.abs(data.correction.difference || 0);
        if (change > 1.5) {
          setTimeout(() => {
            setAlertModal({
              isOpen: true,
              title: "📊 Weight Updated",
              message: `Your weight changed by ${change.toFixed(1)} kg. Keep up the great work!`,
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

      // Hide saving overlay
      setSaveLoading(false);
      setLoadingState("idle");

      // Show success popup (similar to nutrition save)
      setError(null);

      // Background refresh to pick up other users' data from server
      setTimeout(() => {
        handleLeaderboardRefresh();
      }, 3000);

      // Keep imagePreview and selectedImage visible (like food images)
      // Don't reset them here
    } catch (err) {
      console.error("❌ Save weight error:", err);
      setSaveLoading(false);
      setLoadingState("idle");
      
      // Don't show error box for validation failures (already showing modal)
      if (!err.message || !err.message.includes("validation") && !err.message.includes("verify weight")) {
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

      // Build payload — include entryId to update the specific weight entry.
      // If no entryId, backend will create a new entry instead of updating.
      const payload = {
        userId,
        weightValue: val,
        unit: weightResult?.unit || "kg",
      };
      const currentEntryId = savedWeightIdRef.current;
      if (currentEntryId) payload.entryId = currentEntryId;

      const response = await fetch(`${apiBaseUrl}/api/save-weight-entry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok || !result.success)
        throw new Error(result.message || "Failed to update");

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
          `${apiBaseUrl}/api/get-weight-history?userId=${diffUserId}&includeImage=false&_t=${Date.now()}`,
        );
        const diffData = await diffRes.json();
        if (diffData.success && diffData.stats?.previousWeight) {
          const prevWeight = parseFloat(diffData.stats.previousWeight.value);
          const weightChange = val - prevWeight;
          setWeightDiff({
            previous: Math.round(prevWeight * 10) / 10,
            previousDate: diffData.stats.previousWeight.date,
            change: Math.round(weightChange * 10) / 10,
          });
        }
      } catch (_) {
        /* non-critical */
      }
    } catch (err) {
      setWeightEditError(err.message || "Failed to save");
    } finally {
      setIsSavingWeightEdit(false);
    }
  };

  const saveWeightEntry = async (weightData, imageBase64, captureTimestamp = null) => {
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
            captureTimestamp: captureTimestamp, // Preserve EXIF timestamp through duplicate flow
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
      await performWeightSave(weightData, imageBase64, userId, captureTimestamp);
    } catch (err) {
      console.error("❌ Save weight error:", err);
      
      // Don't show error box for validation failures (already showing modal)
      if (!err.message || (!err.message.includes("validation") && !err.message.includes("verify weight"))) {
        setError(err.message || "Failed to save weight entry");
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
      console.error("❌ Manual weight save error:", err);
      throw err; // Re-throw to show error in modal
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
  ) => {
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

      // ALWAYS check GPS for club attendance regardless of platform (Zoom, Teams, or in-person)
      // If within 100m of club → club attendance
      // If not near club → remote attendance
      console.log("📍 Checking GPS for nearby clubs...");

      let attendance;
      try {
        attendance = await locationAttendanceService.determineAttendance(
          apiBaseUrl,
          userId,
        );
        console.log("✅ Attendance determined:", attendance);

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
          "⚠️ GPS check failed, defaulting to remote attendance:",
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

      // If multiple clubs detected and no club selected yet, show selection modal
      if (
        attendance.nearbyCenters &&
        attendance.nearbyCenters.length > 1 &&
        !selectedClub
      ) {
        console.log("🏢 Multiple clubs detected, showing selection modal");
        setNearbyCenters(attendance.nearbyCenters);
        // Store captureTimestamp so club-selection callback can pass it through
        setPendingEducationData({ educationData, imageBase64, attendance, captureTimestamp });
        setShowClubSelectionModal(true);
        setSaveLoading(false);
        setLoadingState("idle");
        return; // Wait for user to select club
      }

      // Determine final values
      const finalCenterId = selectedClub?.id || attendance.nutritionCenterId;
      const finalCenterName =
        selectedClub?.center_name || attendance.centerName;
      const finalPlatform =
        attendance.attendanceType === "club" ? "Club" : educationData.platform;

      // Use captureTimestamp (passed directly) → imageTimestamp state → current time
      // Using the direct parameter avoids reading stale React state
      const logTimestamp = captureTimestamp || imageTimestamp || new Date().toISOString();
      console.log(
        "📅 Education log timestamp:",
        logTimestamp,
        captureTimestamp ? "(from EXIF param)" : imageTimestamp ? "(from state)" : "(current time)",
      );

      const response = await fetch(`${apiBaseUrl}/api/save-education-log`, {
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
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to save education log");
      }

      console.log("✅ Education log auto-saved successfully:", data.id);

      // Refresh discipline scores and leaderboards after education save
      handleLeaderboardRefresh();

      console.log(
        `   📍 Attendance: ${attendance.attendanceType.toUpperCase()}`,
      );
      if (finalCenterName) {
        console.log(`   🏢 Club: ${finalCenterName}`);
      }
      if (educationData.participantCount) {
        console.log(`   👥 Participants: ${educationData.participantCount}`);
      }
      if (data.isOnTime !== undefined) {
        const status = data.isOnTime
          ? "✅ ON-TIME (Present)"
          : "⚠️ LATE (Absent)";
        console.log(`   ⏰ Timing: ${status}`);
        console.log(
          `   🕐 Upload Time: ${data.uploadTime} (Window: ${data.timeWindow?.start}-${data.timeWindow?.end})`,
        );
      }
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

  // Handle club selection from modal
  const handleClubSelection = async (selectedCenter) => {
    console.log("🏢 Club selected:", selectedCenter);
    setShowClubSelectionModal(false);

    if (pendingEducationData) {
      setSaveLoading(true);
      setLoadingState("saving");
      await saveEducationLog(
        pendingEducationData.educationData,
        pendingEducationData.imageBase64,
        selectedCenter,
        pendingEducationData.captureTimestamp || null,
      );
      setPendingEducationData(null);
    }
  };

  // Helper function to perform nutrition save
  const performNutritionSave = async (saveData) => {
    const saveStart = Date.now();
    try {
      console.log("🔵 [App] Starting nutrition save:", {
        userId: saveData.userId,
        imagePath: saveData.imagePath,
        hasImageBase64: !!saveData.imageBase64,
      });
      setSaveLoading(true);

      const saveRes = await saveNutritionAnalysis(saveData);
      console.log("✅ [App] Save successful:", saveRes);
      console.log(`⏱️ [PERF] Database save: ${Date.now() - saveStart}ms`);

      if (process.env.NODE_ENV !== "production") {
        // console.log('✅ Save successful:', saveRes);
      }

      // Store meal ID for NutritionCard auto-save updates
      setSavedNutritionMealId(saveRes.id || saveRes.insertId);
      console.log("✅ [App] Meal ID stored:", saveRes.id || saveRes.insertId);

      // Refresh discipline scores and leaderboards after meal save
      handleLeaderboardRefresh();

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
          pendingWeightSaveData.captureTimestamp || null,
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
      console.log(
        "Image processing already in progress, skipping duplicate call",
      );
      return;
    }
    imageProcessingInProgress.current = true;

    // Store EXIF timestamp for education logs
    if (exifTimestamp) {
      console.log("📸 EXIF Timestamp received:", exifTimestamp);
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
        "📸 Image file is too large. Please choose a smaller image (max 10MB).",
      );
      imageProcessingInProgress.current = false;
      return;
    }

    // 🚨 FRAUD PREVENTION: On web only — native handles this per-source in ImageUpload
    // (native camera = always live; native gallery = checked via Capacitor photo.exif)
    if (!Capacitor.isNativePlatform()) {
      console.log("🔍 Validating image freshness (web)...");
      const validation = await validateImageFreshness(file, 0);
      if (!validation.isValid) {
        console.error("❌ Image validation failed:", validation);
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
      console.log("✅ Image validated:", validation.message);
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

    // ⚡ PERFORMANCE TRACKING
    const perfStart = Date.now();
    console.log("⏱️ [PERF] 🟢 Image processing started");

    // ✅ ANDROID PERFORMANCE: Use async FileReader for non-blocking operation
    try {
      const readStart = Date.now();
      const imageBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      console.log(`⏱️ [PERF] File reading: ${Date.now() - readStart}ms`);

      // ⚡ OPTIMIZED: Aggressive compression for faster uploads & API calls
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
        console.log(
          `⏱️ [PERF] Compression: ${
            Date.now() - compressStart
          }ms (${imageSizeMB.toFixed(2)}MB → ${newSizeMB.toFixed(2)}MB)`,
        );
      } else {
        console.log(
          `⏱️ [PERF] Compression skipped (${imageSizeMB.toFixed(2)}MB)`,
        );
      }

      // Set preview and loading together to ensure overlay shows
      setImagePreview(processedImage);
      setLoading(true); // Ensure loading is true when preview shows

      // Set current user for token tracking on imageTypeDetector (unified detection)
      if (user?.id && user?.email) {
        imageTypeDetector.setCurrentUser(user.id, user.email);
      }

      // ✅ Detect image type using Gemini AI (single unified call)
      const apiStart = Date.now();
      const detectedType = await imageTypeDetector.detectImageType(file);
      console.log(`⏱️ [PERF] 🔥 Gemini API call: ${Date.now() - apiStart}ms`);
      console.log("🔍 [DEBUG] Image Type Detection Result:", {
        type: detectedType.type,
        confidence: detectedType.confidence,
        hasDetails: !!detectedType.details,
        hasFoods: detectedType.details?.foods?.length || 0,
        fullResponse: detectedType,
      });

      // 🍽️ Early detection: If food items detected, show them immediately
      if (
        detectedType.details?.foods &&
        detectedType.details.foods.length > 0
      ) {
        const foodNames = detectedType.details.foods.map((f) => f.name);
        console.log(
          "🍽️ [AI-DETECTED] Food items identified:",
          foodNames.join(", "),
        );
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
            topic: "Education Meeting",
            confidence: detectedType.confidence || 0,
            participantCount: detectedType.details.participantCount || null,
          };

          if (educationData && educationData.success) {
            console.log("✅ Education data extracted:", educationData);

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
            // Pass exifTimestamp directly as captureTimestamp to avoid stale state read
            await saveEducationLog(educationData, processedImage, null, exifTimestamp);
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

          // Don't display weight result yet - wait for successful save
          setWeightEntrySaved(false);
          setWeightDiff(null);
          setLoadingState("saving");
          setSaveLoading(true); // Show saving overlay
          
          // 🔍 FRONTEND PRE-VALIDATION: Check against previous weight for realistic changes
          try {
            const tempUserId = user?.id || (await getUserId(user));
            const prevWeightRes = await fetch(
              `${apiBaseUrl}/api/get-weight-history?userId=${tempUserId}&includeImage=false&_t=${Date.now()}`,
            );
            const prevWeightData = await prevWeightRes.json();
            
            if (prevWeightData.success && prevWeightData.stats?.previousWeight) {
              const previousWeight = parseFloat(prevWeightData.stats.previousWeight.value);
              const previousDate = prevWeightData.stats.previousWeight.date;
              
              // Validate weight change
              const validation = weightDetectionService.validateWeightChange(
                weightToSave.weightValue,
                previousWeight,
                previousDate
              );
              
              console.log('🔍 Frontend weight validation:', validation);
              
              // If validation fails or shows major warning, don't save (backend will also validate)
              if (!validation.valid) {
                setSaveLoading(false);
                setLoading(false);
                
                // Just log and continue - backend will handle validation and show CustomAlertModal
                console.log('⚠️ Frontend detected unrealistic weight change, backend will validate');
              } else if (validation.warning && validation.difference && Math.abs(validation.difference) > 1.5) {
                // Show info message for moderate changes
                console.log(`ℹ️ ${validation.message}`);
              }
            }
          } catch (validationError) {
            // Non-critical - continue with save even if validation fails
            console.warn('⚠️ Frontend validation check failed, proceeding with save:', validationError);
          }
          
          // Wrap save in try-catch to handle backend validation failures
          try {
            // Pass EXIF capture timestamp so the weight is recorded at capture time, not upload time
            await saveWeightEntry(weightToSave, processedImage, exifTimestamp || null);
            
            // ✅ Weight result is now set INSIDE performWeightSave with corrected value
            // Don't set weightResult here - performWeightSave handles it with final weight
            setWeightEntrySaved(true);
            
            // Fetch weight diff (previous vs today) for the share card
            try {
              const diffUserId = user?.id || (await getUserId(user));
              const diffRes = await fetch(
                `${apiBaseUrl}/api/get-weight-history?userId=${diffUserId}&includeImage=false&_t=${Date.now()}`,
              );
              const diffData = await diffRes.json();
              if (diffData.success && diffData.stats?.previousWeight) {
                const weightChange = parseFloat(diffData.stats.weightChange);
                setWeightDiff({
                  previous: Math.round(parseFloat(diffData.stats.previousWeight.value) * 10) / 10,
                  previousDate: diffData.stats.previousWeight.date,
                  change: Math.round(weightChange * 10) / 10,
                });
                // ✅ Immediately inject into leaderboard strip — no API wait needed
                if (weightChange < 0 && leaderboardRef.current?.injectEntry) {
                  leaderboardRef.current.injectEntry({
                    userId: diffUserId,
                    userName: user?.displayName || user?.name || user?.email?.split("@")[0] || "You",
                    email: user?.email || "",
                    weightLoss: Math.abs(weightChange),
                    profileImage: user?.photoURL || user?.ProfileImage || null,
                    coachName: "",
                  });
                }
              }
            } catch (_) {
              /* non-critical — share card just won't show diff */
            }
          } catch (saveError) {
            // Validation failed or other save error - don't show weight result
            console.log("❌ Weight save failed, weight not displayed:", saveError.message);
            // Modal is already shown by performWeightSave, just stop here
            setLoading(false);
            return;
          }
          // Don't clear imagePreview or return - let it show like food images
        } else {
          // Weight detection failed - check if it's a low confidence issue
          if (detectedWeight.lowConfidence) {
            console.log(`⚠️ Low confidence detection (${(detectedWeight.confidence * 100).toFixed(0)}%), opening manual entry`);
            setError(detectedWeight.error || 'Image quality too low for accurate reading. Please retake with better lighting.');
          } else {
            console.log("⚠️ Weight detection failed, opening manual entry modal");
          }
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
      console.log("🍽️ [DEBUG] Processing as FOOD image");
      console.log("🍽️ [DEBUG] Food details check:", {
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
          console.log("✅ Using nutrition data from unified detection");

          let foods = detectedType.details.foods;

          // 🎯 Update detected food names for display
          const foodNames = foods.map((f) => f.name);
          setDetectedFoodNames(foodNames);
          console.log("🍽️ [AI-DETECTED] Food names:", foodNames.join(", "));

          // 🔴 CRITICAL: Preserve original AI-detected names BEFORE any corrections
          // This ensures we always know what the AI originally detected, even after auto-corrections
          foods = foods.map((food) => ({
            ...food,
            originalAiName: food.name, // Store the fresh AI detection
          }));
          console.log(
            "✅ [PRESERVE] Original AI names saved:",
            foods.map((f) => `${f.name}`).join(", "),
          );

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
              const newLogs = correctedFoods.map((food) => ({
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
                console.log(
                  "🐛 [DEBUG-LOGS] Captured",
                  newLogs.length,
                  "food detection(s)",
                );
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
              calories:
                acc.calories + (food.nutrition?.calories || food.calories || 0),
              protein:
                acc.protein + (food.nutrition?.protein || food.protein || 0),
              carbs: acc.carbs + (food.nutrition?.carbs || food.carbs || 0),
              fat: acc.fat + (food.nutrition?.fat || food.fat || 0),
              fiber: acc.fiber + (food.nutrition?.fiber || food.fiber || 0),
            }),
            { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
          );

          console.log("📊 [App.js] Calculated total from corrected foods:", {
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
                calories: Math.round(
                  food.nutrition?.calories || food.calories || 0,
                ),
                protein: Math.round(
                  food.nutrition?.protein || food.protein || 0,
                ),
                carbs: Math.round(food.nutrition?.carbs || food.carbs || 0),
                fat: Math.round(food.nutrition?.fat || food.fat || 0),
                fiber: Math.round(food.nutrition?.fiber || food.fiber || 0),
              };

              console.log(
                `📊 [App.js] Mapping food "${food.name}" to detailedItem:`,
              );
              console.log(
                `   From food object - Top-level: cal=${food.calories} carbs=${food.carbs} protein=${food.protein}`,
              );
              console.log(
                `   From food object - Nested: cal=${food.nutrition?.calories} carbs=${food.nutrition?.carbs} protein=${food.nutrition?.protein}`,
              );
              console.log(
                `   To detailedItem: cal=${nutritionValues.calories} carbs=${nutritionValues.carbs} protein=${nutritionValues.protein}`,
              );

              return {
                name: food.name,
                originalAiName: food.originalAiName, // 🔴 Preserve original AI detection
                wasAutoCorrected: food.wasAutoCorrected, // 🔴 Track if auto-corrected
                correctionSource: food.correctionSource, // 🔴 Track correction source
                correctionMetadata: food.correctionMetadata, // 🔴 Full correction metadata
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
          console.error(
            "❌ [DEBUG] Full detectedType object:",
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
              detectionReason.toLowerCase().includes("poor lighting"));

          // Set appropriate error message
          if (isApiError) {
            errorMessage =
              "🤖 The AI model is temporarily unavailable. Please try again later.";
          } else if (isNetworkError) {
            errorMessage =
              "🌐 Please check your internet connection (WiFi or mobile data) and try again.";
          } else if (isNonFoodImage) {
            errorMessage =
              "⚠️ Please take a photo of food, weight scale, or educational content.";
          } else if (isQualityIssue) {
            errorMessage = "📸 Please take a clear photo with good lighting.";
          } else {
            errorMessage =
              "🍽️ Could not detect food items. Please take a clear photo of your meal.";
          }

          setError(errorMessage);
          setLoading(false);
          return;
        }

        setNutritionData({
          ...result,
          loggedAt: exifTimestamp || new Date().toISOString(),
        });

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
                userEmail: user?.email || user?.Email || "unknown",
                captureTimestamp: exifTimestamp || null,
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
              userEmail: user?.email || user?.Email || "unknown",
              captureTimestamp: exifTimestamp || null,
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
              userEmail: user?.email || user?.Email || "unknown",
              captureTimestamp: exifTimestamp || null,
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
              userEmail: user?.email || user?.Email || "unknown",
              captureTimestamp: exifTimestamp || null,
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
              userEmail: user?.email || user?.Email || "unknown",
              captureTimestamp: exifTimestamp || null, // Preserve EXIF time through duplicate flow
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
              userEmail: user?.email || user?.Email || "unknown",
              captureTimestamp: exifTimestamp || null,
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

      // Don't show error box for weight validation failures (already showing custom modal)
      if (!errorMessage.includes("validation") && !errorMessage.includes("verify weight")) {
        setError("Failed to process image: " + errorMessage);
      }
      console.error("❌ Image processing error:", err);
    } finally {
      setLoading(false);
      imageProcessingInProgress.current = false;
      console.log(
        `⏱️ [PERF] ✅ TOTAL PROCESSING TIME: ${Date.now() - perfStart}ms`,
      );
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
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
      rawMessage.includes("Failed to fetch")
    ) {
      return "🌐 Please check your internet connection (WiFi or mobile data) and try again.";
    } else if (rawMessage.includes("timeout")) {
      return "🌐 Please check your internet connection (WiFi or mobile data) and try again.";
    } else if (rawMessage.includes("connection")) {
      return "🌐 Please check your internet connection (WiFi or mobile data) and try again.";
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
    setPendingWeightImage(null);
    setWeightEntrySaved(false);
    setSavedWeightId(null);
    savedWeightIdRef.current = null;
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
              console.log("🆕 [handleSignIn] New user detected");
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
              console.log("🆕 [handlePopupSignIn] New user detected");
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
      localStorage.removeItem("dbUserId");
      // Clear profile-complete flag so a new/different user sees the gate if needed
      const emailKey = localStorage.getItem("userEmail") || "";
      if (emailKey) localStorage.removeItem("profileComplete_v2_" + emailKey);
      profileCompletedRef.current = false;
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
          userRole={userRole}
          bmrUpdateKey={bmrUpdateKey}
        />
      </Suspense>
    );
  }

  // Step Counter page
  if (showStepCounter) {
    return (
      <Suspense fallback={<LoadingSpinner message="Loading step counter..." />}>
        <StepCounter
          user={user}
          userId={user?.id}
          userRole={userRole}
          onBack={() => {
            setShowStepCounter(false);
          }}
        />
      </Suspense>
    );
  }

  // Screen Time page
  if (showScreenTime) {
    return (
      <Suspense fallback={<LoadingSpinner message="Loading screen time..." />}>
        <ScreenTimePage
          user={user}
          userRole={userRole}
          userId={user?.id}
          onBack={() => {
            setShowScreenTime(false);
          }}
        />
      </Suspense>
    );
  }

  // Reminders page
  if (showReminders) {
    return (
      <Suspense fallback={<LoadingSpinner message="Loading reminders..." />}>
        <ReminderSettingsPage
          onBack={() => setShowReminders(false)}
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

  // Activity Time Report
  if (showActivityTimeReport) {
    return (
      <Suspense
        fallback={<LoadingSpinner message="Loading activity time report..." />}
      >
        <ActivityTimeReport
          user={user}
          onBack={() => {
            setShowActivityTimeReport(false);
            localStorage.setItem("currentPage", "main");
          }}
          apiBaseUrl={apiBaseUrl}
          userRole={userRole}
        />
      </Suspense>
    );
  }

  // Wellness Counselling - Full page view
  if (showWellnessCounselling) {
    return (
      <Suspense fallback={<LoadingSpinner message="Loading wellness counselling..." />}>
        <WellnessCounselling
          user={user}
          onBack={() => setShowWellnessCounselling(false)}
        />
      </Suspense>
    );
  }

  // Main app interface
  return (
    <div className="h-screen w-screen bg-gradient-to-br from-green-50 to-green-100 flex flex-col overflow-hidden">
      <Header
        user={user}
        userRole={userRole}
        onShowBackgroundHistory={showDashboardPage}
        onShowStepCounter={showStepCounterPage}
        onShowScreenTime={showScreenTimePage}
        onShowReminders={showRemindersPage}
        onShowAdminDashboard={
          userRole === "admin" || userRole === "developer"
            ? () => setShowAdminDashboard(true)
            : null
        }
        onShowDisciplineReport={() => {
          setShowDisciplineReport(true);
          localStorage.setItem("currentPage", "discipline-report");
        }}
        onShowActivityTimeReport={() => {
          setShowActivityTimeReport(true);
          localStorage.setItem("currentPage", "activity-time-report");
        }}
        onShowWellnessEnrollment={() => setShowWellnessEnrollment(true)}
        onShowWellnessReport={
          userRole === "admin" ||
          userRole === "coach" ||
          userRole === "developer"
            ? () => setShowWellnessReport(true)
            : null
        }
        onShowWellnessCounselling={() => setShowWellnessCounselling(true)}
        onShowAttendanceReport={() => setShowAttendanceReport(true)}
        onShowClubAttendanceReport={() => setShowClubAttendanceReport(true)}
        onShowNutritionCentersMap={() => setShowNutritionCentersMap(true)}
        onShowRegisterCenter={() => setShowRegisterCenter(true)}
        onSignOut={handleSignOut}
        onLeaderboardRefresh={handleLeaderboardRefresh}
        onProfileSaved={(profileData) => {
          const email = user?.email || localStorage.getItem("userEmail") || "";
          profileCompletedRef.current = false;
          checkProfileCompletion(email);
          // If a new BMR was saved, force NutritionDashboard to re-fetch it
          if (profileData?.bmr) {
            setBmrUpdateKey((prev) => prev + 1);
          }
        }}
      />

      {/* Personal Discipline Score - Shows individual category breakdown (WEI, EDU, BRE, LUN, DIN) */}
      {user && (
        <PersonalDisciplineScore
          ref={personalDisciplineRef}
          apiBaseUrl={apiBaseUrl}
          userId={user.id}
        />
      )}

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

      <div className="flex-1 overflow-y-auto px-4 pt-16 pb-6">
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
            educationWindow={educationWindow}
          />

          {error && (
            <div className="bg-white border border-red-200 text-red-600 px-4 py-3 rounded-xl shadow-sm">
              <div className="flex items-start space-x-3">
                <div className="text-xl">⚠️</div>
                <div className="flex-1">
                  <p className="font-semibold">Error</p>
                  <p className="text-sm leading-relaxed whitespace-pre-line">
                    {error}
                  </p>
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
                    onClick={() => {
                      setError(null);
                      setImagePreview(null);
                      lastImageFileRef.current = null;
                    }}
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
                    {/* Profile photo — div+backgroundImage for reliable html2canvas rendering */}
                    {(savedProfileImage || sharePhotoBase64 || user?.photoURL) ? (
                      <div style={{
                        width: 64, height: 64,
                        borderRadius: '50%',
                        border: '3px solid rgba(255,255,255,0.95)',
                        backgroundImage: `url(${savedProfileImage || sharePhotoBase64 || user.photoURL})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        flexShrink: 0,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                      }} />
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
                        {user?.displayName ||
                          user?.name ||
                          user?.email?.split("@")[0] ||
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
                        })}
                      </p>
                    </div>
                  
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
                              ? "▲"
                              : weightDiff.change < 0
                              ? "▼"
                              : "—"}{" "}
                            {weightDiff.change === 0
                              ? "No change"
                              : `${Math.abs(weightDiff.change).toFixed(3)} ${weightResult.unit}`}
                          </p>
                          <p
                            style={{ fontSize: 13, fontWeight: 600, margin: 0 }}
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
                          setEditWeightValue(String(weightResult.weightValue));
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
                          {isSavingWeightEdit ? "Saving…" : "Save"}
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
                  {new Date(weightResult.loggedAt || Date.now()).toLocaleString(
                    undefined,
                    { dateStyle: "medium", timeStyle: "short" },
                  )}
                </div>

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
                      <p className="text-xs text-gray-500">vs Previous entry</p>
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
                        ? "▲"
                        : weightDiff.change < 0
                        ? "▼"
                        : "—"}{" "}
                      {weightDiff.change === 0
                        ? "No change"
                        : `${Math.abs(weightDiff.change)} ${weightResult.unit}`}
                      {weightDiff.change < 0 && (
                        <span className="text-sm ml-1">🎉</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Share Button at Bottom - Only show if there's an image */}
                {imagePreview && (
                  <button
                    onClick={async () => {
                      if (isWeightSharing) return;
                      setIsWeightSharing(true);
                      try {
                        // Small delay to ensure hidden container is fully rendered
                        await new Promise((resolve) =>
                          setTimeout(resolve, 100),
                        );

                        await captureAndShare(weightAnalysisShareRef.current, {
                          title: `Weight Record - ${weightResult.weightValue} ${weightResult.unit}`,
                          text: "",
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

          {showHowToUse && (
            <div className="bg-white rounded-xl shadow-lg border border-green-200 p-4 relative">
              {" "}
              <button
                onClick={() => setShowHowToUse(false)}
                className="absolute top-4 right-4 text-gray-600 text-xl hover:text-gray-800 transition-colors focus:outline-none"
                aria-label="Close"
              >
                {" "}
                ×{" "}
              </button>{" "}
              <h3 className="font-semibold text-green-700 mb-2">
                📋 How to use:
              </h3>{" "}
              <div className="space-y-3">
                {" "}
                <div>
                  {" "}
                  <h4 className="font-medium text-green-600 mb-1">
                    {" "}
                    📸 Image Analysis:{" "}
                  </h4>
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

      {/* Club Selection Modal */}
      <ClubSelectionModal
        isOpen={showClubSelectionModal}
        onClose={() => {
          setShowClubSelectionModal(false);
          setPendingEducationData(null);
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
      />

      {/* New User Profile Modal - shown for first-time users to complete their profile */}
      <UserProfileModal
        isOpen={showNewUserProfileModal}
        onClose={() => setShowNewUserProfileModal(false)}
        user={user}
        onProfileUpdate={() => {
          console.log("✅ [NewUserProfile] Profile updated successfully");
        }}
      />

      {/* ── Mandatory Profile Completion Gate ──────────────────────────────
           Renders above ALL other content (z-[300]) until every required
           field (height, gender, age, diet) is saved to the database.
           The user cannot dismiss this page until the form is complete.
      ─────────────────────────────────────────────────────────────────── */}
      {showCompleteProfile && !profileChecking && user && (
        <CompleteProfilePage
          user={user}
          apiBaseUrl={apiBaseUrl}
          onComplete={async () => {
            const email =
              user?.email ||
              user?.Email ||
              localStorage.getItem("userEmail") ||
              "";
            profileCompletedRef.current = true; // Mark as complete to prevent re-showing
            localStorage.setItem("profileComplete_v2_" + email, "true");
            setShowCompleteProfile(false); // Hide the profile completion page immediately
            setProfileChecking(false);
            
            // After profile completion, check for profile picture with delay for state update
            setTimeout(() => {
              console.log("🔄 [Profile Complete] Checking for profile picture...");
              checkProfilePicture(user);
            }, 800);
          }}
        />
      )}

      {/* ── Mandatory Profile Picture Upload Gate ────────────────────────
           Shown after profile completion if user doesn't have a valid
           profile picture. Cannot be dismissed until picture is uploaded.
      ─────────────────────────────────────────────────────────────────── */}
      {showMandatoryProfilePictureModal && user && (
        <MandatoryProfilePictureModal
          user={user}
          apiBaseUrl={apiBaseUrl}
          onComplete={async (uploadedImage) => {
            console.log("✅ [Profile Picture] Profile picture uploaded successfully");
            const userEmail = user.email || user.Email;
            if (userEmail) {
              localStorage.setItem("profilePictureUploaded_" + userEmail, "true");
            }
            
            // Immediately update user state with the uploaded image for instant UI update
            if (uploadedImage) {
              setUser((prevUser) => ({
                ...prevUser,
                profileImage: uploadedImage,
                ProfileImage: uploadedImage, // Some components use ProfileImage
                photoURL: uploadedImage, // Some components use photoURL
              }));
              console.log("✅ [Profile Picture] User state updated immediately with new profile picture");
            }
            
            // Also fetch updated user profile in background to ensure consistency
            try {
              console.log("🔄 [Profile Picture] Refreshing user profile data in background...");
              const res = await fetch(
                `${apiBaseUrl}/api/get-user-profile?email=${encodeURIComponent(userEmail)}&_t=${Date.now()}`,
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
                  console.log("✅ [Profile Picture] User state synced with server data");
                }
              }
            } catch (err) {
              console.error("❌ [Profile Picture] Failed to refresh user profile:", err);
              // Don't block user - they already have the image from immediate update
            }
            
            setShowMandatoryProfilePictureModal(false);
          }}
        />
      )}

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

      {/* Attendance Report */}
      {showAttendanceReport && (
        <Suspense
          fallback={<LoadingSpinner message="Loading attendance report..." />}
        >
          <AttendanceReport
            user={user}
            onBack={() => setShowAttendanceReport(false)}
          />
        </Suspense>
      )}

      {/* Club Attendance Report */}
      {showClubAttendanceReport && (
        <Suspense
          fallback={
            <LoadingSpinner message="Loading club attendance report..." />
          }
        >
          <ClubAttendanceReport
            user={user}
            onBack={() => setShowClubAttendanceReport(false)}
          />
        </Suspense>
      )}

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
          />
        </Suspense>
      )}

      {/* Register Nutrition Center */}
      {showRegisterCenter && (
        <Suspense
          fallback={<LoadingSpinner message="Loading registration form..." />}
        >
          <NutritionCenterRegistration
            user={user}
            onBack={() => setShowRegisterCenter(false)}
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

      {/* Wellness University Enrollment */}
      {showWellnessEnrollment && (
        <Suspense fallback={<LoadingSpinner message="Loading enrollment..." />}>
          <WellnessUniversityEnrollment
            onClose={() => setShowWellnessEnrollment(false)}
            user={user}
          />
        </Suspense>
      )}

      {/* Wellness University Report */}
      {showWellnessReport && (
        <Suspense fallback={<LoadingSpinner message="Loading report..." />}>
          <WellnessUniversityReport
            onClose={() => setShowWellnessReport(false)}
            user={user}
            userRole={userRole}
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
                        📅 {new Date(log.timestamp).toLocaleString()}
                      </span>
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
                        <span className="text-gray-400">║</span> 🤖{" "}
                        <span className="text-cyan-400">AI Detected Name:</span>
                        <span className="ml-4 text-yellow-300">
                          "{log.aiDetected}"
                        </span>
                      </div>

                      {log.aiDetected.trim().toLowerCase() ===
                      log.userCorrected.trim().toLowerCase() ? (
                        <div className="text-white mb-2">
                          <span className="text-gray-400">║</span> ✓{" "}
                          <span className="text-cyan-400">Status:</span>
                          <span className="ml-2 text-green-300">
                            No Correction - User accepted AI suggestion
                          </span>
                        </div>
                      ) : (
                        <div className="text-white mb-2">
                          <span className="text-gray-400">║</span> 👤{" "}
                          <span className="text-cyan-400">
                            User Corrected To:
                          </span>
                          <span className="ml-2 text-green-300">
                            "{log.userCorrected}"
                          </span>
                        </div>
                      )}

                      <div className="text-white mb-2">
                        <span className="text-gray-400">║</span> 📊{" "}
                        <span className="text-cyan-400">
                          Final Display Name:
                        </span>
                        <span className="ml-2 text-green-300">
                          "{log.finalDisplay}"
                        </span>
                      </div>

                      <div className="text-blue-400 font-bold">
                        ╚════════════════════════════════════════════════════════════════
                      </div>
                    </div>

                    {/* Individual Console Logs */}
                    <div className="space-y-1 text-gray-300">
                      <div>
                        <span className="text-blue-400">🤖 [AI-DETECTED]</span>
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
                            ✓ [NO-CORRECTION]
                          </span>
                          <span className="ml-2">
                            User accepted AI suggestion
                          </span>
                        </div>
                      ) : (
                        <div>
                          <span className="text-green-400">
                            👤 [USER-CORRECTED]
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
                          📊 [FINAL-DISPLAY]
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
                          `AI: ${log.aiDetected} → Corrected: ${log.userCorrected} → Final: ${log.finalDisplay}\n` +
                          `Stats: Users ${log.userCount} | ${log.portion} | ${log.calories}cal\n`,
                      )
                      .join("\n");
                    navigator.clipboard
                      ?.writeText(logText)
                      .then(() => alert("Logs copied to clipboard!"))
                      .catch(() => console.log("Copy not supported"));
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
