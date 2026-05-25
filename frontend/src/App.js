// src/App.js
// ============================================================================
// WellnessValleyApp — App.js architecture policy (post-hygiene-phase, May 2026)
// ----------------------------------------------------------------------------
// App.js is INTENTIONALLY the orchestrator. It is NOT being shrunk to a thin
// shell. The following responsibilities live here on purpose and should NOT
// be extracted without a strong reason:
//
//   1. Identity & session ownership
//      - The single `user` / `isUserActive` / `userContext` source of truth.
//      - Sign-in / sign-out flows (Firebase + OTP).
//      - The iOS Keychain re-auth gate (`forceLoggedOut`) — MUST stay read
//        synchronously at component init, before Firebase fires.
//
//   2. Native lifecycle ownership
//      - All Capacitor native concerns are now delegated to
//        `shared/services/nativeLifecycle` (May 2026 phase). App.js still
//        owns the orchestration *call sites* (effects decide WHEN to register,
//        WHEN to fire permissions, WHEN to hide splash); the service owns the
//        plugin plumbing.
//      - Multiple `appStateChange` listeners coexist (gallery effect +
//        foreground profile-check effect) — each consumer receives its own
//        PluginListenerHandle and removes only its own handle on cleanup.
//        Nothing in this codebase calls `App.removeAllListeners()`.
//      - SplashScreen dismissal timing (500 ms after first React render).
//      - StatusBar overlay configuration.
//      - Permissions request orchestration (camera/photos → push → geolocation).
//
//   3. Routing orchestration
//      - The 24 `show*` view-flag booleans + their localStorage mirroring
//        (`currentPage`). This is a deliberate homemade router. It can be
//        replaced by a real router LATER as a single focused effort —
//        do not collapse it into a reducer in the meantime (modal-over-route
//        invariants would break).
//
//   4. Cross-feature glue that legitimately spans VSA boundaries
//      - The image-capture pipeline (it dispatches to nutrition / weight /
//        education / activity — no single feature owns it).
//      - Watch-burned-calories → Nutrition write (cross-feature by design).
//
// State-machine candidates (deferred to later phases):
//   - Auth flow (idle → restoring → authenticating → checking_status →
//     checking_setup → checking_picture → ready | inactive | not_found).
//   - Image-capture pipeline (idle → captured → detecting → analyzing →
//     correcting → checking_duplicate → confirming → saving | manual_fallback).
//
// Hygiene-phase guarantees (this commit):
//   - Session keys go through `shared/services/sessionStorage.js`.
//   - Lifecycle listeners track their own handles (no `App.removeAllListeners`).
//   - High-noise debug logs go through `shared/utils/logger.debugLog`.
//   - Long-lived effect fetches use `shared/utils/fetchWithAbort` discipline.
// ============================================================================
import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  lazy,
  Suspense,
  startTransition,
  useDeferredValue,
} from "react";
import { useIonRouter } from "@ionic/react";
import { Capacitor } from "@capacitor/core";
import { Bug, Share2, Pencil, Check, X as XIcon } from "lucide-react";
import ImageUpload from "./shared/components/ImageUpload";
import { NutritionCard, FoodImageShareCard } from "./features/nutrition";
import { EducationLogCard } from "./features/education";
import { WatchActivityCard } from "./features/activity";
import { TestImageGuide } from "./features/admin";
import LoadingSpinner from "./shared/components/LoadingSpinner";
import { Login } from "./features/user";
import { InactiveUserModal } from "./features/user";
import { UserNotFoundModal } from "./features/user";
import Header from "./shared/components/Header";
import {
  getUserContext,
  clearContextCache,
} from "./shared/services/userIdentity";
import {
  initializeBackButton,
  cleanupBackButton,
} from "./shared/utils/backButtonHandler";
import { getUserId, clearUserIdCache } from "./shared/services/userIdentity";
import { getVersionString } from "./config/version";
import { getApiBaseUrl } from "./config/api.config";
import {
  saveNutritionAnalysis,
  deleteNutritionAnalysis,
} from "./features/nutrition";
import { geminiService } from "./shared/services/geminiService";
import { imageTypeDetector } from "./shared/services/imageTypeDetector";
import { weightDetectionService } from "./features/weight";
import { educationDetectionService } from "./features/education";
import { duplicateDetectionService } from "./features/nutrition";
import { applyUserCorrections } from "./features/nutrition";
import { captureAndShare, precaptureShareImage, shareCachedDataUrl, shareImageWithLink, shareViaCapacitorAPI } from "./shared/utils/shareUtils";
import { locationAttendanceService } from "./features/nutrition-centers";
import { checkExactAlarmPermission, openExactAlarmSettings } from "./shared/services/reminderService";
import { validateImageFreshness } from "./shared/utils/imageValidator";
import { ManualWeightEntryModal } from "./features/weight";
import { SmartFoodSearchModal } from "./features/nutrition";
import { ManualEducationEntryModal } from "./features/education";
import { ManualWatchEntryModal } from "./features/activity";
import { DuplicateFoodModal } from "./features/nutrition";
import { UserProfileModal } from "./features/user";
import { CompleteProfilePage } from "./features/user";
import { MandatoryProfilePictureModal } from "./features/user";
import { ClubSelectionModal } from "./features/nutrition-centers";
import CustomAlertModal from "./shared/components/CustomAlertModal";
import { CoachScoreSummary } from "./features/leaderboard";
import LEADERBOARD_CONFIG from "./config/leaderboardConfig";
import GalleryMonitor from "./shared/services/galleryMonitor";
import * as Session from "./shared/services/sessionStorage";
import * as nativeLifecycle from "./shared/services/nativeLifecycle";
import * as authFsm from "./shared/services/auth/fsm";
import { fetchProfileCompletion, fetchProfilePicture } from "./shared/services/auth/userProfile";
import { fetchUserStatus, fetchSetupStatus } from "./shared/services/auth/userSetup";
import { silentlyCompleteDemoSetup, DEMO_EMAIL } from "./shared/services/auth/demoSetup";
import { debugLog } from "./shared/utils/logger";
import { createAbortGroup, isAbortError } from "./shared/utils/fetchWithAbort";
import {
  signInWithGoogle,
  signInWithGooglePopup,
  signOutUser,
  handleRedirectResult,
  onAuthStateChange,
  isGoogleUser,
  isMobileDevice,
  cleanup,
} from "./shared/services/firebase";
import TouchFeedbackButton from "./shared/components/TouchFeedbackButton";
import LocationGuard from "./shared/components/LocationGuard";

// ✅ PERFORMANCE: Lazy-load leaderboards — they fire API calls on mount and are below the fold
const WeightLossLeaderboard = lazy(() => import("./features/weight/components/WeightLossLeaderboard"));
const DisciplineLeaderboard = lazy(() => import("./features/leaderboard/components/DisciplineLeaderboard"));
const PersonalDisciplineScore = lazy(() => import("./shared/components/PersonalDisciplineScore"));

// ✅ ANDROID OPTIMIZATION: Lazy load heavy components
const Dashboard = lazy(() => import("./shared/components/Dashboard"));
const AdminDashboard = lazy(() => import("./features/admin/components/AdminDashboard"));
const DisciplineReport = lazy(() => import("./features/leaderboard/components/DisciplineReport"));
const ActivityTimeReport = lazy(() => import("./features/activity/components/ActivityTimeReport"));
const AttendanceReport = lazy(() => import("./features/team/components/AttendanceReport"));
const NutritionCentersMap = lazy(() =>
  import("./features/nutrition-centers/components/NutritionCentersMap"),
);
const NutritionCenterRegistration = lazy(() =>
  import("./features/nutrition-centers/components/NutritionCenterRegistration"),
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
// const StepCounter = lazy(() => import("./shared/components/StepCounter")); // FEATURE DISABLED
// const ScreenTimePage = lazy(() => import("./pages/ScreenTimePage")); // FEATURE DISABLED
// const ReminderSettingsPage = lazy(() => import("./pages/ReminderSettingsPage")); // FEATURE DISABLED

function WellnessValleyApp() {
  const apiBaseUrl = getApiBaseUrl();
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [nutritionData, setNutritionData] = useState(null);
  const [savedNutritionMealId, setSavedNutritionMealId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingState, setLoadingState] = useState("analyzing"); // 'analyzing' | 'saving'
  const [detectedFoodNames, setDetectedFoodNames] = useState([]); // AI-detected food names
  const [error, setError] = useState(null);
  const [showTestGuide, setShowTestGuide] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false); // restored via useEffect to avoid suspending lazy component on mount
  const [dashboardInitialTab, setDashboardInitialTab] = useState(null); // 'nutrition' | 'weight' | null
  // Deep-link (App Link) seed values for Dashboard — set when the app is
  // opened via /share/<token> and the resolve API confirms permission.
  // Cleared in showMainPage so a normal Dashboard open won't reuse them.
  const [dashboardInitialSelectedMember, setDashboardInitialSelectedMember] = useState(null);
  const [dashboardInitialDate, setDashboardInitialDate] = useState(null);
  const [bmrUpdateKey, setBmrUpdateKey] = useState(0); // Increment to force BMR re-fetch in NutritionDashboard
  // const [showStepCounter, setShowStepCounter] = useState(false); // moved below — FEATURE DISABLED
  const [user, setUser] = useState(null);
  // ✅ iOS Sign-out gate: persisted in localStorage so it survives app restarts
  // Firebase re-auth from Keychain is blocked until user explicitly taps Sign In
  const [forceLoggedOut, setForceLoggedOut] = useState(
    Session.isUserSignedOut()
  );
  const [authLoading, setAuthLoading] = useState(true);
  const [isOtpVerified, setIsOtpVerified] = useState(
    Session.isOtpVerified(),
  );
  const [showInactiveModal, setShowInactiveModal] = useState(false);
  const [showUserNotFoundModal, setShowUserNotFoundModal] = useState(false);
  const [isUserActive, setIsUserActive] = useState(true); // Track if user is active
  const [manualModeActive, setManualModeActive] = useState(false); // always AI by default; auto-set by openBestManualModal on AI failure
  const [manualModeToast, setManualModeToast] = useState(""); // "enabled" | "disabled" | ""
  const [showManualWeightModal, setShowManualWeightModal] = useState(false);
  const [showManualFoodModal, setShowManualFoodModal] = useState(false);
  const [showManualEducationModal, setShowManualEducationModal] = useState(false);
  const [showManualWatchModal, setShowManualWatchModal] = useState(false);
  const [manualMealType, setManualMealType] = useState(""); // meal type passed to SmartFoodSearchModal
  const [lastWeight, setLastWeight] = useState(null); // { value, unit, date } from get-weight-history
  const [weightWindow, setWeightWindow] = useState(null); // { start, end } for weight time window
  const [currentWeightImage, setCurrentWeightImage] = useState(null);
  const [imageType, setImageType] = useState(null); // 'food' | 'weight' | 'education'
  const [imageTimestamp, setImageTimestamp] = useState(null); // EXIF timestamp from image
  // Education time window fetched from DB (e.g. 07:15 - 08:45) — no hardcoding
  const [educationWindow, setEducationWindow] = useState(null);
  const [weightResult, setWeightResult] = useState(null); // Store weight detection results
  const [savedWeightId, setSavedWeightId] = useState(null); // ID of the saved weight entry for editing
  // ─── savedWeightIdRef ────────────────────────────────────────────────────
  // INTENTIONAL ref-mirror of `savedWeightId` state.
  //
  // Why both exist:
  //   - `savedWeightId` (state) drives JSX (e.g. enabling the inline-edit
  //     pencil button, conditional render of the edit overlay).
  //   - `savedWeightIdRef` (ref) is read inside async handlers that are
  //     created/closed-over BEFORE the state setter resolves — specifically:
  //       • performWeightSave    → writes the new id (line ~1884)
  //       • handleWeightEditSave → reads the current id mid-flight (line ~1947)
  //                                so a user editing immediately after save
  //                                hits the right entryId without waiting
  //                                for React to re-render the handler.
  //       • saveWeightEntry      → updates id after a manual save (line ~1973)
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

  // Helper: convert any timestamp to IST "YYYY-MM-DD" date string
  // Used to guard against same-day "previous" entries caused by UTC/IST timezone mismatch
  const getISTDateStr = (ts) => {
    if (!ts) return null;
    const d = new Date(ts);
    if (isNaN(d.getTime())) return String(ts).substring(0, 10);
    const istTime = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
    return istTime.toISOString().substring(0, 10);
  };

  const [idealWeight, setIdealWeight] = useState(null); // { value: number, unit: 'kg', heightCm: number } | null
  const [educationResult, setEducationResult] = useState(null); // Store education meeting results
  const [watchResult, setWatchResult] = useState(null); // Store smartwatch activity results
  const [educationRefreshKey, setEducationRefreshKey] = useState(0); // Increment to force EducationDashboard re-fetch
  const [watchBurnedCalories, setWatchBurnedCalories] = useState(0); // Latest kcal from watch upload → pushed to NutritionDashboard
  const [sharePhotoBase64, setSharePhotoBase64] = useState(null); // CORS-safe base64 photo for share card
  const [savedProfileImage, setSavedProfileImage] = useState(null); // Custom profile image for share card.here 
  const [savedUserName, setSavedUserName] = useState(null); // Saved profile name for share card
  const fileInputRef = useRef(null);
  const weightAnalysisShareRef = useRef(null);
  const cachedWeightShareDataUrlRef = useRef(null);

  // Duplicate food detection state
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState(null);
  const [pendingSaveData, setPendingSaveData] = useState(null);

  // Instant-share state: pre-created capture row + shareable URL.
  // foodCaptureIdRef holds the DB row ID across the async save flow without
  // requiring prop-drilling through every performNutritionSave call site.
  // processedImageRef holds the compressed base64 so the share handler can
  // include the actual food photo even after state has been replaced.
  // foodShareCardRef points at the off-screen FoodImageShareCard so we can
  // paint it to a JPEG before the user taps share (zero-latency tap-to-share).
  // foodShareImageDataUrlRef caches that pre-painted JPEG.
  const foodCaptureIdRef = useRef(null);
  const processedImageRef = useRef(null);
  const foodShareCardRef = useRef(null);
  const foodShareImageDataUrlRef = useRef(null);
  const [foodShareUrl, setFoodShareUrl] = useState(null);
  // Awaited in performNutritionSave before reading foodCaptureIdRef.current so
  // that a fast Gemini response never races ahead of a slow /captures POST,
  // which would leave captureId null and cause a duplicate DB row (INSERT
  // instead of UPDATE on the pre-created pending row).
  const pendingSharePromiseRef = useRef(null);
  // ⏱️ End-to-end timing: stamped when the user picks/captures an image, used
  // by every downstream step to log "+Nms from capture start" so the full
  // pipeline (compress → POST captures → Gemini → precapture → Share sheet)
  // can be reconstructed from a single log dump.
  const captureFlowStartRef = useRef(0);
  const foodShareImageReadyAtRef = useRef(0);

  // Pre-paint the off-screen food-share card to a JPEG during idle time, so
  // when the user taps "Share Image + Link" the share sheet appears instantly
  // (no html2canvas in the click handler). Re-runs whenever the underlying
  // image changes.
  useEffect(() => {
    foodShareImageDataUrlRef.current = null;
    foodShareImageReadyAtRef.current = 0;
    if (imageType !== "food") return;
    if (!imagePreview) return;
    let cancelled = false;
    const t = setTimeout(() => {
      if (!foodShareCardRef.current) return;
      const preStart = Date.now();
      const flowStart = captureFlowStartRef.current || preStart;
      debugLog(
        `⏱️ [PERF] 🖼️  Precapture (html2canvas) started (+${preStart - flowStart}ms from capture start)`,
      );
      precaptureShareImage(foodShareCardRef.current).then((dataUrl) => {
        if (!cancelled && dataUrl) {
          foodShareImageDataUrlRef.current = dataUrl;
          foodShareImageReadyAtRef.current = Date.now();
          debugLog(
            `⏱️ [PERF] 🖼️  Precapture ready: ${Date.now() - preStart}ms (+${Date.now() - flowStart}ms from capture start)`,
          );
        } else if (!cancelled) {
          debugLog(
            `⏱️ [PERF] 🖼️  Precapture FAILED after ${Date.now() - preStart}ms`,
          );
        }
      });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [imageType, imagePreview, savedProfileImage, sharePhotoBase64, savedUserName]);

  // Tracks whether we've already auto-launched the share sheet for the current
  // food capture, so we don't re-open it after the user dismisses it.
  const foodAutoSharedRef = useRef(false);
  // Guards the manual "Share Image + Link" fallback button so that a second
  // tap while the share sheet is opening cannot spawn a duplicate sheet.
  // Ref handles synchronous re-entry; state drives the visual disabled prop.
  const isManualSharingRef = useRef(false);
  const [isManualSharing, setIsManualSharing] = useState(false);

  // Reset the home/capture surface back to its initial state. Called after the
  // share sheet completes so the user lands back on Home, ready for the next
  // capture. Does NOT cancel the in-flight Gemini analysis — that continues
  // and writes to the same public share URL the user already sent.
  const resetCaptureToHome = useCallback(() => {
    setImagePreview(null);
    setSelectedImage(null);
    setImageType(null);
    setNutritionData(null);
    setFoodShareUrl(null);
    setLoading(false);
    processedImageRef.current = null;
    foodCaptureIdRef.current = null;
    foodShareImageDataUrlRef.current = null;
    foodAutoSharedRef.current = false;
    isManualSharingRef.current = false;
    setIsManualSharing(false);
    if (fileInputRef.current && fileInputRef.current.resetInputs) {
      fileInputRef.current.resetInputs();
    }
  }, []);

  // Auto-open the native share sheet as soon as the upload is finished and
  // the share image is ready. Uses Capacitor Share API (image + caption +
  // public link in one payload). After the share sheet closes (sent OR
  // dismissed) we return to Home. The AI nutrition analysis keeps running
  // in the background and updates the same public link.
  useEffect(() => {
    if (imageType !== "food") return;
    if (!foodShareUrl) return;
    if (foodAutoSharedRef.current) return;
    foodAutoSharedRef.current = true;

    let cancelled = false;
    (async () => {
      // Wait up to 6s for the pre-captured share image to be ready.
      const start = Date.now();
      const flowStart = captureFlowStartRef.current || start;
      debugLog(
        `⏱️ [PERF] 📤 Auto-share triggered (+${start - flowStart}ms from capture start)`,
      );
      while (!foodShareImageDataUrlRef.current && Date.now() - start < 6000) {
        await new Promise((r) => setTimeout(r, 100));
      }
      if (cancelled) return;

      const waited = Date.now() - start;
      const dataUrl = foodShareImageDataUrlRef.current;
      if (!dataUrl) {
        // Pre-capture didn't produce an image — leave the manual share
        // button visible so the user can still share when they choose.
        debugLog(
          `⏱️ [PERF] 📤 Auto-share ABORTED — no precapture image after ${waited}ms wait`,
        );
        foodAutoSharedRef.current = false;
        return;
      }
      debugLog(
        `⏱️ [PERF] 📤 Auto-share wait for image: ${waited}ms`,
      );

      const captionText =
        `Check out my meal on Wellness Valley!\n${foodShareUrl}`;
      const shareStart = Date.now();
      const result = await shareViaCapacitorAPI(dataUrl, {
        title: "My Meal",
        text: captionText,
        fileName: `wellness-valley-meal-${Date.now()}.jpg`,
      });
      debugLog(
        `⏱️ [PERF] 📤 Native Share.share returned in ${Date.now() - shareStart}ms (ok=${result.ok}) (+${Date.now() - flowStart}ms from capture start)`,
      );

      if (cancelled) return;

      if (result.ok) {
        // Sent OR dismissed by user → return to Home.
        resetCaptureToHome();
      } else {
        // Hard failure (e.g. Share API not available) — let the user fall
        // back to the manual "Share Image + Link" button.
        foodAutoSharedRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [foodShareUrl, imageType, resetCaptureToHome]);

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
  // Snooze data from DB: { count, max, until } or null
  const [profilePicSnoozeData, setProfilePicSnoozeData] = useState(null);

  // Ref to prevent race conditions re-showing the gate after a successful save.
  // Initialised from localStorage (via Session helper) so it persists across
  // page refreshes. The `profileComplete_v2_<email>` key is per-user; the
  // helper handles the suffix and missing-email case for us.
  const storedEmail = Session.getUserEmail() || "";
  const profileCompletedRef = useRef(Session.isProfileComplete(storedEmail));

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

  const [showAdminDashboard, setShowAdminDashboard] = useState(false);

  // Discipline report state (for coaches) - with localStorage persistence
  const [showDisciplineReport, setShowDisciplineReport] = useState(false);
  const [showActivityTimeReport, setShowActivityTimeReport] = useState(false);

  // Step Counter state — FEATURE DISABLED
  // const showStepCounterPage = useCallback(() => { setShowStepCounter(true); }, []);
  const [showStepCounter, setShowStepCounter] = useState(false);

  // Screen Time state — FEATURE DISABLED
  const [showScreenTime, setShowScreenTime] = useState(false);
  // const showScreenTimePage = useCallback(() => { setShowScreenTime(true); }, []);

  // Reminders state — FEATURE DISABLED
  const [showReminders] = useState(false);
  // const [showReminders, setShowReminders] = useState(false);
  // const showRemindersPage = useCallback(() => { setShowReminders(true); }, []);

  // Attendance report state (for coaches)
  const [showAttendanceReport, setShowAttendanceReport] = useState(false);

  // Nutrition centers map state (for all users)
  const [showNutritionCentersMap, setShowNutritionCentersMap] = useState(false);

  // Register nutrition center state (for coaches)
  const [showRegisterCenter, setShowRegisterCenter] = useState(false);

  // Setup wizard state
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [showValidateOTP, setShowValidateOTP] = useState(false);

  // Demo account: silent coach-OTP setup is provided by
  // shared/services/auth/demoSetup.js. DEMO_EMAIL and the
  // silentlyCompleteDemoSetup function are imported at the top of this file.
  // ─────────────────────────────────────────────────────────────────────────

  // Wellness University state
  const [showWellnessEnrollment, setShowWellnessEnrollment] = useState(false);
  const [showWellnessReport, setShowWellnessReport] = useState(false);

  // Wellness Counselling state
  const [showWellnessCounselling, setShowWellnessCounselling] = useState(false);

  // ðŸ› Food Correction Debug Logs State
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

  // Ref that always reflects whether the home screen is currently visible.
  // Used by the app-resume listener to avoid stale closure over state.
  const _homeScreenActiveRef = useRef(false);
  useEffect(() => {
    _homeScreenActiveRef.current =
      !!user && !authLoading && !showDashboard &&
      !showActivityTimeReport && !showDisciplineReport && !showScreenTime;
  }, [user, authLoading, showDashboard, showActivityTimeReport, showDisciplineReport, showScreenTime]);

  // App resume (phone unlocked / app foregrounded) → open camera if on home screen.
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !user) return;
    let handle = null;
    let cancelled = false;
    nativeLifecycle.addAppStateListener(({ isActive }) => {
      if (isActive && _homeScreenActiveRef.current && !cancelled) {
        setTimeout(() => {
          if (!cancelled) fileInputRef.current?.openCamera?.();
        }, 600);
      }
    }).then((h) => {
      handle = h;
      if (cancelled) handle?.remove?.();
    }).catch(() => {});
    return () => {
      cancelled = true;
      handle?.remove?.();
    };
  }, [user]);

  // Auto-open camera once per session when the user first arrives at the home
  // screen on a native device (fresh app launch or login). Retries until the
  // ImageUpload component has mounted and exposed its openCamera method.
  const _hasFiredCameraOnLoginRef = useRef(false);
  useEffect(() => {
    if (!user || !Capacitor.isNativePlatform() || _hasFiredCameraOnLoginRef.current) return;
    let cancelled = false;
    let attempts = 0;
    const tryOpen = () => {
      if (cancelled || _hasFiredCameraOnLoginRef.current) return;
      if (fileInputRef.current?.openCamera) {
        _hasFiredCameraOnLoginRef.current = true;
        fileInputRef.current.openCamera();
        return;
      }
      if (attempts++ < 20) {
        setTimeout(tryOpen, 300);
      }
    };
    const t = setTimeout(tryOpen, 1200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [user]);

  // Deep-link handler: open the app via Android App Link
  // (https://<host>/share/<uuid>) or the custom scheme
  // (wellnessvalley://share/<uuid>) → resolve the share token against the
  // backend, then jump straight to Dashboard → Nutrition for that owner /
  // date. Permission errors and missing/expired shares surface as toasts.
  useEffect(() => {
    if (!user || !apiBaseUrl) return;

    let cancelled = false;
    let handle = null;
    const seenTokens = new Set(); // guard against duplicate fires

    const SHARE_PATH_RE = /\/share\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

    const extractToken = (rawUrl) => {
      if (!rawUrl || typeof rawUrl !== "string") return null;
      // Custom scheme: wellnessvalley://share/<uuid>
      const customMatch = rawUrl.match(/^wellnessvalley:\/\/share\/([0-9a-f-]{36})/i);
      if (customMatch) return customMatch[1];
      // https path: /share/<uuid>
      const httpsMatch = rawUrl.match(SHARE_PATH_RE);
      return httpsMatch ? httpsMatch[1] : null;
    };

    const handleUrl = async (rawUrl) => {
      const token = extractToken(rawUrl);
      if (!token || seenTokens.has(token)) return;
      seenTokens.add(token);

      try {
        const resp = await fetch(
          `${apiBaseUrl}/api/background-analysis/captures/resolve?token=${encodeURIComponent(token)}&viewerUserId=${encodeURIComponent(user.id)}`,
          { method: "GET", headers: { "Content-Type": "application/json" } },
        );
        const body = await resp.json().catch(() => ({}));
        if (cancelled) return;

        if (!resp.ok || !body?.ok) {
          const code = body?.error?.code;
          if (code === "FORBIDDEN") {
            showToast("You don't have access to this meal");
          } else if (code === "EXPIRED" || code === "NOT_FOUND") {
            showToast("This shared meal is no longer available");
          } else {
            showToast("Could not open shared meal");
          }
          return;
        }

        const data = body.data || {};
        if (data.isSelf) {
          setDashboardInitialSelectedMember(null);
        } else {
          // Shape MUST match team/services/teamSearchService.toSelectedUser
          // — hooks like resolveDashboardUserId look at `id` (not `userId`).
          const memberName = data.ownerUserName || "Member";
          setDashboardInitialSelectedMember({
            id: data.ownerUserId,
            userId: data.ownerUserId,
            name: memberName,
            userName: memberName,
            email: "",
            role: "user",
            isSelf: false,
          });
        }
        setDashboardInitialDate(data.mealDate || null);
        setDashboardInitialTab("nutrition");
        startTransition(() => setShowDashboard(true));
      } catch (err) {
        if (!cancelled) showToast("Could not open shared meal");
      }
    };

    // Register listener for foreground deep-links
    nativeLifecycle
      .addAppUrlOpenListener((event) => {
        handleUrl(event?.url);
      })
      .then((h) => {
        handle = h;
        if (cancelled) handle?.remove?.();
      })
      .catch(() => {});

    // Cold-start: the OS may have already delivered the launch URL before
    // this effect mounted. Inspect it once on first run.
    nativeLifecycle.getLaunchUrl().then((url) => {
      if (!cancelled && url) handleUrl(url);
    });

    return () => {
      cancelled = true;
      handle?.remove?.();
    };
  }, [user, apiBaseUrl]);

  // Weight analysis share state
  const [isWeightSharing, setIsWeightSharing] = useState(false);

  // Pre-capture the weight share image in the background as soon as the result
  // card is rendered. Tap -> share sheet then skips html2canvas entirely.
  useEffect(() => {
    cachedWeightShareDataUrlRef.current = null;
    if (imageType !== "weight" || !weightResult || !imagePreview) return;
    let cancelled = false;
    const t = setTimeout(() => {
      if (!weightAnalysisShareRef.current) return;
      precaptureShareImage(weightAnalysisShareRef.current).then((dataUrl) => {
        if (!cancelled) cachedWeightShareDataUrlRef.current = dataUrl;
      });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [
    imageType,
    weightResult,
    imagePreview,
    savedProfileImage,
    sharePhotoBase64,
  ]);

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

  // ðŸ› Keyboard shortcut for closing correction modal (ESC key on web)
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

  // ✅ Auth loading timeout — force dismiss loading screen after 5 seconds
  useEffect(() => {
    const authTimeout = setTimeout(() => {
      setAuthLoading(false);
    }, 5000);
    return () => clearTimeout(authTimeout);
  }, []);

  // ✅ NATIVE LIFECYCLE PHASE (May 2026): SplashScreen dismissal delegated to
  // shared/services/nativeLifecycle. Timing (500ms), error-swallowing, and
  // native-only gating are preserved exactly inside the service.
  useEffect(() => nativeLifecycle.scheduleSplashHide(500), []);

  // Restore showDashboard from localStorage using startTransition — avoids suspending lazy <Dashboard> on mount
  useEffect(() => {
    const page = Session.getCurrentPage();
    if (
      page === "dashboard" ||
      page === "nutrition-dashboard" ||
      page === "weight-tracking" ||
      page === "weight-insights"
    ) {
      startTransition(() => setShowDashboard(true));
    }
  }, []);

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
        // setShowStepCounter(false); // feature disabled
        Session.setCurrentPage("main");
        return true;
      }
      if (showScreenTime) {
        setShowScreenTime(false);
        Session.setCurrentPage("main");
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

  // Phase 3d-a: Auth FSM shadow-mode observation refs.
  // The FSM never mutates React state. It only logs transitions and drift.
  // Disabled by default — enable via `localStorage.setItem('authFsm.shadow', 'true')`
  // or REACT_APP_AUTH_FSM_SHADOW=true. Kill switch overrides everything.
  const authFsmLegacyRef = useRef({});
  const authFsmStartedRef = useRef(false);

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
        if (!userEmail) return true;

        // Phase 3b: HTTP + response mapping moved into shared/services/auth/userSetup.
        // Fail-open semantics preserved by the helper (network errors → 'active').
        const { result, role } = await fetchUserStatus({
          apiBaseUrl,
          email: userEmail,
        });

        // Phase 3d-a: Observe in shadow FSM (no behaviour change).
        authFsm.send({ type: authFsm.E.USER_STATUS_RESOLVED, result, role });

        if (result === "userNotFound") {
          setShowUserNotFoundModal(true);
          setIsUserActive(false);
          return false;
        }

        if (result === "newUser") {
          // ✅ New user — SetupWizard will handle profile collection, no popup needed
          setShowUserNotFoundModal(false);
          setIsUserActive(true);
          if (role) setUserRole(role);
          return true;
        }

        if (result === "inactive") {
          setShowInactiveModal(true);
          setIsUserActive(false);
          return false;
        }

        // result === 'active' (also covers fail-open on network error)
        setShowInactiveModal(false);
        setShowUserNotFoundModal(false);
        setIsUserActive(true);
        if (role) setUserRole(role);
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
      if (watchResult) setWatchResult(null);
      if (educationResult) setEducationResult(null);
      if (weightResult) {
        setWeightResult(null);
        setPendingWeightImage(null);
        setWeightEntrySaved(false);
        setSavedWeightId(null);
        savedWeightIdRef.current = null;
      }
      if (selectedImage) setSelectedImage(null);
      if (imageType) setImageType(null);

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
      startTransition(() => {
        setShowDashboard(true);
      });
      Session.setCurrentPage("dashboard");
    },
    [user, checkUserStatus, nutritionData, imagePreview, imageType, watchResult, educationResult, weightResult, selectedImage],
  );

  const showMainPage = () => {
    setShowDashboard(false);
    setShowActivityTimeReport(false);
    setShowDisciplineReport(false);
    // setShowStepCounter(false); // feature disabled
    setShowScreenTime(false);
    setDashboardInitialTab(null); // Clear initial tab when going back
    setDashboardInitialSelectedMember(null); // Clear deep-link member context
    setDashboardInitialDate(null); // Clear deep-link date context

    // Clear weight result, education result, and images when going back to main page
    if (weightResult) {
      setWeightResult(null);
      setPendingWeightImage(null);
      setWeightEntrySaved(false);
      setSavedWeightId(null);
      savedWeightIdRef.current = null;
    }
    if (educationResult) setEducationResult(null);
    if (watchResult) setWatchResult(null);
    if (nutritionData) setNutritionData(null);
    if (imagePreview) setImagePreview(null);
    if (selectedImage) setSelectedImage(null);
    if (imageType) setImageType(null);
    // Clear instant-share state so stale URLs don't carry over to the next capture.
    foodCaptureIdRef.current = null;
    processedImageRef.current = null;
    foodShareImageDataUrlRef.current = null;
    setFoodShareUrl(null);

    // Reset file inputs to allow selecting the same image again
    if (fileInputRef.current && fileInputRef.current.resetInputs) {
      fileInputRef.current.resetInputs();
    }

    Session.setCurrentPage("main");
  };

  // ✅ NATIVE LIFECYCLE PHASE: permission bootstrap delegated to nativeLifecycle.
  // App.js retains the call site (in the user-authenticated effect below) so
  // orchestration ownership stays here; only the plugin plumbing moved out.
  // Behavior, order (camera/photos → push → geolocation), and logging preserved
  // exactly inside the service.
  const requestAllPermissions = nativeLifecycle.requestAllPermissions;

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

  // ✅ NATIVE LIFECYCLE PHASE: StatusBar overlay configuration delegated to
  // nativeLifecycle. Lazy import + native-only gate + warn-on-missing-plugin
  // semantics are preserved exactly inside the service.
  useEffect(() => {
    nativeLifecycle.initStatusBar();
  }, []);

  // ✅ HYGIENE FIX (May 2026): track our own listener handles. Previously this
  // effect's cleanup called `App.removeAllListeners()` which also wiped the
  // foreground-profile-check listener (registered further down at the
  // "Immediate profile check when app comes back to foreground" effect),
  // because Capacitor's removeAllListeners is plugin-wide. With the
  // showDashboardPage-dep effect re-running on callback identity changes,
  // the foreground profile check could disappear silently.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;

    let appStateHandle = null;          // PluginListenerHandle for our appStateChange listener
    let notificationHandle = null;      // PluginListenerHandle for galleryMonitorPlugin notificationClicked
    let cancelled = false;

    const init = async () => {
      try {
        await GalleryMonitor.initialize();
        if (cancelled) return;

        // ✅ NATIVE LIFECYCLE PHASE: registration plumbing routed through
        // nativeLifecycle.addAppStateListener. Returns the same
        // PluginListenerHandle shape as before; cleanup semantics unchanged
        // (this effect still removes only its own handle, never
        // App.removeAllListeners()).
        appStateHandle = await nativeLifecycle.addAppStateListener(({ isActive }) => {
          if (isActive) {
            GalleryMonitor.checkGallery();
            // Re-start step tracking in case Android killed the service while in background
            import("./shared/plugins/stepCounterPlugin")
              .then(({ StepCounterPlugin }) => {
                StepCounterPlugin.isAvailable().then((av) => {
                  if (av?.available) {
                    StepCounterPlugin.getPermissionStatus()
                      .then((perm) => {
                        if (perm?.granted) StepCounterPlugin.startTracking().catch(() => {});
                      })
                      .catch(() => {});
                  }
                }).catch(() => {});
              })
              .catch(() => {});
          } else {
            // Background → reset transient sub-pages so reopening shows dashboard
            const page = Session.getCurrentPage();
            if (page === "step-counter" || page === "screen-time") {
              Session.setCurrentPage("main");
              setShowScreenTime(false);
            }
          }
        });
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
        console.warn("[App] gallery monitoring init failed:", err?.message || err);
      }
    };

    init();

    return () => {
      cancelled = true;
      // Only remove the listeners we registered — do NOT call
      // App.removeAllListeners(), which would also kill the foreground
      // profile-check listener registered in the effect below.
      try { appStateHandle?.remove?.(); } catch { /* ignore */ }
      try { notificationHandle?.remove?.(); } catch { /* ignore */ }
    };
  }, [showDashboardPage]);

  // ── Silent step tracking start — FEATURE DISABLED ────────────────────────
  // useEffect(() => {
  //   if (!user || !isUserActive || !Capacitor.isNativePlatform()) return;
  //   const startStepTrackingIfPermitted = async () => {
  //     try {
  //       const { StepCounterPlugin } = await import('./shared/plugins/stepCounterPlugin');
  //       const availability = await StepCounterPlugin.isAvailable();
  //       if (!availability?.available) return;
  //       const permission = await StepCounterPlugin.getPermissionStatus();
  //       if (!permission?.granted) return;
  //       await StepCounterPlugin.startTracking();
  //     } catch (err) {
  //       console.warn('[App] Silent step tracking start failed:', err?.message || err);
  //     }
  //   };
  //   startStepTrackingIfPermitted();
  // }, [user, isUserActive]);

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
              "✅ [Redirect] Attached database UserId to user object:",
              resultUser.id,
            );
          }
          setUser(resultUser);
          setAuthLoading(false);
        }
      } catch (error) {
        console.error("âŒ Redirect result error:", error);
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
    async (userEmail, userObj, { afterSave = false } = {}) => {
      if (!userEmail) return;
      setProfileChecking(true);

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
        setProfileChecking(false);
        setShowCompleteProfile(false);
        // Profile fields complete — check picture gate separately
        if (userObj) setTimeout(() => checkProfilePicture(userObj), 400);
        return;
      }

      if (result.status === "incomplete") {
        debugLog(
          "⚠️ [Profile] Mandatory fields missing — showing CompleteProfilePage",
          result.missingFields,
        );
        setProfilePicSnoozeData(result.snooze || null);
        setProfileChecking(false);
        setShowCompleteProfile(true);
        return;
      }

      // result.status === 'error' — fail-soft, no gate flash
      setProfileChecking(false);
      console.warn("⚠️ [Profile] Failed to check profile completion:", result.error);
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

      debugLog("🖼️ [Profile Picture] Checking for valid profile picture...");

      const result = await fetchProfilePicture({ apiBaseUrl, email: userEmail });

      // Phase 3d-a: Observe in shadow FSM (no behaviour change).
      authFsm.send({
        type: authFsm.E.PROFILE_PICTURE_CHECK_COMPLETED,
        status: result.status,
        source: result.source,
        snooze: result.snooze,
      });

      if (result.status === "valid") {
        if (result.source === "custom") {
          debugLog("✅ [Profile Picture] User has custom uploaded profile picture");
        } else {
          debugLog(
            "✅ [Profile Picture] User has Google profile picture:",
            (result.profileImage || "").substring(0, 50) + "...",
          );
        }
        return;
      }

      if (result.status === "snoozed") {
        const snoozeUntil = new Date(result.snooze.until).getTime();
        debugLog(
          "⏰ [Profile Picture] Snoozed (DB) until",
          new Date(snoozeUntil).toLocaleString(),
        );
        return;
      }

      if (result.status === "missing") {
        // Store snooze data in state so modal can use count/max
        setProfilePicSnoozeData(result.snooze || null);
        debugLog(
          "⚠️ [Profile Picture] No valid profile picture found, showing mandatory upload modal",
        );
        setShowMandatoryProfilePictureModal(true);
        return;
      }

      // result.status === "error" — don't block the user
      if (result.error) {
        console.error("❌ [Profile Picture] Check failed:", result.error);
      } else {
        console.warn("⚠️ [Profile Picture] Failed to fetch profile");
      }
    },
    [apiBaseUrl],
  );
  // ─────────────────────────────────────────────────────────────────────────

  // Phase 3d-a: Keep the legacy snapshot ref fresh so the FSM shadow bridge
  // can compare against current React state on every event. This effect runs
  // on every render — intentional. The body is a single ref assignment, so
  // the cost is negligible. The FSM consumes this via `getLegacySnapshot`.
  useEffect(() => {
    authFsmLegacyRef.current = {
      user: !!user,
      isUserActive,
      showInactiveModal,
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
        (typeof Capacitor !== "undefined" && Capacitor.getPlatform && Capacitor.getPlatform()) ||
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
    // Intentionally empty deps — this must run exactly once on mount.
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
      // ✅ Also ignore if userEmail was cleared (sign-out completed)
      const storedEmail = Session.getUserEmail();
      if (!user && !storedEmail) {
        // Normal sign-out state — do nothing, UI already reset
        return;
      }
      // ✅ Block iOS silent re-auth: if user explicitly signed out, ignore Firebase re-auth callbacks
      if (user && Session.isUserSignedOut()) {
        console.warn("🚫 [Auth State] Blocked silent re-auth — user signed out");
        signOutUser().catch(() => {});
        return;
      }
      // ✅ Block re-auth if account was permanently deleted
      if (user && Session.isAccountDeleted()) {
        console.warn("🚫 [Auth State] Blocked re-auth — account was deleted");
        signOutUser().catch(() => {});
        return;
      }
      // ✅ Hard gate: if forceLoggedOut is true, never re-login from Firebase
      if (forceLoggedOut) {
        console.warn("🚫 [Auth State] Blocked re-auth — forceLoggedOut is true");
        signOutUser().catch(() => {});
        return;
      }

      if (user) {
        // Get database UserId if not already attached
        if (!user.id) {
          const dbUserId = await getUserId(user);
          if (dbUserId) {
            user.id = dbUserId;
            Session.setDbUserId(dbUserId);
            debugLog(
              "✅ [Auth State] Attached database UserId to user object:",
              user.id,
            );
          }
        }

        // Store user email in localStorage for API calls
        const userEmail = user.email || user.Email;
        if (userEmail) {
          Session.setUserEmail(userEmail);
          debugLog(
            "✅ [Auth State] Stored user email in localStorage:",
            userEmail,
          );
        }

        // Load user context for AI personalization
        if (user.id) {
          debugLog("🔄 [Auth State] Loading user context...");
          setUserContextLoading(true);
          try {
            const context = await getUserContext(user.id);
            setUserContext(context);
            debugLog("✅ [Auth State] User context stored in state");
          } catch (error) {
            console.error("âŒ [Auth State] Failed to load context:", error);
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
            debugLog("🔄 [Auth State] Checking setup wizard status...");

            // Check if user manually skipped setup (check localStorage first for quick bypass)
            if (Session.isSetupSkipped()) {
              debugLog(
                "â­ï¸ [Auth State] User skipped setup (localStorage), bypassing wizard",
              );
              // Still check profile completion even if setup was skipped
              await checkProfileCompletion(userEmail, user);
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
                  "⚠️ [Auth State] Setup status check failed",
                  status.error,
                );
              } else if (status.result === "skipped") {
                debugLog(
                  "⏭️ [Auth State] User skipped setup (database), bypassing wizard",
                );
                Session.markSetupSkipped();
                await checkProfileCompletion(userEmail, user);
                return;
              } else if (status.result === "pendingOtp") {
                if (Session.isCoachOtpVerified()) {
                  debugLog("✅ [Auth State] Coach OTP already verified (localStorage), skipping modal");
                  await checkProfileCompletion(userEmail, user);
                } else if ((userEmail || "").toLowerCase().trim() === DEMO_EMAIL) {
                  debugLog("🤖 [Auth State] Demo account pending OTP — completing silently");
                  await silentlyCompleteDemoSetup(userEmail);
                  await checkProfileCompletion(userEmail, user);
                } else {
                  debugLog("📧 [Auth State] Pending OTP detected, showing OTP modal");
                  setShowValidateOTP(true);
                }
              } else if (status.result === "incomplete") {
                if ((userEmail || "").toLowerCase().trim() === DEMO_EMAIL) {
                  debugLog("🤖 [Auth State] Demo account setup incomplete — completing silently");
                  await silentlyCompleteDemoSetup(userEmail);
                  await checkProfileCompletion(userEmail, user);
                } else {
                  debugLog("🔧 [Auth State] Setup incomplete, showing setup wizard");
                  setShowSetupWizard(true);
                }
              } else {
                // status.result === "complete"
                debugLog("✅ [Auth State] Setup already complete");
                await checkProfileCompletion(userEmail, user);
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
          debugLog(
            "ðŸ” [Auth State] Fresh sign-in detected, skipping status check",
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
          "ðŸ” [Auth State] Skipping handleSaveUserCache for fresh sign-in",
        );
      }
    });
    return () => unsubscribe();
  }, [checkUserStatus, checkProfileCompletion, checkProfilePicture, apiBaseUrl, forceLoggedOut]);

  // Subscribe to user context updates (from profile edits, food corrections, etc.)
  useEffect(() => {
    if (!user?.id) return;

    const {
      subscribeToContextUpdates,
    } = require("./shared/services/userIdentity");
    const unsubscribe = subscribeToContextUpdates((updatedContext) => {
      debugLog("✅ [App] User context updated in state:", {
        corrections: updatedContext?.personalCorrections?.length || 0,
        diet: updatedContext?.dietPreference,
      });
      setUserContext(updatedContext);
    });

    return unsubscribe;
  }, [user?.id, forceLoggedOut]);

  // Setup for authenticated users.
  useEffect(() => {
    if (user) {
      requestAllPermissions();
      handleSaveUserCache(user);
    }
  }, [user, requestAllPermissions, handleSaveUserCache]);

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
          debugLog("✅ Education window fetched from DB:", eduWindow);
          setEducationWindow(eduWindow);
        } else {
          console.warn("âš ï¸ Education window not found in response:", data);
        }
        if (data.success && data.windows?.weight) {
          setWeightWindow(data.windows.weight);
        }
      } catch (err) {
        console.warn("âš ï¸ Failed to fetch education window from DB:", err.message);
      }
    };
    fetchEducationWindow();
  }, [apiBaseUrl]);

  // Handle OTP user restoration
  useEffect(() => {
    const restoreOtpUser = async () => {
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
                  "✅ [OTP Restore] Attached database UserId to user object:",
                  parsedUser.id,
                );
              }
            }

            // Store user email in localStorage for API calls
            const userEmail = parsedUser.email || parsedUser.Email;
            if (userEmail) {
              Session.setUserEmail(userEmail);
              debugLog(
                "✅ [OTP Restore] Stored user email in localStorage:",
                userEmail,
              );
            }

            // Load user context for AI personalization
            if (parsedUser.id) {
              debugLog("🔄 [OTP Restore] Loading user context...");
              setUserContextLoading(true);
              try {
                const context = await getUserContext(parsedUser.id);
                setUserContext(context);
                debugLog("✅ [OTP Restore] User context stored in state");
              } catch (error) {
                console.error(
                  "âŒ [OTP Restore] Failed to load context:",
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
            // ✅ Check profile completion after OTP user is restored on refresh
            if (userEmail) {
              await checkProfileCompletion(userEmail, parsedUser);
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
  }, [isOtpVerified, user, checkUserStatus, checkProfileCompletion]);

  // ✅ Immediate profile check when app comes back to foreground.
  // NOTE: this is a SEPARATE appStateChange listener from the gallery
  // monitoring effect above. Capacitor allows multiple listeners on the
  // same event — the gallery effect now removes only its own handle
  // (not removeAllListeners), so this one survives gallery effect re-runs.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;
    if (!user) return undefined;

    let handle = null;
    let cancelled = false;

    // ✅ NATIVE LIFECYCLE PHASE: registration plumbing routed through
    // nativeLifecycle.addAppStateListener. Each consumer still receives its
    // own PluginListenerHandle so this effect can clean up independently of
    // the gallery effect's listener (which lives above).
    Promise.resolve(
      nativeLifecycle.addAppStateListener(({ isActive }) => {
        if (isActive && user) {
          const userEmail = user.email || user.Email;
          if (userEmail) {
            debugLog("🔄 [Foreground] App resumed — running immediate profile check");
            checkProfileCompletion(userEmail, user);
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
      try { handle?.remove?.(); } catch { /* ignore */ }
    };
  }, [user, checkProfileCompletion]);

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

      debugLog(
        "🔄 [Setup Check] Checking setup wizard status for existing user...",
      );

      // Check if user manually skipped setup (check localStorage first for quick bypass)
      if (Session.isSetupSkipped()) {
        debugLog(
          "â­ï¸ [Setup Check] User skipped setup (localStorage), bypassing wizard",
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
          console.warn("⚠️ [Setup Check] Setup status check failed", status.error);
        } else if (status.result === "skipped") {
          debugLog("⏭️ [Setup Check] User skipped setup (database), bypassing wizard");
          Session.markSetupSkipped();
          return;
        } else if (status.result === "pendingOtp") {
          if (Session.isCoachOtpVerified()) {
            debugLog("✅ [Setup Check] Coach OTP already verified (localStorage), skipping modal");
            await checkProfileCompletion(userEmail);
            setTimeout(() => checkProfilePicture(user), 800);
          } else if ((userEmail || "").toLowerCase().trim() === DEMO_EMAIL) {
            debugLog("🤖 [Setup Check] Demo account pending OTP — completing silently");
            await silentlyCompleteDemoSetup(userEmail);
            await checkProfileCompletion(userEmail);
            setTimeout(() => checkProfilePicture(user), 800);
          } else {
            debugLog("📧 [Setup Check] Pending OTP detected, showing OTP modal");
            setShowValidateOTP(true);
          }
        } else if (status.result === "incomplete") {
          if ((userEmail || "").toLowerCase().trim() === DEMO_EMAIL) {
            debugLog("🤖 [Setup Check] Demo account setup incomplete — completing silently");
            await silentlyCompleteDemoSetup(userEmail);
            await checkProfileCompletion(userEmail);
            setTimeout(() => checkProfilePicture(user), 800);
          } else {
            debugLog("🔧 [Setup Check] Setup incomplete, showing setup wizard");
            setShowSetupWizard(true);
          }
        } else {
          // status.result === "complete"
          debugLog("✅ [Setup Check] Setup already complete");
          await checkProfileCompletion(userEmail);
          setTimeout(() => checkProfilePicture(user), 800);
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
        debugLog("⚡ [PRELOAD] Warming user context cache...");
        const context = await getUserContext(user.id);
        if (context) {
          setUserContext(context);
          debugLog(
            "✅ [PRELOAD] Context cached - image analysis will be faster",
          );
        }
      } catch (error) {
        console.warn("âš ï¸ [PRELOAD] Failed to preload context:", error);
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
    // Use standard caching — no need to bust cache on every render
    fetch(
      `${apiBaseUrl}/api/user/profile?email=${encodeURIComponent(user.email)}`,
      { signal },
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (signal.aborted) return;
        if (data?.success && data?.data?.profileImage) setSavedProfileImage(data.data.profileImage);
        else setSavedProfileImage(null);
        if (data?.success && data?.data?.userName) setSavedUserName(data.data.userName);
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
   * Fetch the user's height (from profile) and compute their ideal weight range
   * using BMI 19 (lower) and BMI 23 (upper) of the WHO normal range (18.5–24.9).
   * Formula: idealWeight (kg) = BMI × (heightInMeters)²
   * Updates `idealWeight` state so the share card / visible card can show it.
   */
  const refreshIdealWeight = async () => {
    try {
      if (!user?.email) return;
      const profileRes = await fetch(
        `${apiBaseUrl}/api/user/profile?email=${encodeURIComponent(user.email)}&_t=${Date.now()}`,
        { cache: "no-store" }
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
      /* non-critical — share card just won't show ideal weight */
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

      // âŒ REMOVED: Don't reuse weight entry IDs - always create new records
      // This allows multiple weight entries per day with different timestamps
      // if (savedWeightIdRef.current) {
      //   payload.entryId = savedWeightIdRef.current;
      //   debugLog("🔄 Reusing existing weight entry ID:", savedWeightIdRef.current);
      // }

      // debugLog('💾 Saving weight entry...', { weightValue: weightData.weightValue, unit: weightData.unit });

      const response = await fetch(`${apiBaseUrl}/api/weight/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        // Weight validation failed - show user-friendly alert modal
        debugLog('âŒ Weight validation failed:', data.validation);

        // 🔥 Even though weight was rejected, BMR may have been saved by the backend.
        // Trigger NutritionDashboard re-fetch so the new BMR is reflected immediately.
        if (data.bmrSaved && weightData.bmr) {
          debugLog('🔥 [BMR] Weight rejected but BMR was saved — triggering re-fetch:', weightData.bmr);
          setBmrUpdateKey((prev) => prev + 1);
        }
        
        // Build friendly, supportive message for user
        let alertMessage = `We noticed a significant change from your last weigh-in.`;
        
        if (data.validation && data.message) {
          // Capitalise first letter of the backend message for display
          const detail = data.message.charAt(0).toUpperCase() + data.message.slice(1);
          alertMessage = detail;
        }
        
        setAlertModal({
          isOpen: true,
          title: "âš–ï¸ Unrealistic Weight Change",
          message: alertMessage,
          type: "warning",
        });
        
        // Clear loading states
        setSaveLoading(false);
        setLoadingState("idle");
        
        // Throw error so caller knows validation failed
        throw new Error(data.message || "Weight validation failed");
      }

      debugLog("✅ Weight entry saved successfully");

      // ✅ ALWAYS update weight result with final saved weight (corrected or original)
      // Use data.data.weightValue which backend ALWAYS returns as the final saved weight
      const finalSavedWeight = data.data?.weightValue || data.correction?.correctedWeight || weightData.weightValue;
      setWeightResult({
        ...weightData,
        weightValue: finalSavedWeight,
        originalWeight: data.correction?.originalWeight || weightData.weightValue,
        loggedAt: captureTimestamp || new Date().toISOString(),
      });

      // Fetch previous weight to show "vs Previous entry" diff immediately
      try {
        const histRes = await fetch(
          `${apiBaseUrl}/api/weight/history?userId=${userId}&includeImage=false&_t=${Date.now()}`
        );
        const histData = await histRes.json();
        if (histData.success && histData.stats?.previousWeight) {
          const prevWeight = parseFloat(histData.stats.previousWeight.value);
          const weightChange = parseFloat(finalSavedWeight) - prevWeight;
          const latestDate = histData.stats.latestWeight?.date;
          const prevDate = histData.stats.previousWeight.date;
          // Safety guard: only show diff if previous entry is from a different IST calendar date
          if (latestDate && prevDate && getISTDateStr(latestDate) !== getISTDateStr(prevDate)) {
            setWeightDiff({
              previous: Math.round(prevWeight * 100) / 100,
              previousDate: prevDate,
              change: Math.round(weightChange * 100) / 100,
            });
          } else {
            setWeightDiff(null);
          }
        } else {
          setWeightDiff(null);
        }
      } catch (_) { /* non-critical */ }

      // Fetch user height → compute ideal weight for the share card
      refreshIdealWeight();

      // Check if weight was auto-corrected
      if (data.correction && data.correction.wasCorrected) {
        // Show custom alert modal about auto-correction with user-friendly message
        const corrInfo = data.correction;
        
        setTimeout(() => {
          setAlertModal({
            isOpen: true,
            title: "✅ Weight Adjusted",
            message: `We noticed the scale showed ${corrInfo.originalWeight} kg, but based on your recent weight of ${corrInfo.previousWeight} kg, we adjusted it to ${corrInfo.correctedWeight} kg.\n\nThis helps keep your progress accurate!`,
            type: "info",
          });
        }, 500);
        
        debugLog('🔄 Weight auto-corrected:', corrInfo);
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

      // 🔥 If BMR was saved with this weight entry, force NutritionDashboard to re-fetch
      // BMR is synced to team_table by the backend — increment the key so it re-reads it
      if (weightData.bmr) {
        setBmrUpdateKey((prev) => prev + 1);
        debugLog("🔥 [BMR] BMR saved with weight entry, forcing NutritionDashboard re-fetch:", weightData.bmr);
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
      console.error("âŒ Save weight error:", err);
      setSaveLoading(false);
      setLoadingState("idle");
      
      // Weight validation errors are already shown via alertModal — don't show the red error card
      if (!err.message?.toLowerCase().includes("weight validation") && !err.message?.toLowerCase().includes("unrealistic weight")) {
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
            title: "âš–ï¸ Unrealistic Weight Change",
            message: result.message ? result.message.charAt(0).toUpperCase() + result.message.slice(1) : `We noticed a significant change from your last weigh-in.`,
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
          const latestDate = diffData.stats.latestWeight?.date;
          const prevDate = diffData.stats.previousWeight.date;
          // Safety guard: only show diff if previous entry is from a different IST calendar date
          if (latestDate && prevDate && getISTDateStr(latestDate) !== getISTDateStr(prevDate)) {
            setWeightDiff({
              previous: Math.round(prevWeight * 100) / 100,
              previousDate: prevDate,
              change: Math.round(weightChange * 100) / 100,
            });
          } else {
            setWeightDiff(null);
          }
        }
      } catch (_) {
        /* non-critical */
      }
      // Refresh ideal weight in case the user updated their height in profile
      refreshIdealWeight();
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
          // debugLog('âš ï¸ Duplicate weight detected:', duplicateCheck);
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
          "âš ï¸ Duplicate check failed, proceeding with save:",
          duplicateCheckErr,
        );
      }

      // No duplicate or duplicate check failed - proceed with save (pass cached userId)
      await performWeightSave(weightData, imageBase64, userId, captureTimestamp);
    } catch (err) {
      console.error("âŒ Save weight error:", err);
      // Weight validation errors are already shown via alertModal — don't show the red error card
      if (!err.message?.toLowerCase().includes("weight validation") && !err.message?.toLowerCase().includes("unrealistic weight")) {
        const rawMsg = err.message || "";
        const isNetworkErr = rawMsg.toLowerCase().includes("load failed") || rawMsg.includes("Failed to fetch") || rawMsg.includes("network") || rawMsg.includes("connection");
        setError(isNetworkErr ? "🌐 Please check your internet connection (WiFi or mobile data) and try again." : (rawMsg || "Failed to save weight entry"));
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
      console.error("âŒ Manual weight save error:", err);
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
        icon: "ðŸ½",
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
        icon: "âš–ï¸",
        sub: weightWindow ? `${weightWindow.start?.slice(0,5)}–${weightWindow.end?.slice(0,5)}` : null,
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
        icon: "🎓",
        sub: educationWindow ? `${educationWindow.start?.slice(0,5)}–${educationWindow.end?.slice(0,5)}` : null,
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
    setError(null); // clear AI Unavailable card — modal handles the UI
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
      // Default → food
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
        `${apiBaseUrl}/api/weight/history?userId=${uid}&includeImage=false&_t=${Date.now()}`
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

      // Build detailedItems — either a full plate (multiple) or a single food
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
        totalNutrition = manualData.total || detailedItems.reduce(
          (acc, f) => ({
            calories: acc.calories + f.calories,
            protein: acc.protein + f.protein,
            carbs: acc.carbs + f.carbs,
            fat: acc.fat + f.fat,
            fiber: acc.fiber + f.fiber,
          }),
          { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
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
      console.error("âŒ Manual food save error:", err);
      throw err;
    } finally {
      setSaveLoading(false);
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
      debugLog("💾 Auto-saving education log:", educationData);

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
      debugLog("ðŸ“ Checking GPS for nearby clubs...");

      let attendance;
      try {
        attendance = await locationAttendanceService.determineAttendance(
          apiBaseUrl,
          userId,
        );
        debugLog("✅ Attendance determined:", attendance);

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
          "âš ï¸ GPS check failed, defaulting to remote attendance:",
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
        debugLog("ðŸ¢ Multiple clubs detected, showing selection modal");
        setNearbyCenters(attendance.nearbyCenters);
        // Store captureTimestamp so club-selection callback can pass it through
        setPendingEducationData({ educationData, imageBase64, attendance, captureTimestamp });
        setShowClubSelectionModal(true);
        setSaveLoading(false);
        setLoadingState("idle");
        return; // Wait for user to select club
      }

      // Get address from GPS coordinates using reverse geocoding
      let userCity = null;
      let userVillage = null;
      
      if (attendance.latitude && attendance.longitude) {
        try {
          debugLog("ðŸ“ Fetching address from GPS:", {
            lat: attendance.latitude,
            lon: attendance.longitude
          });
          
          const geoResponse = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${attendance.latitude}&lon=${attendance.longitude}&addressdetails=1&accept-language=en`,
            {
              headers: {
                'User-Agent': 'WellnessBuddy/1.0',
                'Accept-Language': 'en'
              }
            }
          );
          
          if (geoResponse.ok) {
            const geoData = await geoResponse.json();
            if (geoData && geoData.address) {
              const addr = geoData.address;
              
              // Extract city (main city/town)
              userCity = addr.city || addr.town || addr.village || addr.county || null;
              
              // Extract village (neighbourhood, suburb, hamlet - smaller areas)
              const villageParts = [];
              if (addr.neighbourhood) villageParts.push(addr.neighbourhood);
              if (addr.suburb && addr.suburb !== addr.neighbourhood) villageParts.push(addr.suburb);
              if (addr.hamlet) villageParts.push(addr.hamlet);
              
              userVillage = villageParts.length > 0 ? villageParts.join(", ") : null;
              
              debugLog("✅ Address extracted:", {
                city: userCity,
                village: userVillage,
                fullAddress: geoData.display_name
              });
            }
          }
        } catch (err) {
          console.warn("âš ï¸ Failed to fetch address from GPS:", err);
        }
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
      debugLog(
        "📅 Education log timestamp:",
        logTimestamp,
        captureTimestamp ? "(from EXIF param)" : imageTimestamp ? "(from state)" : "(current time)",
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
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to save education log");
      }

      debugLog("✅ Education log auto-saved successfully:", data.id);

      // Refresh discipline scores and leaderboards after education save
      handleLeaderboardRefresh();

      debugLog(
        `   ðŸ“ Attendance: ${attendance.attendanceType.toUpperCase()}`,
      );
      if (finalCenterName) {
        debugLog(`   ðŸ¢ Club: ${finalCenterName}`);
      }
      if (educationData.participantCount) {
        debugLog(`   👥 Participants: ${educationData.participantCount}`);
      }
      if (data.isOnTime !== undefined) {
        const status = data.isOnTime
          ? "✅ ON-TIME (Present)"
          : "âš ï¸ LATE (Absent)";
        debugLog(`   â° Timing: ${status}`);
        debugLog(
          `   ðŸ• Upload Time: ${data.uploadTime} (Window: ${data.timeWindow?.start}-${data.timeWindow?.end})`,
        );
      }
      setSaveLoading(false);
      setLoadingState("idle");
    } catch (error) {
      console.error("âŒ Failed to auto-save education log:", error);
      setError(
        error.message || "Failed to save education log. Please try again.",
      );
      setSaveLoading(false);
      setLoadingState("idle");
    }
  };

  // Handle club selection from modal
  const handleClubSelection = async (selectedCenter) => {
    debugLog("ðŸ¢ Club selected:", selectedCenter);
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
      debugLog("🔵 [App] Starting nutrition save:", {
        userId: saveData.userId,
        imagePath: saveData.imagePath,
        hasImageBase64: !!saveData.imageBase64,
      });
      setSaveLoading(true);

      // Await the captures POST if it hasn't resolved yet, so captureId is
      // always populated before saveNutritionAnalysis fires.  Without this,
      // a fast Gemini response races ahead of a slow /captures network call
      // and captureId arrives as null → the backend INSERTs a new row instead
      // of UPDATing the pre-created pending row → two records in the DB.
      if (pendingSharePromiseRef.current) {
        const share = await pendingSharePromiseRef.current;
        if (share && !foodCaptureIdRef.current) {
          foodCaptureIdRef.current = share.id;
        }
        pendingSharePromiseRef.current = null;
      }

      const saveRes = await saveNutritionAnalysis({
        ...saveData,
        // Pass captureId so the backend updates the pre-created pending row
        // instead of inserting a duplicate.  Reset the ref immediately after
        // so a retry cannot accidentally reuse the same row.
        captureId: foodCaptureIdRef.current || undefined,
      });
      foodCaptureIdRef.current = null;
      debugLog("✅ [App] Save successful:", saveRes);
      debugLog(`â±ï¸ [PERF] Database save: ${Date.now() - saveStart}ms`);

      if (process.env.NODE_ENV !== "production") {
        // debugLog('✅ Save successful:', saveRes);
      }

      // Store meal ID for NutritionCard auto-save updates
      setSavedNutritionMealId(saveRes.id || saveRes.insertId);
      debugLog("✅ [App] Meal ID stored:", saveRes.id || saveRes.insertId);

      // Refresh discipline scores and leaderboards after meal save
      handleLeaderboardRefresh();

      // ✅ ANDROID FIX: Don't auto-show popup - data is saved silently
      // Users can view saved data from Dashboard/Insights button
    } catch (err) {
      console.error("âŒ [App] Save failed:", err);
      console.error("âŒ [App] Error message:", err.message);
      console.error("âŒ [App] Error stack:", err.stack);
      const friendlySaveError = getFriendlyErrorMessage(err);
      setSaveError(friendlySaveError);
      throw err;
    } finally {
      setSaveLoading(false);
      debugLog("✅ [App] Save loading finished");
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
          "âŒ Weight save error after duplicate confirmation:",
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
      debugLog(
        "Image processing already in progress, skipping duplicate call",
      );
      return;
    }
    imageProcessingInProgress.current = true;

    // Store EXIF timestamp for education logs
    if (exifTimestamp) {
      debugLog("📸 EXIF Timestamp received:", exifTimestamp);
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

    // ✋ MANUAL MODE: skip AI entirely, open best manual modal
    if (manualModeActive) {
      imageProcessingInProgress.current = false;
      openBestManualModal();
      return;
    }

    // 🚨 FRAUD PREVENTION: On web only — native handles this per-source in ImageUpload
    // (native camera = always live; native gallery = checked via Capacitor photo.exif)
    if (!Capacitor.isNativePlatform()) {
      debugLog("ðŸ” Validating image freshness (web)...");
      const validation = await validateImageFreshness(file, 0);
      if (!validation.isValid) {
        console.error("âŒ Image validation failed:", validation);
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
      debugLog("✅ Image validated:", validation.message);
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
    debugLog("â±ï¸ [PERF] 🟢 Image processing started");

    // ✅ ANDROID PERFORMANCE: Use async FileReader for non-blocking operation
    try {
      const readStart = Date.now();
      const imageBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      debugLog(`â±ï¸ [PERF] File reading: ${Date.now() - readStart}ms`);

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
        debugLog(
          `â±ï¸ [PERF] Compression: ${
            Date.now() - compressStart
          }ms (${imageSizeMB.toFixed(2)}MB → ${newSizeMB.toFixed(2)}MB)`,
        );
      } else {
        debugLog(
          `â±ï¸ [PERF] Compression skipped (${imageSizeMB.toFixed(2)}MB)`,
        );
      }

      // Set preview and loading together to ensure overlay shows
      setImagePreview(processedImage);
      setLoading(true); // Ensure loading is true when preview shows

      // Set current user for token tracking on imageTypeDetector (unified detection)
      if (user?.id && user?.email) {
        imageTypeDetector.setCurrentUser(user.id, user.email);
      }

      // 🚀 [Share] Pre-create the public-share row IN PARALLEL with Gemini
      // detection. By the time we know the image is food, the share token is
      // typically already returned, so the share button appears the same
      // instant NutritionCard renders — not several hundred ms later.
      // If the image turns out to be weight/education/smartwatch, the row is
      // simply left as a pending capture (auto-expires in 30 days) — we never
      // surface its URL to the user.
      processedImageRef.current = processedImage;
      foodCaptureIdRef.current = null;
      setFoodShareUrl(null);
      const captureApiStart = Date.now();
      debugLog(
        `⏱️ [PERF] 🔗 POST /captures started (+${captureApiStart - perfStart}ms from capture start)`,
      );
      const pendingSharePromise = (async () => {
        try {
          const capUserId = user?.id || (await getUserId(user));
          if (!capUserId) return null;
          const capRes = await fetch(
            `${apiBaseUrl}/api/background-analysis/captures`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId: capUserId, imageBase64: processedImage }),
            },
          );
          if (!capRes.ok) {
            debugLog(
              `⏱️ [PERF] 🔗 POST /captures FAILED in ${Date.now() - captureApiStart}ms (status ${capRes.status})`,
            );
            return null;
          }
          const capData = await capRes.json();
          const capDuration = Date.now() - captureApiStart;
          if (capData.ok && capData.data?.id) {
            debugLog(
              `⏱️ [PERF] 🔗 POST /captures: ${capDuration}ms (+${Date.now() - perfStart}ms from capture start) → token ready`,
            );
            return {
              id: capData.data.id,
              url: `${apiBaseUrl}/share/${capData.data.token}`,
            };
          }
          debugLog(
            `⏱️ [PERF] 🔗 POST /captures responded ok=false in ${capDuration}ms`,
          );
          return null;
        } catch (err) {
          debugLog(
            `⏱️ [PERF] 🔗 POST /captures THREW after ${Date.now() - captureApiStart}ms: ${err?.message || err}`,
          );
          console.warn('[Share] pre-capture failed:', err);
          return null;
        }
      })();
      // Store a reference so performNutritionSave can await this promise
      // and guarantee captureId is set before the save request goes out.
      pendingSharePromiseRef.current = pendingSharePromise;

      // ⚡ [Share] FAST CLASSIFICATION — kick off a lightweight Gemini call
      // that ONLY returns the image type label (no nutrition extraction).
      // Typical latency ~400–900ms, vs. ~2–4s for the full unified detect
      // below. As soon as this confirms "food", we flip `imageType` and let
      // the captures POST `.then` surface the share URL, so the
      // "Share Image + Link" button appears ~1.5–3s sooner. The full
      // `detectImageType` call still runs afterwards to produce the actual
      // nutrition data — and if it disagrees with the fast classifier, the
      // weight/education/smartwatch branches below clear the optimistic
      // food state.
      const fastClassifyStart = Date.now();
      debugLog(
        `⏱️ [PERF] ⚡ Fast classify started (+${fastClassifyStart - perfStart}ms from capture start)`,
      );
      imageTypeDetector
        .classifyImageTypeFast(file)
        .then((fast) => {
          debugLog(
            `⏱️ [PERF] ⚡ Fast classify resolved in ${Date.now() - fastClassifyStart}ms (+${Date.now() - perfStart}ms from capture start) → type=${fast?.type}`,
          );
          if (fast?.type === 'food') {
            setImageType('food');
            pendingSharePromise.then((share) => {
              if (share) {
                foodCaptureIdRef.current = share.id;
                setFoodShareUrl(share.url);
                debugLog(
                  `⏱️ [PERF] 🔗 Share URL surfaced to UI (+${Date.now() - perfStart}ms from capture start)`,
                );
              }
            });
          }
        })
        .catch(() => {
          // Soft-fail — the full detect below will set imageType correctly.
        });

      // ✅ Detect image type using Gemini AI (single unified call)
      const apiStart = Date.now();
      debugLog(
        `⏱️ [PERF] 🔥 Gemini detectImageType started (+${apiStart - perfStart}ms from capture start)`,
      );
      const detectedType = await imageTypeDetector.detectImageType(file);
      debugLog(
        `⏱️ [PERF] 🔥 Gemini API call: ${Date.now() - apiStart}ms (+${Date.now() - perfStart}ms from capture start) → type=${detectedType?.type}`,
      );
      debugLog("ðŸ” [DEBUG] Image Type Detection Result:", {
        type: detectedType.type,
        confidence: detectedType.confidence,
        hasDetails: !!detectedType.details,
        hasFoods: detectedType.details?.foods?.length || 0,
        fullResponse: detectedType,
      });

      // ðŸ½ï¸ Early detection: If food items detected, show them immediately
      if (
        detectedType.details?.foods &&
        detectedType.details.foods.length > 0
      ) {
        const foodNames = detectedType.details.foods.map((f) => f.name);
        debugLog(
          "ðŸ½ï¸ [AI-DETECTED] Food items identified:",
          foodNames.join(", "),
        );
        setDetectedFoodNames(foodNames); // Show detected names in UI immediately
      }

      // ✅ PRIORITY 0: Smartwatch / fitness app screenshot — show activity card
      if (detectedType.type === "smartwatch" && detectedType.confidence > 0.5) {
        debugLog("⌚ Smartwatch image detected — showing watch activity card.");
        // Resolve the real DB userId now (same pattern used everywhere in App.js)
        let resolvedUserId = user?.id;
        if (!resolvedUserId) {
          try { resolvedUserId = await getUserId(user); } catch (err) { debugLog('[getUserId] failed, continuing with null userId', { err: err?.message }); }
        }
        setImageType("smartwatch");
        setWatchResult({
          caloriesBurned: detectedType.details?.caloriesBurned || 0,
          source: detectedType.details?.source || "Smartwatch",
          loggedAt: new Date().toISOString(),
          userId: resolvedUserId, // â† real DB id, not Firebase uid
        });
        // Soft-delete the pre-created pending capture row — this image is not
        // food so the row must not appear in the nutrition dashboard.
        pendingSharePromise.then((share) => {
          if (share?.id && user?.id) {
            fetch(`${apiBaseUrl}/api/background-analysis`, {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: share.id, userId: user.id }),
            }).catch((err) => debugLog('[Share] cleanup of smartwatch pending capture failed:', err?.message));
          }
        });
        setLoading(false);
        return;
      }

      // ✅ PRIORITY 1: Check for education meeting (AUTO-SAVE)
      if (detectedType.type === "education" && detectedType.confidence > 0.7) {        debugLog("🎓 Education meeting detected, analyzing...");
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
            debugLog("✅ Education data extracted:", educationData);

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
          console.error("âŒ Education analysis failed:", err);
          setError("Failed to analyze meeting screenshot: " + err.message);
        }

        // Soft-delete the pre-created pending capture row — this image is not
        // food so the row must not appear in the nutrition dashboard.
        pendingSharePromise.then((share) => {
          if (share?.id && user?.id) {
            fetch(`${apiBaseUrl}/api/background-analysis`, {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: share.id, userId: user.id }),
            }).catch((err) => debugLog('[Share] cleanup of education pending capture failed:', err?.message));
          }
        });
        setLoading(false);
        return;
      }

      // ✅ PRIORITY 2: Check for weight scale
      if (detectedType.type === "weight" && detectedType.confidence > 0.6) {
        // It's a weight scale - try to extract weight
        debugLog("ðŸ” Weight scale detected, extracting metrics...");
        setImageType("weight");

        // Use weight data from unified detection (no second API call needed)
        let detectedWeight;

        if (detectedType.details?.weightValue) {
          // Weight was already extracted in the unified detection call
          debugLog("✅ Using weight data from unified detection");
          // Normalize BMR - AI may return different casing or include units
          const rawBmr = detectedType.details?.bmr ?? detectedType.details?.Bmr ?? detectedType.details?.BMR ?? null;
          let normalizedBmr = null;
          if (rawBmr !== undefined && rawBmr !== null) {
            // Strip non-digits and parse integer (e.g., "1500 kcal" -> 1500)
            const digits = String(rawBmr).replace(/[^0-9]/g, '');
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
          // Fallback: Weight value not extracted — prompt user to retake
          debugLog(
            "⚠️ Weight value not detected in unified call, prompting retake",
          );
          setAlertModal({
            isOpen: true,
            title: "📸 Image Not Clear Enough",
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
          // debugLog('✅ Weight detected:', detectedWeight);

          // Convert lbs to kg if needed
          let weightToSave = { ...detectedWeight };
          if (detectedWeight.unit === "lbs") {
            debugLog(
              `🔄 Converting ${detectedWeight.weightValue} lbs to kg...`,
            );
            weightToSave.weightValue = weightDetectionService.convertWeight(
              detectedWeight.weightValue,
              "lbs",
              "kg",
            );
            weightToSave.unit = "kg";
            debugLog(`✅ Converted to ${weightToSave.weightValue} kg`);
          }

          // Don't display weight result yet - wait for successful save
          setWeightEntrySaved(false);
          setWeightDiff(null);
          setLoadingState("saving");
          setSaveLoading(true); // Show saving overlay
          
          // ðŸ” FRONTEND PRE-VALIDATION: Check against previous weight for realistic changes
          try {
            const tempUserId = user?.id || (await getUserId(user));
            const prevWeightRes = await fetch(
              `${apiBaseUrl}/api/weight/history?userId=${tempUserId}&includeImage=false&_t=${Date.now()}`,
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
              
              debugLog('ðŸ” Frontend weight validation:', validation);
              
              // If validation fails or shows major warning, don't save (backend will also validate)
              if (!validation.valid) {
                setSaveLoading(false);
                setLoading(false);
                
                // Just log and continue - backend will handle validation and show CustomAlertModal
                debugLog('âš ï¸ Frontend detected unrealistic weight change, backend will validate');
              } else if (validation.warning && validation.difference && Math.abs(validation.difference) > 1.5) {
                // Show info message for moderate changes
                debugLog(`â„¹ï¸ ${validation.message}`);
              }
            }
          } catch (validationError) {
            // Non-critical - continue with save even if validation fails
            console.warn('âš ï¸ Frontend validation check failed, proceeding with save:', validationError);
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
                `${apiBaseUrl}/api/weight/history?userId=${diffUserId}&includeImage=false&_t=${Date.now()}`,
              );
              const diffData = await diffRes.json();
              if (diffData.success && diffData.stats?.previousWeight) {
                const latestDate = diffData.stats.latestWeight?.date;
                const prevDate = diffData.stats.previousWeight.date;
                // Safety guard: only show diff if previous entry is from a different IST calendar date
                if (latestDate && prevDate && getISTDateStr(latestDate) !== getISTDateStr(prevDate)) {
                  const weightChange = parseFloat(diffData.stats.weightChange);
                  setWeightDiff({
                    previous: Math.round(parseFloat(diffData.stats.previousWeight.value) * 100) / 100,
                    previousDate: prevDate,
                    change: Math.round(weightChange * 100) / 100,
                  });
                  // Compute ideal weight for the share card
                  refreshIdealWeight();
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
                } else {
                  setWeightDiff(null);
                }
              }
            } catch (_) {
              /* non-critical — share card just won't show diff */
            }
          } catch (saveError) {
            // Validation failed or other save error - don't show weight result
            debugLog("âŒ Weight save failed, weight not displayed:", saveError.message);
            // Modal is already shown by performWeightSave, just stop here
            setLoading(false);
            return;
          }
          // Don't clear imagePreview or return - let it show like food images
        } else {
          // Weight detection failed — prompt user to retake a clearer photo
          if (detectedWeight.lowConfidence) {
            debugLog(`⚠️ Low confidence detection (${(detectedWeight.confidence * 100).toFixed(0)}%), prompting retake`);
          } else {
            debugLog("⚠️ Weight detection failed, prompting retake");
          }
          setAlertModal({
            isOpen: true,
            title: "📸 Please Take a Clearer Photo",
            message:
              "We couldn't read the weight from your image. Please ensure:\n• The scale display is fully visible\n• Good lighting (avoid shadows or glare)\n• Hold the camera steady directly above the scale",
            type: "error",
          });
          setCurrentWeightImage(null);
          setImagePreview(null);
          setLoading(false);
          return;
        }

        // Soft-delete the pre-created pending capture row — this image is not
        // food so the row must not appear in the nutrition dashboard.
        pendingSharePromise.then((share) => {
          if (share?.id && user?.id) {
            fetch(`${apiBaseUrl}/api/background-analysis`, {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: share.id, userId: user.id }),
            }).catch((err) => debugLog('[Share] cleanup of weight pending capture failed:', err?.message));
          }
        });
        setLoading(false);
        return;
      }

      // It's a food image - use nutrition data from unified detection
      console.log("🍽️ [Food Detection] Setting imageType to food");
      setImageType("food");
      // The pending-capture POST was kicked off in parallel with the Gemini
      // detection call (see `pendingSharePromise` above). Surface its URL as
      // soon as it resolves so the Share button appears the instant food is
      // confirmed — no extra round-trip wait after detection.
      pendingSharePromise.then((share) => {
        if (share) {
          foodCaptureIdRef.current = share.id;
          setFoodShareUrl(share.url);
          debugLog(
            `⏱️ [PERF] 🔗 Share URL surfaced to UI (+${Date.now() - perfStart}ms from capture start)`,
          );
        }
      });
      debugLog("ðŸ½ï¸ [DEBUG] Processing as FOOD image");
      debugLog("ðŸ½ï¸ [DEBUG] Food details check:", {
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
          debugLog("✅ Using nutrition data from unified detection");

          let foods = detectedType.details.foods;

          // 🎯 Update detected food names for display
          const foodNames = foods.map((f) => f.name);
          setDetectedFoodNames(foodNames);
          debugLog("ðŸ½ï¸ [AI-DETECTED] Food names:", foodNames.join(", "));

          // 🔴 CRITICAL: Preserve original AI-detected names BEFORE any corrections
          // This ensures we always know what the AI originally detected, even after auto-corrections
          foods = foods.map((food) => ({
            ...food,
            originalAiName: food.name, // Store the fresh AI detection
          }));
          debugLog(
            "✅ [PRESERVE] Original AI names saved:",
            foods.map((f) => `${f.name}`).join(", "),
          );

          // 🎯 APPLY USER'S PAST CORRECTIONS AUTOMATICALLY
          // debugLog("📋 [CORRECTION] Starting auto-correction process...");
          // debugLog(
          //   "📋 [CORRECTION] Foods before correction:",
          //   foods.map((f) => f.name),
          // );
          try {
            const userId = user?.id || (await getUserId(user));
            // debugLog("📋 [CORRECTION] User ID for corrections:", userId);
            if (userId) {
              const correctedFoods = await applyUserCorrections(foods, userId);
              // debugLog(
              //   "📋 [CORRECTION] Foods after correction:",
              //   correctedFoods.map((f) => f.name),
              // );
              foods = correctedFoods;

              // ðŸ› Capture ALL food detections for debug modal (corrections + no corrections)
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
                debugLog(
                  "ðŸ› [DEBUG-LOGS] Captured",
                  newLogs.length,
                  "food detection(s)",
                );
              }
            } else {
              console.warn(
                "âš ï¸ [CORRECTION] No userId available, skipping corrections",
              );
            }
          } catch (error) {
            console.error(
              "âŒ [CORRECTION] Failed to apply corrections:",
              error,
            );
            console.warn(
              "âš ï¸ Failed to apply corrections, using original AI detection:",
              error,
            );
          }
          // debugLog(
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

          debugLog("📊 [App.js] Calculated total from corrected foods:", {
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

              debugLog(
                `📊 [App.js] Mapping food "${food.name}" to detailedItem:`,
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
          console.error("âŒ [DEBUG] No food data extracted from image");
          console.error("âŒ [DEBUG] Detection details:", detectedType.details);
          console.error(
            "âŒ [DEBUG] Full detectedType object:",
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
              "🤖 The AI model is temporarily unavailable. Please try again later.";
          } else if (isNetworkError) {            errorMessage =
              "🌐 Please check your internet connection (WiFi or mobile data) and try again.";
          } else if (isQualityIssue) {
            errorMessage = "📸 Please take a clearer photo with good lighting. Make sure the display is fully visible and the camera is held steady.";
          } else if (isNonFoodImage) {
            errorMessage =
              "⚠️ Please take a photo of food, weight scale, or educational content.";
          } else {
            errorMessage =
              "📸 Could not detect the image. Please take a clear photo and try again.";
          }

          setError(errorMessage);
          // Clear share state – the Share button must not linger when AI
          // yields no food data (e.g. Gemini quota exhausted for the day).
          setFoodShareUrl(null);
          setImageType(null);
          foodCaptureIdRef.current = null;
          pendingSharePromiseRef.current = null;
          // ✅ "Enter Manually" button is shown in the error card for ALL error types
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
            debugLog("âš ï¸ Duplicate food detected:", duplicateCheck);
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
          console.error("âŒ Save failed:", err.message);

          const friendlySaveError = getFriendlyErrorMessage(err);
          setSaveError(friendlySaveError);
          setSaveLoading(false);
        }
      } catch (err) {
        const friendlyMessage = getFriendlyErrorMessage(err);
        setError(friendlyMessage);
        console.error("âŒ Gemini analysis error:", err);
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
      if (errorMessage.toLowerCase() === "load failed" || errorMessage.includes("Failed to fetch")) {
        setError("🌐 Please check your internet connection (WiFi or mobile data) and try again.");
      } else {
        // Don't show error box for weight validation failures (already showing custom modal)
        setError("Failed to process image: " + errorMessage);
      }
      console.error("❌ Image processing error:", err);
    } finally {
      setLoading(false);
      imageProcessingInProgress.current = false;
      debugLog(
        `â±ï¸ [PERF] ✅ TOTAL PROCESSING TIME: ${Date.now() - perfStart}ms`,
      );
      debugLog("â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”");
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
      rawMessage.includes("Failed to fetch") ||
      rawMessage.toLowerCase().includes("load failed") ||
      rawMessage.includes("timeout") ||
      rawMessage.includes("connection")
    ) {
      return "ðŸŒ Please check your internet connection (WiFi or mobile data) and try again.";
    } else if (rawMessage.includes("timeout")) {
      return "ðŸŒ Please check your internet connection (WiFi or mobile data) and try again.";
    } else if (rawMessage.includes("connection")) {
      return "ðŸŒ Please check your internet connection (WiFi or mobile data) and try again.";
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
      return "ðŸ½ï¸ Could not detect food items. Please take a clear photo of your meal.";
    } else if (rawMessage.includes("Invalid response format")) {
      return "🤖 The AI model is temporarily unavailable. Please try again later.";
    }

    // Generic fallback
    else if (rawMessage.toLowerCase().includes("analysis")) {
      return "💾 Unable to save your analysis. The nutrition data is still shown above.";
    }

    return "âŒ Something went wrong. Please try again.";
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

      // ✅ User is intentionally signing in — clear the sign-out block flags
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
              "✅ [handleSignIn] Stored user email in localStorage:",
              userEmail,
            );
          }

          // Save user to backend first
          const saveResult = await saveUserToBackend(user);
          debugLog("📦 [handleSignIn] saveResult:", saveResult);
          const isNewUser = saveResult?.isNewUser === true;
          debugLog("🆕 [handleSignIn] isNewUser:", isNewUser);

          // Clear the safety timeout immediately after save completes
          clearTimeout(safetyTimeout);

          // âš ï¸ CRITICAL: Check if sign-out was triggered while we were saving
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
              debugLog("🆕 [handleSignIn] New user detected");
            }
          } else {
            // User was saved but is inactive or not found - modal will show
            setUser(user); // Keep user state so modal can show user email
          }
        } catch (saveError) {
          // If save fails, still allow user to proceed (fail-open for backend issues)
          console.error(
            "âš ï¸ Backend save/check failed, allowing user access:",
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
        debugLog("🔄 Redirect initiated, waiting for result...");
        // Don't clear timeout yet for redirect flow
      }
    } catch (error) {
      console.error("âŒ Sign in error:", error);
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

      // ✅ User is intentionally signing in — clear the sign-out block flags
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
              "✅ [handlePopupSignIn] Stored user email in localStorage:",
              userEmail,
            );
          }

          // Save user to backend first
          const saveResult = await saveUserToBackend(user);
          debugLog("📦 [handlePopupSignIn] saveResult:", saveResult);
          const isNewUser = saveResult?.isNewUser === true;
          debugLog("🆕 [handlePopupSignIn] isNewUser:", isNewUser);

          // Clear the safety timeout immediately after save completes
          clearTimeout(safetyTimeout);

          // âš ï¸ CRITICAL: Check if sign-out was triggered while we were saving
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
              debugLog("🆕 [handlePopupSignIn] New user detected");
            }
          } else {
            // User was saved but is inactive or not found - modal will show
            setUser(user); // Keep user state so modal can show user email
          }
        } catch (saveError) {
          // If save fails, still allow user to proceed (fail-open for backend issues)
          console.error(
            "âš ï¸ Backend save/check failed, allowing user access:",
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
      console.error("âŒ Popup sign-in error:", error);
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
          "✅ [saveUserToBackend] User saved successfully, isNewUser:",
          data.isNewUser,
        );

        // If this is a new user, trigger the profile modal
        if (data.isNewUser) {
          debugLog(
            "🆕 [saveUserToBackend] New user detected, will show profile modal",
          );
        }
      } else {
        console.warn(
          "âš ï¸ [saveUserToBackend] Save completed with warning:",
          data,
        );
      }

      return data;
    } catch (error) {
      console.error(
        "âŒ [saveUserToBackend] Failed to save user to backend:",
        error,
      );
      throw error; // Re-throw so caller can handle
    }
  };

  const handleSignOut = async () => {
    try {
      // Phase 3d-a: Observe in shadow FSM (no behaviour change).
      authFsm.send({ type: authFsm.E.SIGN_OUT_REQUESTED, reason: "user" });

      // Do NOT set loading=true here — it would pass loading=true to Login
      // which immediately shows "Signing in..." on the Google button after sign-out.

      // Set sign-out in progress flag to prevent concurrent sign-in
      signOutInProgress.current = true;

      // ✅ Ensure loading is false BEFORE showing Login screen
      setLoading(false);

      // ✅ Set React gate FIRST — this immediately shows Login screen
      // and blocks any Firebase re-auth callbacks from re-logging in
      setForceLoggedOut(true);

      // Clear the fresh sign-in flag immediately to prevent re-login issues
      sessionStorage.removeItem("freshGoogleSignIn");

      // Clear user context cache
      clearContextCache();
      setUserContext(null);
      setUserContextLoading(false);
      debugLog("ðŸ—‘ï¸ [Sign Out] User context cache and state cleared");

      // Clear userId session cache
      clearUserIdCache();
      Session.clearDbUserId();
      // Clear demo meal history on sign-out
      Session.clearDemoMeals();
      // Clear profile-complete flag so a new/different user sees the gate if needed
      const emailKey = Session.getUserEmail() || "";
      Session.clearProfileComplete(emailKey);
      profileCompletedRef.current = false;
      debugLog("ðŸ—‘ï¸ [Sign Out] UserId cache cleared");

      if (Capacitor.isNativePlatform()) {
        try {
          await GalleryMonitor.clearCurrentUser();
        } catch (clearError) {
          console.error(
            "âš ï¸ Failed to clear GalleryMonitor user (method may not exist):",
            clearError,
          );
          // Continue with sign out even if this fails
        }
      }
      await signOutUser();
      // Phase 3d-a: Observe in shadow FSM (no behaviour change).
      authFsm.send({ type: authFsm.E.SIGN_OUT_COMPLETED });
      // ✅ Clear all auth-related localStorage keys
      Session.clearUserEmail();
      Session.clearOtpVerified();
      Session.clearOtpUser();
      Session.clearCurrentPage();
      Session.clearDbUserId();
      // ✅ Clear nutrition / background analysis caches so a new login never sees old images
      localStorage.removeItem("backgroundAnalyses");
      localStorage.removeItem("wellnessBuddy_lastBgNutritionId");
      localStorage.removeItem("dashboard_activeTab");
      GalleryMonitor.clearLocalBackgroundAnalyses();
      // Keep "userSignedOut" flag — set by signOutUser() to block iOS silent re-auth
      sessionStorage.clear();
      resetApp();
    } catch (error) {
      console.error("âŒ Sign out error:", error);
      // ✅ Even if signOut throws, force clear the UI so user isn't stuck
      Session.clearUserEmail();
      Session.clearOtpVerified();
      Session.clearOtpUser();
      Session.clearCurrentPage();
      Session.clearDbUserId();
      localStorage.removeItem("backgroundAnalyses");
      localStorage.removeItem("wellnessBuddy_lastBgNutritionId");
      localStorage.removeItem("dashboard_activeTab");
      try { GalleryMonitor.clearLocalBackgroundAnalyses(); } catch (err) { debugLog('[signOut] clearLocalBackgroundAnalyses failed (non-critical)', { err: err?.message }); }
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
    debugLog("ðŸ” [handleOtpVerified] Called with isNewUser:", isNewUser);

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

        // Check user status with timeout for iOS
        let isActive = true;
        try {
          const statusPromise = checkUserStatus(parsedUser);
          const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(true), 5000));
          isActive = await Promise.race([statusPromise, timeoutPromise]);
        } catch (statusError) {
          console.warn("âš ï¸ [handleOtpVerified] Status check failed, proceeding:", statusError);
          isActive = true; // Default to active on error
        }

        if (!isActive) {
          setUser(parsedUser);
          setIsOtpVerified(false);
          return;
        }

        setIsOtpVerified(true);
        Session.markOtpVerified();

        // ✅ User is logging in via OTP — clear the sign-out gate
        Session.clearUserSignedOut();
        setForceLoggedOut(false);

        // Store user email in localStorage for API calls
        const userEmail = parsedUser.email || parsedUser.Email;
        if (userEmail) {
          Session.setUserEmail(userEmail);
          debugLog(
            "✅ [handleOtpVerified] Stored user email in localStorage:",
            userEmail,
          );
        }

        setUser(parsedUser);

        // Check profile completion for all users — new users will always have missing
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

  // useDeferredValue for lazy pages — must be declared BEFORE any early returns (Rules of Hooks)
  const deferredShowDashboard = useDeferredValue(showDashboard);
  const deferredShowDisciplineReport = useDeferredValue(showDisciplineReport);
  const deferredShowActivityTimeReport = useDeferredValue(showActivityTimeReport);
  const deferredShowWellnessCounselling = useDeferredValue(showWellnessCounselling);

  // Loading state
  if (authLoading) {
    return <LoadingSpinner context="normal" />;
  }

  // ✅ OTP user restore in progress — keep spinner until user is fully restored
  if (isOtpVerified && !user) {
    return <LoadingSpinner context="normal" />;
  }

  // ✅ Profile check in progress — keep spinner until check is done
  if (profileChecking) {
    return <LoadingSpinner context="normal" />;
  }

  // ✅ iOS Sign-out gate: user explicitly signed out — always show Login
  // This prevents Firebase silent re-auth from bypassing the logout
  if (forceLoggedOut) {
    return (
      <Login
        onSignIn={isMobileDevice() ? handleSignIn : handlePopupSignIn}
        loading={loading}
        error={error}
        onOtpVerified={handleOtpVerified}
      />
    );
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
  if (deferredShowDashboard) {
    return (
      <Suspense fallback={<LoadingSpinner context="normal" />}>
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
        />
      </Suspense>
    );
  }

  // Step Counter page — FEATURE DISABLED
  // if (showStepCounter) {
  //   return (
  //     <Suspense fallback={<LoadingSpinner message="Loading step counter..." />}>
  //       <StepCounter user={user} userId={user?.id} userRole={userRole} onBack={() => setShowStepCounter(false)} />
  //     </Suspense>
  //   );
  // }

  // Screen Time page — FEATURE DISABLED
  // if (showScreenTime) {
  //   return (
  //     <Suspense fallback={<LoadingSpinner message="Loading screen time..." />}>
  //       <ScreenTimePage user={user} userRole={userRole} userId={user?.id} onBack={() => setShowScreenTime(false)} />
  //     </Suspense>
  //   );
  // }

  // Reminders page — FEATURE DISABLED
  // if (showReminders) {
  //   return (
  //     <Suspense fallback={<LoadingSpinner message="Loading reminders..." />}>
  //       <ReminderSettingsPage onBack={() => setShowReminders(false)} />
  //     </Suspense>
  //   );
  // }

  // Discipline Report for all users
  if (deferredShowDisciplineReport) {
    return (
      <Suspense
        fallback={<LoadingSpinner message="Loading discipline report..." />}
      >
        <DisciplineReport
          user={user}
          onBack={() => {
            setShowDisciplineReport(false);
            Session.setCurrentPage("main");
          }}
          apiBaseUrl={apiBaseUrl}
          userRole={userRole}
        />
      </Suspense>
    );
  }

  // Activity Time Report
  if (deferredShowActivityTimeReport) {
    return (
      <Suspense
        fallback={<LoadingSpinner message="Loading activity time report..." />}
      >
        <ActivityTimeReport
          user={user}
          onBack={() => {
            setShowActivityTimeReport(false);
            Session.setCurrentPage("main");
          }}
          apiBaseUrl={apiBaseUrl}
          userRole={userRole}
        />
      </Suspense>
    );
  }

  // Wellness Counselling - Full page view
  if (deferredShowWellnessCounselling) {
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
    <LocationGuard>
    <div className="h-screen w-screen bg-gradient-to-br from-green-50 to-green-100 flex flex-col overflow-hidden" style={{ paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)' }}>
      <Header
        user={user}
        userRole={userRole}
        onShowBackgroundHistory={showDashboardPage}
        // onShowStepCounter={showStepCounterPage}   // FEATURE DISABLED
        // onShowScreenTime={showScreenTimePage}      // FEATURE DISABLED
        // onShowReminders={showRemindersPage}        // FEATURE DISABLED
        onShowAdminDashboard={
          userRole === "admin" || userRole === "developer"
            ? () => startTransition(() => setShowAdminDashboard(true))
            : null
        }
        onShowDisciplineReport={() => {
          startTransition(() => setShowDisciplineReport(true));
          Session.setCurrentPage("discipline-report");
        }}
        onShowActivityTimeReport={() => {
          startTransition(() => setShowActivityTimeReport(true));
          Session.setCurrentPage("activity-time-report");
        }}
        onShowWellnessEnrollment={() => startTransition(() => setShowWellnessEnrollment(true))}
        onShowWellnessReport={
          userRole === "admin" ||
          userRole === "coach" ||
          userRole === "developer"
            ? () => startTransition(() => setShowWellnessReport(true))
            : null
        }
        onShowWellnessCounselling={() => startTransition(() => setShowWellnessCounselling(true))}
        onShowAttendanceReport={() => startTransition(() => setShowAttendanceReport(true))}
        onShowNutritionCentersMap={() => startTransition(() => setShowNutritionCentersMap(true))}
        onShowRegisterCenter={() => startTransition(() => setShowRegisterCenter(true))}
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

      <div className="flex-1 overflow-y-auto px-3 xs:px-4 pt-14 xs:pt-16" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 24px)' }}>
        <div className="max-w-lg w-full mx-auto space-y-4 xs:space-y-6 py-2 xs:py-3">
          {/* Back button toast message */}
          {toast.visible && (
            <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] left-1/2 transform -translate-x-1/2 bg-white text-gray-800 px-4 py-2 rounded-lg shadow-xl z-[9999] text-sm border border-gray-200 whitespace-nowrap">
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

          {error && (() => {
            const isAiUnavailable = error.includes("AI model is temporarily unavailable");

            if (isAiUnavailable) {
              // Silently clear the error — no modal shown
              setTimeout(() => { setError(null); setImagePreview(null); lastImageFileRef.current = null; }, 0);
              return null;
            }

            return (
              <div className="bg-amber-50 border border-amber-200 rounded-xl shadow-sm overflow-hidden">
                <div className="flex items-start gap-2 px-4 pt-3 pb-2">
                  <span className="text-lg leading-none flex-shrink-0 mt-0.5">💡</span>
                  <p className="text-sm text-amber-800 leading-relaxed break-words flex-1">
                    {error.replace(/^[🤖⚠️🌐📸🍽️💡]\s*/, "")}
                  </p>
                  <button
                    onClick={() => { setError(null); setImagePreview(null); lastImageFileRef.current = null; }}
                    className="flex-shrink-0 p-1.5 rounded-lg hover:bg-black/10 transition-colors text-gray-400 hover:text-gray-600 mt-0.5"
                    aria-label="Dismiss"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
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

          {imageType === "food" && foodShareUrl && nutritionData && (
            <div className="px-4 pb-3">
              <TouchFeedbackButton
                disabled={isManualSharing}
                onClick={async () => {
                  // Ref check prevents re-entry on rapid taps; state disables
                  // the button visually so the user gets immediate feedback.
                  if (isManualSharingRef.current) return;
                  isManualSharingRef.current = true;
                  setIsManualSharing(true);
                  try {
                  const captionText =
                    `Check out my meal on Wellness Valley!\n${foodShareUrl}`;
                  const dataUrl = foodShareImageDataUrlRef.current;
                  // Fast path: cached pre-painted card image.
                  if (dataUrl) {
                    const result = await shareViaCapacitorAPI(dataUrl, {
                      title: "My Meal",
                      text: captionText,
                      fileName: `wellness-valley-meal-${Date.now()}.jpg`,
                    });
                    if (result.ok) {
                      resetCaptureToHome();
                      return;
                    }
                  }
                  // Fallback: capture live, or share raw photo with link.
                  try {
                    if (foodShareCardRef.current) {
                      await captureAndShare(foodShareCardRef.current, {
                        title: "My Meal",
                        text: captionText,
                        fileName: `wellness-valley-meal-${Date.now()}.jpg`,
                      });
                      resetCaptureToHome();
                      return;
                    }
                    await shareImageWithLink(
                      processedImageRef.current || imagePreview,
                      foodShareUrl,
                      { title: "My Meal", text: "Check out my meal on Wellness Valley!" },
                    );
                    resetCaptureToHome();
                  } catch (_) { /* user cancelled */ }
                  } finally {
                    isManualSharingRef.current = false;
                    setIsManualSharing(false);
                  }
                }}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white px-4 py-3 rounded-xl text-sm font-semibold hover:bg-emerald-700 active:bg-emerald-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Share2 className="w-4 h-4 flex-shrink-0" />
                Share Image + Link
              </TouchFeedbackButton>
            </div>
          )}

          {/* Hidden off-screen template captured to image for the instant-share
              button. Matches the post-analysis NutritionCard share template
              (profile header + photo) minus the nutrition breakdown. */}
          {imageType === "food" && (imagePreview || processedImageRef.current) && (
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
                if (caloriesBurned > 0) setWatchBurnedCalories(caloriesBurned);
              }}
              onClose={() => {
                setWatchResult(null);
                setImagePreview(null);
                setSelectedImage(null);
                setImageType(null);
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
                              const isLoss = current && current > idealWeight.value + 0.5;
                              const isGain = current && current < idealWeight.min - 0.5;
                              if (isLoss) return `${idealWeight.value} ${idealWeight.unit}`;
                              if (isGain) return `${idealWeight.min} ${idealWeight.unit}`;
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
                              ? "▲"
                              : weightDiff.change < 0
                              ? "▼"
                              : "—"}{" "}
                            {weightDiff.change === 0
                              ? "No change"
                              : Math.abs(weightDiff.change) < 1
                              ? `${Math.round(Math.abs(weightDiff.change) * 1000)} g`
                              : `${Math.abs(weightDiff.change).toFixed(2)} ${weightResult.unit}`}
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
                          const ok = await shareCachedDataUrl(cached, shareOpts);
                          if (ok) return;
                        }

                        // Fallback: capture live (slower).
                        await new Promise((resolve) => setTimeout(resolve, 100));
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

      {/* Manual Mode Toast */}
      {manualModeToast && (
        <div
          key={manualModeToast}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none animate-manual-toast"
        >
          <span className={`text-xs font-semibold tracking-wide ${
            manualModeToast === "enabled" ? "text-green-500" : "text-gray-400"
          }`}>
            {manualModeToast === "enabled" ? "✦ Manual mode enabled" : "✦ Manual mode disabled"}
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

      {/* Smart Food Search Modal (replaces ManualFoodEntryModal — shows history + global search) */}
      <SmartFoodSearchModal
        isOpen={showManualFoodModal}
        onClose={() => { setShowManualFoodModal(false); setManualMealType(""); }}
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
          // Clear uploaded image — it's unrelated to this education log
          setImagePreview(null);
          setSelectedImage(null);
          setImageType("education");
          setLoadingState("saving");
          setSaveLoading(true);
          await saveEducationLog(
            { platform: data.platform, topic: data.topic, confidence: 0.9, participantCount: null },
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
            try { resolvedUserId = await getUserId(user); } catch (err) { debugLog('[getUserId] failed, continuing with null userId', { err: err?.message }); }
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

      {/* Manual Weight Entry Modal — disabled */}
      {false && <ManualWeightEntryModal
        isOpen={showManualWeightModal}
        onClose={() => {
          setShowManualWeightModal(false);
          setCurrentWeightImage(null);
          setLoading(false);
        }}
        onBack={() => {
          setShowManualWeightModal(false);
          setCurrentWeightImage(null);
          if (manualModeActive) openBestManualModal();
        }}
        onSave={handleManualWeightSave}
        imagePreview={currentWeightImage}
        lastWeight={lastWeight}
        altSwitchButtons={getAltSwitchButtons("weight")}
      />}

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
          debugLog("✅ [NewUserProfile] Profile updated successfully");
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
          showPictureSection={true}
          snoozeData={profilePicSnoozeData}
          userId={user.id || user.UserId || Session.getDbUserId()}
          onComplete={async (savedData) => {
            const email =
              user?.email ||
              user?.Email ||
              Session.getUserEmail() ||
              "";
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
              // Picture was snoozed — snooze data already saved to DB by handleRemindLater
              setProfilePicSnoozeData(null);
            }
          }}
        />
      )}

      {/* ── Mandatory Profile Picture Upload Gate — DISABLED ─────────────
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
                  debugLog("â° [Profile Picture] Snooze saved to DB:", data.snooze);
                }
              } catch (err) {
                console.error("âŒ [Profile Picture] Failed to save snooze to DB:", err);
              }
            }
            setShowMandatoryProfilePictureModal(false);
          }}
          onComplete={async (uploadedImage) => {
            debugLog("✅ [Profile Picture] Profile picture uploaded successfully");
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
              debugLog("✅ [Profile Picture] User state updated immediately with new profile picture");
            }
            
            // Also fetch updated user profile in background to ensure consistency
            try {
              debugLog("🔄 [Profile Picture] Refreshing user profile data in background...");
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
                  debugLog("✅ [Profile Picture] User state synced with server data");
                }
              }
            } catch (err) {
              console.error("âŒ [Profile Picture] Failed to refresh user profile:", err);
              // Don't block user - they already have the image from immediate update
            }
            
            setShowMandatoryProfilePictureModal(false);
          }}
        />
      )}
      ─────────────────────────────────────────────────────────────────── */}

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
              user?.email || user?.Email || Session.getUserEmail()
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

      {/* ðŸ› Floating Bug Button - Show Correction Logs (Web & Android) */}
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

      {/* ðŸ› Correction Logs Modal (Web & Android Optimized) */}
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
                        â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
                      </div>
                      <div className="text-blue-400 font-bold mb-1">
                        ║ 🔄 FOOD CORRECTION FLOW
                      </div>
                      <div className="text-blue-400 font-bold mb-2">
                        â• â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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
                        â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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
                      .catch(() => debugLog("Copy not supported"));
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
    </LocationGuard>
  );
}

export default WellnessValleyApp;
