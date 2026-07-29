// src/App.js
// ============================================================================
// WellnessValleyApp ? App.js architecture policy (post-hygiene-phase, May 2026)
// ----------------------------------------------------------------------------
// App.js is INTENTIONALLY the orchestrator. It is NOT being shrunk to a thin
// shell. The following responsibilities live here on purpose and should NOT
// be extracted without a strong reason:
//
//   1. Identity & session ownership
//      - The single `user` / `isUserActive` / `userContext` source of truth.
//      - Sign-in / sign-out flows (Firebase + OTP).
//      - The iOS Keychain re-auth gate (`forceLoggedOut`) ? MUST stay read
//        synchronously at component init, before Firebase fires.
//
//   2. Native lifecycle ownership
//      - All Capacitor native concerns are now delegated to
//        `shared/services/nativeLifecycle` (May 2026 phase). App.js still
//        owns the orchestration *call sites* (effects decide WHEN to register,
//        WHEN to fire permissions, WHEN to hide splash); the service owns the
//        plugin plumbing.
//      - Multiple `appStateChange` listeners coexist (gallery effect +
//        foreground profile-check effect) ? each consumer receives its own
//        PluginListenerHandle and removes only its own handle on cleanup.
//        Nothing in this codebase calls `App.removeAllListeners()`.
//      - SplashScreen dismissal timing (500 ms after first React render).
//      - StatusBar overlay configuration.
//      - Permissions request orchestration (camera/photos ? push ? geolocation).
//
//   3. Routing orchestration
//      - The 24 `show*` view-flag booleans + their localStorage mirroring
//        (`currentPage`). This is a deliberate homemade router. It can be
//        replaced by a real router LATER as a single focused effort ?
//        do not collapse it into a reducer in the meantime (modal-over-route
//        invariants would break).
//
//   4. Cross-feature glue that legitimately spans VSA boundaries
//      - The image-capture pipeline (it dispatches to nutrition / weight /
//        education / activity ? no single feature owns it).
//      - Watch-burned-calories ? Nutrition write (cross-feature by design).
//
// State-machine candidates (deferred to later phases):
//   - Auth flow (idle ? restoring ? authenticating ? checking_status ?
//     checking_setup ? checking_picture ? ready | inactive | not_found).
//   - Image-capture pipeline (idle ? captured ? detecting ? analyzing ?
//     correcting ? checking_duplicate ? confirming ? saving | manual_fallback).
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
} from "react";
import ReactDOM, { flushSync } from "react-dom";
import { WaitingForCoachModal } from "./shell/components/WaitingForCoachModal";
import { WeightShareCard } from "./shell/components/WeightShareCard";
import { WeightResultCard } from "./shell/components/WeightResultCard";
import { Capacitor } from "@capacitor/core";
import { Bug, Share2, Pencil, Check, X as XIcon, Sparkles } from "lucide-react";
import ImageUpload from "./shared/components/ImageUpload";
import {
  NutritionCard,
  FoodImageShareCard,
  HomeNutritionCarousel,
} from "./features/nutrition";
import { EducationLogCard } from "./features/education";
import { WatchActivityCard } from "./features/activity";
import LoadingSpinner from "./shared/components/LoadingSpinner";
import { Login } from "./features/user";
import { InactiveUserModal } from "./features/user";
import { UserNotFoundModal } from "./features/user";
import { fetchInactiveCoachInfo } from "./features/user/services/inactiveCoachService";
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
import { analyzeImage as orchestrateAnalyzeImage } from "./shared/services/orchestratorService";
import * as captureQueue from './shared/services/captureQueue';
import { useOfflineCaptureQueue } from './hooks/useOfflineCaptureQueue';
import { useWeightCapture } from './hooks/useWeightCapture';
import { weightDetectionService } from "./features/weight";
import CelebrationConfetti from "./shared/components/CelebrationConfetti";
import { duplicateDetectionService } from "./features/nutrition";
import { applyUserCorrections } from "./features/nutrition";
import { aggregateFoodTotals } from "./features/nutrition";
import {
  captureAndShare,
  precaptureShareImage,
  shareCachedDataUrl,
  shareImageWithLink,
  shareViaCapacitorAPI,
  shareTextViaWhatsApp,
  resolveShareDisplayName,
  ensureShareDisplayName,
  buildQuickShareText,
  cacheProfileUserName,
  getCachedProfileUserName,
} from "./shared/utils/shareUtils";
import { hasValidProfileName } from "./features/user/domain/profileCompleteness";
import { resolveLocationFields, stripLocationDiagnostics } from "./shared/utils/resolveLocationFields";
import {
  startUserLocationCache,
  stopUserLocationCache,
  refreshUserLocationCache,
  getCachedLocationFields,
} from "./shared/services/userLocationCache";
import { validateImageFreshness } from "./shared/utils/imageValidator";
import { ManualWeightEntryModal } from "./features/weight";
import { SmartFoodSearchModal } from "./features/nutrition";
import { ManualEducationEntryModal } from "./features/education";
// VSA-compliant barrel imports (helpers exported via features/captures/index.js)
import {
  UnknownCaptureModal,
  UnknownShareViewer,
  fetchUnknownShare,
  promoteUnknownToFood,
  deleteCapture,
  undoDeleteCapture,
  buildAnalysisFromGeminiAnalysis,
  hasRecognizedFood,
} from "./features/captures";
import UnknownCaptureUndoBanner, {
  UNDO_SECONDS,
} from "./shell/components/UnknownCaptureUndoBanner";
import { tabForImageType } from "./shared/lib/tab-by-image-type";
import { isLowConfidenceFood } from "./shared/lib/is-low-confidence-food";
import { isFlagEnabled } from "./config/featureFlags";
import { fetchCityVillage } from "./shared/lib/reverseGeocode";
import { ManualWatchEntryModal } from "./features/activity";
import { DuplicateFoodModal } from "./features/nutrition";
import { UserProfileModal } from "./features/user";
import { UserProfilePage } from "./features/user";
import { CompleteProfilePage } from "./features/user";
import { MandatoryProfilePictureModal } from "./features/user";
import { ClubSelectionModal } from "./features/nutrition-centers";
import CustomAlertModal from "./shared/components/CustomAlertModal";
import { WeightProgressTipsModal } from "./features/weight-progress-tips/components/WeightProgressTipsModal";
import PhysicalActivitySetup from "./features/user/components/PhysicalActivitySetup";
import { fetchProfile } from "./features/user/services/profileService";
import {
  NutritionRefreshProvider,
  useNutritionRefresh,
} from "./shared/context/NutritionRefreshContext";
import LEADERBOARD_CONFIG from "./config/leaderboardConfig";
import GalleryMonitor from "./shared/services/galleryMonitor";
import KeepAwakePlugin from "./shared/plugins/keepAwakePlugin";
import * as Session from "./shared/services/sessionStorage";
import * as nativeLifecycle from "./shared/services/nativeLifecycle";
import * as PermissionManager from "./shared/services/permissionManager";
import { clearHomeDashboardSnapshot } from "./shared/services/homeDashboardActivity";
import PermissionDeniedModal from "./shared/components/PermissionDeniedModal";
import PermissionBlockedPage from "./shared/components/PermissionBlockedPage";
import GpsRequiredModal from "./shared/components/GpsRequiredModal";
import * as authFsm from "./shared/services/auth/fsm";
import {
  fetchProfileCompletion,
  fetchProfilePicture,
} from "./shared/services/auth/userProfile";
import {
  fetchUserStatus,
  fetchSetupStatus,
} from "./shared/services/auth/userSetup";
import {
  silentlyCompleteDemoSetup,
  DEMO_EMAIL,
} from "./shared/services/auth/demoSetup";
import { debugLog } from "./shared/utils/logger";
import { getDeviceTimezoneIana } from "./shared/utils/deviceTimezone";
import { EmojiOrNative } from "./shared/components/icons/EmojiImage";
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

// ? PERFORMANCE: Lazy-load leaderboards ? they fire API calls on mount and are below the fold
const WeightLossLeaderboard = lazy(() =>
  import("./features/weight/components/WeightLossLeaderboard"),
);
const WellnessScoreLeaderboard = lazy(() =>
  import("./features/leaderboard/components/WellnessScoreLeaderboard"),
);
// ? ANDROID OPTIMIZATION: Lazy load heavy components
const Dashboard = lazy(() => import("./shell/components/Dashboard"));
const NutritionCentersMap = lazy(() =>
  import("./features/nutrition-centers/components/NutritionCentersMap"),
);
const NutritionCenterRegistration = lazy(() =>
  import("./features/nutrition-centers/components/NutritionCenterRegistration"),
);
const SetupWizard = lazy(() => import("./pages/SetupWizard"));
const ValidateOTP = lazy(() => import("./pages/ValidateOTP"));

const WellnessCounselling = lazy(() =>
  import("./pages/WellnessCounsellingCards"),
);
const WellnessUniversityEnrollment = lazy(() =>
  import("./pages/WellnessUniversityEnrollment"),
);
// ?? PERFORMANCE: Lazy-load Activity Report pages � coach/admin analytics views
const ActivityReport = lazy(() =>
  import("./features/activity/components/ActivityReport"),
);
const ActivityTimeReport = lazy(() =>
  import("./features/activity/components/ActivityTimeReport"),
);
// Testimonials � before/after transformation results with coach OTP verification
const TestimonialsPage = lazy(() =>
  import("./features/testimonials").then((m) => ({ default: m.TestimonialsPage })),
);
// Reports � coach-only analytics (e.g. downline weight status)
const DownlineWeightReport = lazy(() =>
  import("./features/reports").then((m) => ({ default: m.DownlineWeightReport })),
);
const WellnessScoreSetup = lazy(() =>
  import("./features/wellness-score-sheet").then((m) => ({ default: m.WellnessScoreSetup })),
);
const WellnessScorePage = lazy(() =>
  import("./features/wellness-score-sheet").then((m) => ({ default: m.WellnessScorePage })),
);
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
  const [showDashboard, setShowDashboard] = useState(false); // restored via useEffect to avoid suspending lazy component on mount
  const [dashboardInitialTab, setDashboardInitialTab] = useState(null); // 'nutrition' | 'weight' | null
  // Deep-link (App Link) seed values for Dashboard ? set when the app is
  // opened via /share/<token> and the resolve API confirms permission.
  // Cleared in showMainPage so a normal Dashboard open won't reuse them.
  const [dashboardInitialSelectedMember, setDashboardInitialSelectedMember] =
    useState(null);
  const [dashboardInitialDate, setDashboardInitialDate] = useState(null);
  const [dashboardInitialMealId, setDashboardInitialMealId] = useState(null);
  const [bmrUpdateKey, setBmrUpdateKey] = useState(0); // Increment to force BMR re-fetch in NutritionDashboard
  const [bodyParamsRefreshKey, setBodyParamsRefreshKey] = useState(0); // Increment to refresh Body Parameters cards after profile edits

  // -- Instant OTP session restore ------------------------------------------
  // For returning OTP users, pre-load the cached user synchronously so that
  // NEITHER the authLoading spinner NOR the isOtpVerified gate fires on
  // cold start. The home screen (and camera) open immediately ? same pattern
  // as WhatsApp / Snapchat. Background validation runs via a separate effect.
  const [user, setUser] = useState(() => {
    if (Session.isUserSignedOut()) return null;
    if (!Session.isOtpVerified()) return null;
    const u = Session.getOtpUser();
    if (!u) return null;
    // Attach cached DB userId so user.id is available from the first render.
    if (!u.id) {
      const dbId = Session.getDbUserId();
      if (dbId) u.id = dbId;
    }
    return u;
  });
  // ? iOS Sign-out gate: persisted in localStorage so it survives app restarts
  // Firebase re-auth from Keychain is blocked until user explicitly taps Sign In
  const [forceLoggedOut, setForceLoggedOut] = useState(
    Session.isUserSignedOut(),
  );
  // Skip the loading screen for returning OTP users (session pre-loaded from cache).
  const [authLoading, setAuthLoading] = useState(() => {
    if (Session.isUserSignedOut()) return true;
    if (Session.isOtpVerified() && Session.getOtpUser()) return false;
    return true;
  });
  const [isOtpVerified, setIsOtpVerified] = useState(Session.isOtpVerified());
  // true when the user object was pre-loaded from localStorage ? triggers the
  // background validation effect (checkUserStatus + checkProfileCompletion).
  const otpCacheRestoredRef = useRef(
    !Session.isUserSignedOut() &&
      Session.isOtpVerified() &&
      !!Session.getOtpUser(),
  );
  const [showInactiveModal, setShowInactiveModal] = useState(false);
  const [showUserNotFoundModal, setShowUserNotFoundModal] = useState(false);
  const [isInactiveReactivationFlow, setIsInactiveReactivationFlow] =
    useState(false); // true while inactive user is going through coach-OTP reactivation
  const [isWaitingForCoachOTP, setIsWaitingForCoachOTP] = useState(false); // true during 5-second wait after contacting coach
  const [isUserActive, setIsUserActive] = useState(true); // Track if user is active
  const [inactiveCoachName, setInactiveCoachName] = useState(null);
  const inactiveCoachIdRef = useRef(null);
  const isInactiveReactivationFlowRef = useRef(false);

  useEffect(() => {
    isInactiveReactivationFlowRef.current = isInactiveReactivationFlow;
  }, [isInactiveReactivationFlow]);

  useEffect(() => {
    if (!showInactiveModal) {
      setInactiveCoachName(null);
      inactiveCoachIdRef.current = null;
      return undefined;
    }

    let cancelled = false;
    (async () => {
      const info = await fetchInactiveCoachInfo({ apiBaseUrl, user });
      if (cancelled) return;
      setInactiveCoachName(info.coachName);
      inactiveCoachIdRef.current = info.coachId;
    })();

    return () => {
      cancelled = true;
    };
  }, [showInactiveModal, user, apiBaseUrl]);

  // For returning users who already granted permissions, start as true so the
  // camera opens immediately (Snapchat-like). ALWAYS false on native so the
  // camera-open effect cannot race ahead of the permission flow. Set to true
  // only by advancePermissionFlow after every required permission is confirmed.
  // On web there are no native permissions � start true immediately.
  const [permissionsReady, setPermissionsReady] = useState(
    () => !Capacitor.isNativePlatform(),
  );
  // GPS required modal: shown when location permission is granted but GPS/Location
  // Services are disabled on the device. Blocks home access until GPS is on.
  const [showGpsRequired, setShowGpsRequired] = useState(false);
  // Active per-permission gate. null = no gate active.
  // { type: 'camera'|'location'|'notifications', canRequest: boolean }
  // canRequest: true  ? OS can re-prompt � show [Allow Again] [Exit App]
  // canRequest: false ? permanently denied � show [Exit App] only
  const [activePermission, setActivePermission] = useState(null);
  // True while a native OS permission dialog is pending ("Allow Again" spinner).
  const [permissionDialogLoading, setPermissionDialogLoading] = useState(false);
  // Full-screen branded overlay that bridges the native splash ? camera gap.
  // Starts visible on native so the home screen is never shown during the
  // ~100-300 ms between splash dismiss and native camera overlay appearing.
  // Dismissed right before openCamera() is called, or by safety effects below.
  const [showLaunchOverlay, setShowLaunchOverlay] = useState(() =>
    Capacitor.isNativePlatform(),
  );
  const [manualModeActive, setManualModeActive] = useState(false); // always AI by default; auto-set by openBestManualModal on AI failure
  const [manualModeToast, setManualModeToast] = useState(""); // "enabled" | "disabled" | ""
  const [showManualWeightModal, setShowManualWeightModal] = useState(false);
  const [showManualFoodModal, setShowManualFoodModal] = useState(false);
  const [showManualEducationModal, setShowManualEducationModal] =
    useState(false);
  const [showManualWatchModal, setShowManualWatchModal] = useState(false);

  // PR 3 n++ disambiguation modal for low-confidence / unknown captures.
  // pendingSharePromise is retained so the user's pick re-tags the capture row.
  const [unknownCaptureModal, setUnknownCaptureModal] = useState({
    open: false,
    pendingSharePromise: null,
  });
  // PR-E / ADR-0003 n++ share-link viewer for `unknown` captures. Opened by the
  // deep-link handler when a resolved share has ImageType 'unknown'.
  const [unknownShareView, setUnknownShareView] = useState({
    open: false,
    captureId: null,
    imageBase64: null,
    createdAt: null,
    canMutate: false,
    retrying: false,
    error: null,
  });
  // 2026-06-09 n++ undo state for unknown capture deletion (share-link viewer)
  const [unknownShareUndo, setUnknownShareUndo] = useState(null);
  // { captureId, userId, imageBase64, expiresAt }
  // PR-E n++ when the share viewer's "Edit" is tapped, this drives a dedicated
  // SmartFoodSearchModal whose save promotes the capture unknown ? food.
  const [shareEditView, setShareEditView] = useState({
    open: false,
    captureId: null,
  });
  const [manualMealType, setManualMealType] = useState(""); // meal type passed to SmartFoodSearchModal
  const [weightWindow, setWeightWindow] = useState(null); // { start, end } for weight time window
  const [currentWeightImage, setCurrentWeightImage] = useState(null);
  const [imageType, setImageType] = useState(null); // 'food' | 'weight' | 'education'
  const [imageTimestamp, setImageTimestamp] = useState(null); // EXIF timestamp from image
  // Education time window fetched from DB (e.g. 07:15 - 08:45) ? no hardcoding
  const [educationWindow, setEducationWindow] = useState(null);

  // Weight Goal Mode setup prompt (forced for new/existing users who never set it)

  // Email gate � forced for phone-OTP users who have no email in their profile
  const [showPhysicalActivitySetup, setShowPhysicalActivitySetup] = useState(false);
  // Onboarding sequencing locks — camera/coach must wait until each gate is resolved.
  // Expected order: CompleteProfile → PhysicalActivity → Coach setup → Coach OTP → home camera.
  const [physicalActivityResolved, setPhysicalActivityResolved] = useState(false);
  const [coachSetupResolved, setCoachSetupResolved] = useState(false);

  const [idealWeight, setIdealWeight] = useState(null); // { value: number, unit: 'kg', heightCm: number } | null
  const [educationResult, setEducationResult] = useState(null); // Store education meeting results
  const [watchResult, setWatchResult] = useState(null); // Store smartwatch activity results
  const [educationRefreshKey, setEducationRefreshKey] = useState(0); // Increment to force EducationDashboard re-fetch
  // Nutrition refresh key removed - now using NutritionRefreshContext (see hooks below)
  const [watchBurnedCalories, setWatchBurnedCalories] = useState(0); // Latest kcal from watch upload ? pushed to NutritionDashboard
  const [sharePhotoBase64, setSharePhotoBase64] = useState(null); // CORS-safe base64 photo for share card
  const [savedProfileImage, setSavedProfileImage] = useState(null); // Custom profile image for share card.here
  const [savedUserName, setSavedUserName] = useState(null); // Saved profile name for share card
  const savedUserNameRef = useRef(null);
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
  /** Capture-time location (GPS/club) keyed by capture id — survives later save races. */
  const captureLocationByIdRef = useRef(new Map());
  const processedImageRef = useRef(null);
  const foodShareCardRef = useRef(null);
  const foodShareImageDataUrlRef = useRef(null);
  const [foodShareUrl, setFoodShareUrl] = useState(null);
  // ?? Snapchat-style overlay: holds the just-captured photo full-screen
  // until WhatsApp share has been launched (or a 3s safety timeout elapses).
  // This eliminates the home-screen + image-preview flash the user was
  // seeing between the camera OK button and the share sheet. We show the
  // actual photo (not a spinner) so the transition feels seamless.
  const [sharingPendingImage, setSharingPendingImage] = useState(null);
  const sharingPendingTimerRef = useRef(null);
  // Awaited in performNutritionSave before reading foodCaptureIdRef.current so
  // that a fast Gemini response never races ahead of a slow /captures POST,
  // which would leave captureId null and cause a duplicate DB row (INSERT
  // instead of UPDATE on the pre-created pending row).
  const pendingSharePromiseRef = useRef(null);
  // ?? End-to-end timing: stamped when the user picks/captures an image, used
  // by every downstream step to log "+Nms from capture start" so the full
  // pipeline (compress ? POST captures ? Gemini ? precapture ? Share sheet)
  // can be reconstructed from a single log dump.
  const captureFlowStartRef = useRef(0);
  const foodShareImageReadyAtRef = useRef(0);

  // Refs for analysis results - used by resume listener to check if results are visible
  // without closure staleness issues (the effect is mount-only with [] deps).
  // imageTypeRef is also used by showDashboardPage (stable useCallback) so it
  // can read the current imageType without capturing it as a dep.
  const nutritionDataRef = useRef(null);
  const weightResultRef = useRef(null);
  const educationResultRef = useRef(null);
  const watchResultRef = useRef(null);
  const imageTypeRef = useRef(null);

  // Hook into global nutrition refresh context (replaces old nutritionRefreshKey state)
  const {
    refreshKey: nutritionRefreshKey,
    triggerRefresh: triggerNutritionRefresh,
    markCaptureAnalyzing,
    clearCaptureAnalyzing,
  } = useNutritionRefresh();

  // Keep refs in sync with state for resume listener (avoids stale closures)
  useEffect(() => {
    nutritionDataRef.current = nutritionData;
  }, [nutritionData]);
  useEffect(() => {
    educationResultRef.current = educationResult;
  }, [educationResult]);
  useEffect(() => {
    watchResultRef.current = watchResult;
  }, [watchResult]);
  useEffect(() => {
    imageTypeRef.current = imageType;
  }, [imageType]);

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
        `?? [PERF] ???  Precapture (html2canvas) started (+${
          preStart - flowStart
        }ms from capture start)`,
      );
      precaptureShareImage(foodShareCardRef.current).then((dataUrl) => {
        if (!cancelled && dataUrl) {
          foodShareImageDataUrlRef.current = dataUrl;
          foodShareImageReadyAtRef.current = Date.now();
          debugLog(
            `?? [PERF] ???  Precapture ready: ${Date.now() - preStart}ms (+${
              Date.now() - flowStart
            }ms from capture start)`,
          );
        } else if (!cancelled) {
          debugLog(
            `?? [PERF] ???  Precapture FAILED after ${Date.now() - preStart}ms`,
          );
        }
      });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [
    imageType,
    imagePreview,
    savedProfileImage,
    sharePhotoBase64,
    savedUserName,
  ]);

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
  // capture. Does NOT cancel the in-flight Gemini analysis ? that continues
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

  // Reset UI to camera view without interrupting in-flight background analysis.
  // The analysis refs (processedImageRef, foodCaptureIdRef, pendingSharePromiseRef)
  // are deliberately left intact so performNutritionSave can update the DB row
  // after the user is already back at the camera.
  const resetCaptureUiOnly = useCallback(() => {
    setImagePreview(null);
    setSelectedImage(null);
    setImageType(null);
    setNutritionData(null);
    setFoodShareUrl(null);
    setLoading(false);
    foodShareImageDataUrlRef.current = null;
    foodAutoSharedRef.current = false;
    isManualSharingRef.current = false;
    setIsManualSharing(false);
    if (fileInputRef.current?.resetInputs) fileInputRef.current.resetInputs();
    // Note: processedImageRef, foodCaptureIdRef, pendingSharePromiseRef stay
    // set so the background AI analysis can finish and persist to the DB.
  }, []);

  // Tag a pending capture row with the correct image type so it is excluded
  // from the nutrition dashboard (which filters on ImageType='food') but the
  // share link continues to work and routes to the correct dashboard tab.
  // This replaces the previous soft-delete approach for non-food images.
  const updatePendingCaptureType = useCallback(
    (sharePromise, imageType) => {
      sharePromise.then((share) => {
        if (!share?.id || !user?.id) return;
        fetch(`${apiBaseUrl}/api/background-analysis/captures`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: share.id, userId: user.id, imageType }),
        }).catch((err) =>
          debugLog(
            `[Share] updateCaptureType(${imageType}) failed:`,
            err?.message,
          ),
        );
      });
    },
    [user, apiBaseUrl],
  );

  // Auto-open the native share sheet as soon as food is identified ? fires
  // the moment foodShareUrl is set (at fast-classify time), BEFORE the full
  // nutrition analysis finishes. The raw food photo is used directly so
  // there is zero html2canvas wait: the user can share the link+image to
  // WhatsApp while Gemini is still analysing nutrition in the background.
  useEffect(() => {
    // Check user preference for auto-share
    const autoShareEnabled =
      localStorage.getItem("autoShareOnCapture") !== "false";
    if (!autoShareEnabled) return; // Skip auto-share if disabled

    if (imageType !== "food") return;
    if (!foodShareUrl) return;
    if (foodAutoSharedRef.current) return;
    foodAutoSharedRef.current = true;

    let cancelled = false;
    (async () => {
      if (cancelled) return;

      const shareStart = Date.now();
      debugLog(
        `?? [PERF] ?? Auto-share triggered ? sending WhatsApp link-preview card (+${
          shareStart - (captureFlowStartRef.current || shareStart)
        }ms from capture start)`,
      );

      const shareDisplayName = await ensureShareDisplayName(
        savedUserNameRef.current ?? savedUserName,
        user,
        apiBaseUrl,
      );
      if (shareDisplayName && user?.email) {
        cacheProfileUserName(user.email, shareDisplayName);
        setSavedUserName(shareDisplayName);
      }
      const shareText = buildQuickShareText(shareDisplayName, getVersionString());
      const ok = await shareTextViaWhatsApp(shareText);
      if (cancelled) return;

      debugLog(
        `?? [PERF] ?? shareTextViaWhatsApp resolved in ${
          Date.now() - shareStart
        }ms (ok=${ok})`,
      );

      _hasCompletedFirstShareRef.current = true; // enable foreground-resume camera after first share
      if (!ok) {
        // Hard failure n++ reset the guard so a manual retry is possible.
        foodAutoSharedRef.current = false;
      }
      // Keep analysis on screen n++ user returns from WhatsApp and sees the
      // AI results (loading ? complete). Camera WILL auto-reopen on next
      // app resume once _hasCompletedFirstShareRef is true and the user's
      // Auto Camera preference (wv.autoCameraOnResume) is enabled.
    })();

    return () => {
      cancelled = true;
    };
  }, [foodShareUrl, imageType, resetCaptureUiOnly, savedUserName, user]);

  // Duplicate weight detection state

  // Club selection state
  const [showClubSelectionModal, setShowClubSelectionModal] = useState(false);
  const [nearbyCenters, setNearbyCenters] = useState([]);
  const [pendingEducationData, setPendingEducationData] = useState(null);
  const [pendingWeightData, setPendingWeightData] = useState(null);
  const [pendingFoodData, setPendingFoodData] = useState(null);

  // Custom alert modal state
  const [alertModal, setAlertModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    type: "info",
    confirmText: undefined,
    cancelText: undefined,
    onConfirm: undefined,
  });

  // New user profile modal state - show profile page for first-time users
  const [showNewUserProfileModal, setShowNewUserProfileModal] = useState(false);
  const [showProfilePage, setShowProfilePage] = useState(false);
  const [headerProfileKey, setHeaderProfileKey] = useState(0); // incremented after profile save to refresh header avatar

  // Mandatory profile picture modal state - show when user has no valid profile picture
  const [
    showMandatoryProfilePictureModal,
    setShowMandatoryProfilePictureModal,
  ] = useState(false);
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
  // True while checkProfileCompletion() is in flight ? gate must not render during this window.
  const [profileChecking, setProfileChecking] = useState(false);
  // Start hidden ? only checkProfileCompletion() (called after setup is confirmed complete)
  // will turn this on, preventing the gate from flashing for new users going through SetupWizard.
  const [showCompleteProfile, setShowCompleteProfile] = useState(false);

  // User context state - stored and reused for AI personalization
  const [userContext, setUserContext] = useState(null);
  const [userContextLoading, setUserContextLoading] = useState(false);

  // User role state - for role-based access control
  const [userRole, setUserRole] = useState("user");

  // Nutrition centers map state (for all users)
  const [showNutritionCentersMap, setShowNutritionCentersMap] = useState(false);

  // Register nutrition center state (for coaches)
  const [showRegisterCenter, setShowRegisterCenter] = useState(false);
  const [editCenterData, setEditCenterData] = useState(null); // centre to pre-load for editing

  // Setup wizard state
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [showValidateOTP, setShowValidateOTP] = useState(false);

  // Blocks Home / Profile / camera across gaps between onboarding wizards.
  // Stays true until profile → activity → coach → OTP have all finished.
  const onboardingBlocking =
    !!user &&
    isOtpVerified &&
    isUserActive &&
    (
      showCompleteProfile ||
      showPhysicalActivitySetup ||
      showSetupWizard ||
      (showValidateOTP && !isInactiveReactivationFlow) ||
      profileChecking ||
      !physicalActivityResolved ||
      !coachSetupResolved
    );
  const onboardingBlockingRef = useRef(false);
  onboardingBlockingRef.current = onboardingBlocking;

  // Demo account: silent coach-OTP setup is provided by
  // shared/services/auth/demoSetup.js. DEMO_EMAIL and the
  // silentlyCompleteDemoSetup function are imported at the top of this file.
  // -------------------------------------------------------------------------

  // Wellness Counselling state
  const [showWellnessCounselling, setShowWellnessCounselling] = useState(false);
  // Wellness University Enrollment state
  const [showUniversityEnrollment, setShowUniversityEnrollment] = useState(false);
  // Synchronous ref that tracks whether we have pushed an 'enrollment' history
  // entry. Updated synchronously (before startTransition commits) so the guard
  // in onShowWellnessEnrollment is accurate even when rapid taps arrive before
  // the React state update has been committed.
  const enrollmentHistoryPushedRef = useRef(false);

  // Activity Report (Attendance Report) � all roles; Education Attendance selected by default.
  // Activity Time Report � separate hierarchical heatmap view (coach/admin tools).
  const [showActivityReport, setShowActivityReport] = useState(false);
  const [showActivityTimeReport, setShowActivityTimeReport] = useState(false);
  // Testimonials page � member upload + coach verification
  const [showTestimonials, setShowTestimonials] = useState(false);
  // Reports page � coach/upline analytics (downline weight status, etc.)
  const [showReports, setShowReports] = useState(false);
  const [showWellnessScore, setShowWellnessScore] = useState(false);
  const [showWellnessScoreSetup, setShowWellnessScoreSetup] = useState(false);

  // Navigation lock ref: prevents concurrent showDashboardPage() calls from
  // duplicate rapid taps while the async checkUserStatus is in-flight.
  const navLockRef = useRef(false);

  // -- Browser history management ----------------------------------------------
  // Push a new history entry when navigating to a top-level "page". This
  // keeps the browser Back button in sync with the homemade router state.
  // popstate re-calls the relevant show* setters so history.go(-1) works.
  useEffect(() => {
    const handlePopState = (event) => {
      const page = event.state?.wvPage ?? 'main';
      if (page === 'main') {
        // Returning to home from any full-screen route:
        enrollmentHistoryPushedRef.current = false;
        setShowDashboard(false);
        setShowWellnessCounselling(false);
        setShowUniversityEnrollment(false);
        setShowNutritionCentersMap(false);
        setShowTestimonials(false);
        setShowProfilePage(false);
        Session.setCurrentPage('main');
      } else if (page === 'dashboard') {
        startTransition(() => setShowDashboard(true));
        setShowWellnessCounselling(false);
        setShowUniversityEnrollment(false);
        setShowProfilePage(false);
        Session.setCurrentPage('dashboard');
      } else if (page === 'counselling') {
        setShowDashboard(false);
        startTransition(() => setShowWellnessCounselling(true));
        setShowUniversityEnrollment(false);
        Session.setCurrentPage('main');
      } else if (page === 'enrollment') {
        enrollmentHistoryPushedRef.current = true;
        setShowDashboard(false);
        setShowWellnessCounselling(false);
        startTransition(() => setShowUniversityEnrollment(true));
        Session.setCurrentPage('main');
      } else if (page === 'physical-club') {
        startTransition(() => setShowNutritionCentersMap(true));
        Session.setCurrentPage('main');
      } else if (page === 'testimonials') {
        startTransition(() => setShowTestimonials(true));
        Session.setCurrentPage('main');
      } else if (page === 'profile') {
        setShowProfilePage(true);
        Session.setCurrentPage('main');
      }
    };
    window.addEventListener('popstate', handlePopState);
    // Always seed the current history entry to 'main' on mount.
    // React state always initialises from scratch; if the browser preserved a
    // stale wvPage (e.g. 'enrollment') from a previous session or a page
    // reload, we must override it so that history.back() from enrollment
    // always lands on a 'main' entry, never on a ghost enrollment entry.
    window.history.replaceState({ wvPage: 'main' }, '');
    return () => window.removeEventListener('popstate', handlePopState);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only; setters are stable
  }, []);

  // ?? Food Correction Debug Logs State
  const [correctionLogs, setCorrectionLogs] = useState([]);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);

  // ?? Retry state - store last image file for retry capability
  const lastImageFileRef = useRef(null);

  // savePromiseRef: holds the in-flight background-save Promise so that
  // showDashboardPage can await it before opening the Dashboard.
  // Set to the Promise returned by scheduleNutritionSaveInBackground when a
  // food save starts; cleared to null (via .finally) when the save settles.
  // Handles rapid captures: the identity check in the .finally callback ensures
  // only the most-recent save clears the ref.
  const savePromiseRef = useRef(null);

  // -- FORENSIC INSTRUMENTATION ---------------------------------------------
  // captureTraceRef: holds { id, t0, traceId } for the active capture so that
  // every async stage can emit a correlated [CAPTURE-TRACE-<id>] log line.
  // window.__captureTrace is also written for cross-file visibility.
  const captureTraceRef = useRef(null);

  /** Emit one correlated trace log line. Pure debug n++ no side effects. */
  const _ctLog = (stage, label, extra = {}) => {
    const tr = captureTraceRef.current;
    if (!tr) return;
    const now = Date.now();
    const lines = [
      `[CAPTURE-TRACE-${tr.id}] Stage ${String(stage).padStart(2, '0')} | ${label}`,
      `  ts=${now}  (+${now - tr.t0}ms from T0)`,
      `  captureId=${foodCaptureIdRef.current ?? 'null'}`,
      `  traceId=${tr.traceId ?? 'none'}`,
      `  pendingShareRef=${pendingSharePromiseRef.current != null}`,
      `  savePromiseRef=${savePromiseRef.current != null}`,
      `  imageType=${imageType}`,
      `  loading=${loading}`,
      `  saveLoading=${saveLoading}`,
    ];
    Object.entries(extra).forEach(([k, v]) => lines.push(`  ${k}=${JSON.stringify(v)}`));
    console.log(lines.join('\n'));
    // Write last-known state to global so useDayAnalyses / NutritionDashboard can emit correlated logs.
    window.__captureTrace = {
      id: tr.id, t0: tr.t0, traceId: tr.traceId, lastStage: stage,
      captureId: foodCaptureIdRef.current,
      pendingShareRef: pendingSharePromiseRef.current != null,
      savePromiseRef: savePromiseRef.current != null,
    };
  };
  // -------------------------------------------------------------------------

  // Ref for leaderboards to trigger manual refresh
  const leaderboardRef = useRef(null);
  const wellnessLeaderboardRef = useRef(null);

  // Help instructions visibility state
  const [showHowToUse, setShowHowToUse] = useState(false);

  // -------------------------------------------------------------------------
  // NATIVE CAMERA LAUNCH FLOW (event-driven, no time-based guards)
  //
  // Lifecycle this code orchestrates:
  //   splash ? launch overlay ? camera UI ? photo ? share ? home
  //
  // Three discrete events drive every state transition:
  //   1. CAMERA_CONDITIONS_MET n++ user, permissionsReady, isUserActive, and
  //      ImageUpload mounted (fileInputRef.current.openCamera defined).
  //   2. CAMERA_OPENED n++ ImageUpload fires onCameraStateChange('opened') the
  //      instant Camera.getPhoto is invoked ? native camera UI takes the
  //      screen. THIS is when we dismiss the launch overlay (zero flash).
  //   3. CAMERA_CLOSED n++ onCameraStateChange('closed', {hadResult}) fires
  //      when the user takes a photo OR cancels. We use this to suppress the
  //      false-positive appStateChange that always follows.
  //
  // Cancel-loop fix: when the camera is on screen the OS sends
  // appStateChange({isActive:false}) ? user cancels ? appStateChange({isActive:true}).
  // The resume listener used to interpret that "isActive:true" as a fresh
  // wake-up and re-open the camera. Now the resume listener checks
  // fileInputRef.current?.isCameraActive() AND a one-shot
  // _justClosedCameraRef flag set in onCameraStateChange('closed'), so it
  // correctly ignores its own camera-driven state transitions.
  // -------------------------------------------------------------------------
  // Ref that always reflects whether the home screen is currently visible.
  // Used by the app-resume listener to avoid stale closure over state.
  // NOTE: excludes showCompleteProfile n++ the profile gate overlays the home
  // screen, so auto-camera-open must not fire while it is visible.
  // Updated: removed imagePreview/selectedImage checks to allow camera open
  // even when returning to app during/after analysis (user expectation).
  const _homeScreenActiveRef = useRef(false);
  useEffect(() => {
    _homeScreenActiveRef.current =
      !!user &&
      !authLoading &&
      !onboardingBlocking &&
      !showDashboard &&
      !showActivityReport &&
      !showActivityTimeReport;
  }, [
    user,
    authLoading,
    onboardingBlocking,
    showDashboard,
    showActivityReport,
    showActivityTimeReport,
  ]);

  const _userIdRef = useRef(null);  // mirrors user?.id

  // Keep userId ref in sync so mount-only resume listeners read live values.
  useEffect(() => {
    _userIdRef.current = user?.id || user?.UserId || Session.getDbUserId() || null;
  }, [user]);

  // Phone users without email: open unified profile immediately (before coach).
  useEffect(() => {
    if (!user) return;
    if (!isOtpVerified) return;
    const email = (user.email && user.email.trim()) || Session.getUserEmail();
    if (!email) {
      setShowCompleteProfile(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: fire on user/auth change
  }, [user?.id, user?.email, isOtpVerified]);

  // Never leave My Profile / other sub-pages open while onboarding is in progress.
  useEffect(() => {
    if (!onboardingBlocking) return;
    setShowProfilePage(false);
    setShowDashboard(false);
    setShowNewUserProfileModal(false);
  }, [onboardingBlocking]);

  // Physical activity gate: immediately after unified profile, before coach/OTP/camera.
  useEffect(() => {
    if (!user || !isOtpVerified) {
      setPhysicalActivityResolved(false);
      return undefined;
    }
    if (showCompleteProfile || profileChecking) {
      setPhysicalActivityResolved(false);
      setShowPhysicalActivitySetup(false);
      return undefined;
    }
    const email = (user.email && user.email.trim()) || Session.getUserEmail();
    if (!email) {
      setPhysicalActivityResolved(false);
      return undefined;
    }

    let cancelled = false;
    setPhysicalActivityResolved(false);
    (async () => {
      try {
        const { data } = await fetchProfile(email);
        if (cancelled) return;
        if (data && !data.physicalActivityLevel) {
          setShowPhysicalActivitySetup(true);
        } else {
          setShowPhysicalActivitySetup(false);
        }
      } catch {
        // Fail closed for new onboarding: ask for activity rather than skipping to coach/camera.
        if (!cancelled) setShowPhysicalActivitySetup(true);
      } finally {
        if (!cancelled) setPhysicalActivityResolved(true);
      }
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: after profile gate
  }, [user?.id, user?.email, isOtpVerified, showCompleteProfile, profileChecking]);

  // Tracks whether CompleteProfilePage is currently mounted. Used by the
  // foreground-resume listener below to skip checkProfileCompletion while
  // the user is actively filling out the form. Without this guard, returning
  // from camera/gallery fires checkProfileCompletion ? profileChecking=true
  // ? LoadingSpinner replaces the page ? form unmounts ? all input is lost.
  const _profileGateActiveRef = useRef(false);
  useEffect(() => {
    _profileGateActiveRef.current = showCompleteProfile;
  }, [showCompleteProfile]);

  // Tracks whether user has completed their first share (any image type).
  // Foreground-resume camera auto-open is DISABLED until this is true,
  // matching Snapchat: camera opens once on launch, but if you close it
  // without sharing, you stay on the feed.
  const _hasCompletedFirstShareRef = useRef(false);

  // True while the native Camera.getPhoto dialog is on screen. Set by
  // onCameraStateChange. Used by the resume listener to ignore the
  // appStateChange flap that always accompanies a camera open/close cycle.
  const _cameraInFlightRef = useRef(false);

  // One-shot flag: set true on CAMERA_CLOSED, cleared after the next
  // appStateChange({isActive:true}) event is consumed. Belt-and-braces
  // alongside _cameraInFlightRef because the OS sometimes fires isActive:true
  // a few ms AFTER the camera promise resolves and we have already cleared
  // _cameraInFlightRef.
  const _justClosedCameraRef = useRef(false);

  // True once the login-camera path has fired openCamera() in this session,
  // so the login-camera effect never fires twice.
  const _hasFiredCameraOnLoginRef = useRef(false);

  // Deep-link guard: once a /share URL opens the app, suppress automatic
  // camera opening for this session so shared-card routing wins deterministically.
  const _suppressAutoCameraOnDeepLinkRef = useRef(false);

  // Early app-link events can arrive before the full deep-link resolver effect
  // is mounted (it waits for user/apiBaseUrl). Buffer the URL so it can be
  // replayed once the resolver is ready.
  const _pendingDeepLinkUrlRef = useRef(null);

  // Callback passed to <ImageUpload onCameraStateChange={...}>. This is the
  // SINGLE source of truth for "the native camera UI is on/off the screen".
  const handleCameraStateChange = useCallback((state /*, meta */) => {
    if (state === "opened") {
      _cameraInFlightRef.current = true;
      _justClosedCameraRef.current = false;
      // DO NOT dismiss the launch overlay here.
      //
      // 'opened' fires synchronously, BEFORE Camera.getPhoto has had a chance
      // to display the native camera dialog. Calling setShowLaunchOverlay(false)
      // here causes a React re-render that briefly shows the home screen in the
      // gap between the overlay disappearing and the native camera appearing
      // ? visible as a 1-3 frame "home screen flash" on every cold start.
      //
      // The native camera dialog is rendered above the WebView layer anyway,
      // so the overlay is invisible while the camera is open n++ keeping it
      // mounted costs nothing. It is dismissed on 'closed' (below) so the
      // home screen only ever appears AFTER the camera has already gone.
    } else if (state === "closed") {
      _cameraInFlightRef.current = false;
      _justClosedCameraRef.current = true;
      // Camera is gone n++ now it is safe to reveal the home screen.
      setShowLaunchOverlay(false);
    }
  }, []);

  // App resume listener: opens camera on foreground resume. Guards prevent
  // cancel loops and enforce product rules:
  //  - _cameraInFlightRef: skip if native camera is currently open
  //  - _justClosedCameraRef: skip if camera just closed (cancel)
  //  - _launchUrlCheckedRef: skip if share-link check still pending
  //  - _homeScreenActiveRef: skip if not on home screen
  //  - _hasCompletedFirstShareRef: skip until user completes their first share
  //     (Snapchat rule: camera opens once on launch; close without sharing ? stay on feed)
  //  - _suppressAutoCameraOnDeepLinkRef: skip when app launched via /share deep link
  //  - wv.autoCameraOnResume: user-controlled localStorage preference
  //     (Header menu ? Auto Camera toggle; default ON)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let handle = null;
    let cancelled = false;

    nativeLifecycle
      .addAppStateListener(({ isActive }) => {
        if (!isActive || cancelled) return;

        // Guard 1: skip if native camera is already open
        if (_cameraInFlightRef.current) return;
        // Guard 2: skip if camera just closed (prevents cancel ? resume ? re-open loop)
        if (_justClosedCameraRef.current) {
          _justClosedCameraRef.current = false;
          return;
        }
        // Guard 3: skip until share-link cold-start check has resolved
        if (!_launchUrlCheckedRef.current) return;
        // Guard 4: skip unless home screen is the active surface
        if (!_homeScreenActiveRef.current) return;
        // Guard 5: skip if ImageUpload is not yet mounted
        if (!fileInputRef.current?.openCamera) return;
        // Guard 6: skip for the entire session when launched via /share deep link
        if (_suppressAutoCameraOnDeepLinkRef.current) return;
        // Guard 7: skip until user has completed their first share
        //   Matches Snapchat behaviour: camera opens once on launch; if closed
        //   without sharing, the user stays on the feed until they actively share.
        if (!_hasCompletedFirstShareRef.current) return;
        // Guard 8: respect user preference (Header ? Auto Camera toggle)
        if (localStorage.getItem('wv.autoCameraOnResume') === 'false') return;
        // Guard 9: skip if analysis results are currently visible
        if (
          nutritionDataRef.current ||
          weightResultRef.current ||
          educationResultRef.current ||
          watchResultRef.current
        ) {
          debugLog(
            "?? [Resume] Skipping camera auto-open: analysis results visible",
          );
          return;
        }

        // All guards passed n++ open camera
        debugLog("?? [Resume] Opening camera after app resume");
        fileInputRef.current.openCamera();
      })
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- intentionally mount-only

  // --- SHARE-LINK COLD-START GUARD ----------------------------------------
  // Root cause: `permissionsReady` and `isUserActive` start as `true` for
  // returning users (from localStorage). As soon as Firebase restores `user`
  // from cache the camera effect fires its RAF n++ well before our previous
  // async `getLaunchUrl().then(...)` could set the flag.
  //
  // Fix: two-part guarantee:
  //  A. `_launchUrlCheckedRef` n++ the camera RAF will NOT fire openCamera until
  //     this is `true`. It is set true as soon as getLaunchUrl() resolves OR
  //     after 150ms (timeout fallback so a hung bridge never blocks forever).
  //  B. An early `appUrlOpen` listener n++ belt-and-suspenders for devices where
  //     getLaunchUrl() returns null even on a share-link cold start (known
  //     Capacitor/Android App Links issue on some OEM ROMs).
  const _launchUrlCheckedRef = useRef(!Capacitor.isNativePlatform()); // web = already done
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const isShareUrl = (url) => {
      if (!url || typeof url !== "string") return false;
      // Accept both legacy UUID links and new short-code links.
      return /(?:^wellnessvalley:\/\/share\/)|(?:\/share(?:\/|$))/i.test(url);
    };

    // Part B n++ early appUrlOpen listener. Fires on cold starts where the OS
    // delivers the intent URL via the event bridge rather than getLaunchUrl().
    let earlyHandle = null;
    nativeLifecycle
      .addAppUrlOpenListener((event) => {
        if (isShareUrl(event?.url)) {
          _hasFiredCameraOnLoginRef.current = true;
          _suppressAutoCameraOnDeepLinkRef.current = true;
          _pendingDeepLinkUrlRef.current = event?.url || null;
        }
        _launchUrlCheckedRef.current = true;
      })
      .then((h) => {
        earlyHandle = h;
      })
      .catch(() => {});

    // Part A n++ timeout ensures the camera is never blocked forever.
    const fallbackTimer = setTimeout(() => {
      _launchUrlCheckedRef.current = true;
    }, 150);

    // getLaunchUrl() is the primary check for cold-start intent URLs.
    nativeLifecycle
      .getLaunchUrl()
      .then((url) => {
        clearTimeout(fallbackTimer);
        if (isShareUrl(url)) {
          _hasFiredCameraOnLoginRef.current = true;
          _suppressAutoCameraOnDeepLinkRef.current = true;
          _pendingDeepLinkUrlRef.current = url;
        }
        _launchUrlCheckedRef.current = true;
      })
      .catch(() => {
        clearTimeout(fallbackTimer);
        _launchUrlCheckedRef.current = true;
      });

    return () => {
      clearTimeout(fallbackTimer);
      earlyHandle?.remove?.();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- intentionally mount-only

  // Auto-open camera once per session when the user first arrives at the
  // home screen on a native device. Conditions:
  //   1. user authenticated AND active
  //   2. permissionsReady (camera + push + geolocation dialogs resolved)
  //   3. ImageUpload mounted (fileInputRef.current.openCamera defined)
  // We poll fileInputRef on every render via a microtask-style retry loop,
  // re-running whenever any input dep changes. Cancellation is handled by
  // the cleanup function so a stale closure can never fire openCamera.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (!user || !permissionsReady || !isUserActive) return;
    if (_hasFiredCameraOnLoginRef.current) return;
    if (_suppressAutoCameraOnDeepLinkRef.current) return;
    // Wait until onboarding is fully done:
    // profile → physical activity → coach selection → coach OTP → then camera.
    if (onboardingBlocking) return;

    let cancelled = false;
    const tryOpen = () => {
      if (cancelled || _hasFiredCameraOnLoginRef.current) return;
      // Wait until the launch-URL check has completed (prevents opening the
      // camera on share-link cold starts where getLaunchUrl() or appUrlOpen
      // hasn't resolved yet). Re-queues the RAF n++ adds at most ~16ms per
      // frame and resolves within 150ms worst case.
      if (!_launchUrlCheckedRef.current) {
        requestAnimationFrame(tryOpen);
        return;
      }
      const api = fileInputRef.current;
      if (api?.openCamera) {
        _hasFiredCameraOnLoginRef.current = true;
        api.openCamera(); // handleCameraStateChange('opened') will dismiss the overlay
        return;
      }
      // ImageUpload not yet mounted n++ try again next animation frame.
      // No upper bound: this effect's deps will re-run when conditions change.
      requestAnimationFrame(tryOpen);
    };
    requestAnimationFrame(tryOpen);
    return () => {
      cancelled = true;
    };
  }, [
    user,
    permissionsReady,
    isUserActive,
    onboardingBlocking,
    _launchUrlCheckedRef,
  ]);

  // Dismiss launch overlay on non-camera paths (signed out, fresh-sign-in
  // setup wizard, profile-completion gate). The camera path dismisses the
  // overlay via handleCameraStateChange('opened').
  useEffect(() => {
    if (!showLaunchOverlay) return;
    if (!Capacitor.isNativePlatform()) {
      setShowLaunchOverlay(false);
      return;
    }
    if (authLoading) return; // still settling n++ wait
    if (!user) {
      setShowLaunchOverlay(false);
      return;
    } // signed out
    if (onboardingBlocking) {
      setShowLaunchOverlay(false);
      return;
    } // onboarding bridge / wizards
    if (!isUserActive) {
      setShowLaunchOverlay(false);
      return;
    } // inactive account
    const freshSignIn = sessionStorage.getItem("freshGoogleSignIn") === "true";
    if (freshSignIn) {
      setShowLaunchOverlay(false);
      return;
    } // setup wizard
  }, [
    showLaunchOverlay,
    authLoading,
    user,
    onboardingBlocking,
    isUserActive,
  ]);

  // Deep-link handler: open the app via Android App Link
  // (https://<host>/share/<id>) or the custom scheme
  // (wellnessvalley://share/<id>) ? resolve the share identifier against the
  // backend, then jump straight to Dashboard ? Nutrition for that owner /
  // date. Permission errors and missing/expired shares surface as toasts.
  useEffect(() => {
    if (!user || !apiBaseUrl) return;

    let cancelled = false;
    let handle = null;
    const seenTokens = new Set(); // guard against duplicate fires

    const SHARE_ID_RE =
      "([A-Za-z0-9]{6,10}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})";
    const SHARE_PATH_RE = new RegExp(`/share/${SHARE_ID_RE}(?:[/?#]|$)`, "i");

    const extractToken = (rawUrl) => {
      if (!rawUrl || typeof rawUrl !== "string") return null;
      // Custom scheme: wellnessvalley://share/<id>
      const customMatch = rawUrl.match(
        new RegExp(`^wellnessvalley://share/${SHARE_ID_RE}(?:[/?#]|$)`, "i"),
      );
      if (customMatch) return customMatch[1];
      // https path: /share/<id>
      const httpsMatch = rawUrl.match(SHARE_PATH_RE);
      return httpsMatch ? httpsMatch[1] : null;
    };

    const handleUrl = async (rawUrl) => {
      const token = extractToken(rawUrl);
      if (!token || seenTokens.has(token)) return;
      _suppressAutoCameraOnDeepLinkRef.current = true;
      seenTokens.add(token);

      try {
        const resp = await fetch(
          `${apiBaseUrl}/api/background-analysis/captures/resolve?token=${encodeURIComponent(
            token,
          )}&viewerUserId=${encodeURIComponent(user.id)}`,
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

        // Open the Dashboard (Diary) and seed the owner / date / tab context.
        // Used for EVERY resolved capture n++ food, weight, education,
        // smartwatch, unknown, and pending n++ so a deep link ALWAYS lands on
        // the diary with the relevant card instead of the home screen.
        const applyDashboardContext = (d, { seedMealId = true } = {}) => {
          if (d.isSelf) {
            setDashboardInitialSelectedMember(null);
          } else {
            // Shape MUST match team/services/teamSearchService.toSelectedUser n++
            // hooks like resolveDashboardUserId read `id` (not `userId`).
            const memberName = d.ownerUserName || "Member";
            setDashboardInitialSelectedMember({
              id: d.ownerUserId,
              userId: d.ownerUserId,
              name: memberName,
              userName: memberName,
              email: "",
              role: "user",
              isSelf: false,
            });
          }
          setDashboardInitialDate(d.mealDate || null);
          // While `pending`, no domain row exists yet n++ resolve returns the
          // captureId as a placeholder that no feed can match. Seed null so the
          // per-feed deep-link opener doesn't latch onto a bogus id; the real
          // id is seeded once the capture is classified (see pollPending).
          setDashboardInitialMealId(seedMealId ? d.mealId || null : null);
          // Route to the tab that matches the shared image type. When the
          // single-page Diary flag is ON the tab is cosmetic (all feeds render
          // stacked); when OFF it selects the correct legacy tab.
          setDashboardInitialTab(tabForImageType(d.imageType));
          startTransition(() => setShowDashboard(true));
        };

        // `pending` = capture row exists but AI classification has not finished.
        // Legacy rows with no ImageType are treated as already-terminal ('food').
        const isPending = data.imageType === "pending";

        // Open the diary immediately. While pending the feeds show their own
        // loading / empty state; the correct card appears once classified.
        applyDashboardContext(data, { seedMealId: !isPending });

        // PR-E / ADR-0003: an `unknown` capture also opens the dedicated image
        // viewer (Retry / Edit) on top of the diary. Gated on ff.diary-feed so
        // legacy behaviour is preserved while the flag is OFF.
        if (data.imageType === "unknown" && isFlagEnabled("ff.diary-feed")) {
          try {
            const share = await fetchUnknownShare({
              token,
              viewerUserId: user.id,
            });
            if (cancelled) return;
            setUnknownShareView({
              open: true,
              captureId: share.captureId,
              imageBase64: share.imageBase64,
              createdAt: share.createdAt ?? null,
              canMutate: !!share.canMutate,
              retrying: false,
              error: null,
            });
          } catch (e) {
            if (!cancelled)
              showToast("This shared photo is no longer available");
          }
          return;
        }

        // Pending capture: poll the resolve endpoint until the capture is
        // classified, then re-route to the exact card and refresh the feeds so
        // it appears WITHOUT the user reloading the page.
        if (isPending) {
          let attempts = 0;
          const MAX_ATTEMPTS = 15; // ~37s at 2.5s spacing
          const INTERVAL_MS = 2500;
          const pollPending = async () => {
            if (cancelled) return;
            attempts += 1;
            try {
              const pr = await fetch(
                `${apiBaseUrl}/api/background-analysis/captures/resolve?token=${encodeURIComponent(
                  token,
                )}&viewerUserId=${encodeURIComponent(user.id)}`,
                {
                  method: "GET",
                  headers: { "Content-Type": "application/json" },
                },
              );
              const pb = await pr.json().catch(() => ({}));
              if (cancelled) return;
              const pd = pb?.data;
              if (
                pr.ok &&
                pb?.ok &&
                pd &&
                pd.imageType &&
                pd.imageType !== "pending"
              ) {
                // Classified n++ route to the real card and refresh the feeds.
                applyDashboardContext(pd);
                triggerNutritionRefresh({
                  immediate: true,
                  source: "deep-link-pending",
                });
                return;
              }
            } catch {
              // Transient network error n++ keep polling until the cap is hit.
            }
            if (!cancelled && attempts < MAX_ATTEMPTS) {
              setTimeout(pollPending, INTERVAL_MS);
            }
          };
          setTimeout(pollPending, INTERVAL_MS);
        }
      } catch (err) {
        if (!cancelled) showToast("Could not open shared meal");
      }
    };

    // Register listener for foreground deep-links
    nativeLifecycle
      .addAppUrlOpenListener((event) => {
        if (event?.url) _pendingDeepLinkUrlRef.current = event.url;
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

    // Replay any share URL captured by the early cold-start guard.
    const pendingUrl = _pendingDeepLinkUrlRef.current;
    if (!cancelled && pendingUrl) {
      _pendingDeepLinkUrlRef.current = null;
      handleUrl(pendingUrl);
    }

    return () => {
      cancelled = true;
      handle?.remove?.();
    };
  }, [user, apiBaseUrl]);

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
  // clearBgCache(); // ensure it won?t repaint on refresh
  // } catch {}
  // };

  // --------------------------------------------------------------------

  // Toast state for back button exit message
  const [toast, setToast] = useState({ message: "", visible: false });

  // Show toast message
  const showToast = (message) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast({ message: "", visible: false }), 2000);
  };

  // ?? Keyboard shortcut for closing correction modal (ESC key on web)
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

  // ? CRITICAL FIX: Force splash screen dismissal on app load

  // ? Auth loading timeout ? force dismiss loading screen after 5 seconds
  useEffect(() => {
    const authTimeout = setTimeout(() => {
      setAuthLoading(false);
    }, 5000);
    return () => clearTimeout(authTimeout);
  }, []);

  // ? NATIVE LIFECYCLE PHASE (May 2026): SplashScreen dismissal delegated to
  // shared/services/nativeLifecycle. Timing (500ms), error-swallowing, and
  // native-only gating are preserved exactly inside the service.
  useEffect(() => nativeLifecycle.scheduleSplashHide(500), []);

  // Restore showDashboard from localStorage using startTransition � avoids suspending lazy <Dashboard> on mount.
  // Also push a history entry so the browser back button can return to Home
  // from a cold-start-restored Dashboard (without this the forward button is
  // immediately disabled and no popstate fires on the first back press).
  useEffect(() => {
    const page = Session.getCurrentPage();
    if (
      page === "dashboard" ||
      page === "nutrition-dashboard" ||
      page === "weight-tracking" ||
      page === "weight-insights"
    ) {
      startTransition(() => setShowDashboard(true));
      // The popstate effect's replaceState('main') runs first (declared earlier),
      // so history is [main] at this point. Push 'dashboard' on top so the
      // browser back button pops to 'main' and fires the popstate handler.
      window.history.pushState({ wvPage: 'dashboard' }, '');
    }
  }, []);

  // Initialize back button handler
  useEffect(() => {
    const goBack = () => {
      if (showDashboard) {
        // showMainPage is now a stable useCallback([]) reference, so this
        // closure always calls the current version without stale captures.
        showMainPage();
        return true;
      }
      if (showWellnessCounselling) {
        setShowWellnessCounselling(false);
        // Pop the history entry pushed when counselling was opened instead
        // of pushing a new 'main' entry (which would bloat history).
        const currentWvPage = window.history.state?.wvPage;
        if (currentWvPage && currentWvPage !== 'main') window.history.back();
        return true;
      }
      if (showUniversityEnrollment) {
        enrollmentHistoryPushedRef.current = false;
        setShowUniversityEnrollment(false);
        // Use replaceState instead of history.back() so no popstate fires.
        // history.back() would trigger the handlePopState 'enrollment' branch
        // which calls startTransition(setShowUniversityEnrollment(true)) and
        // fights the urgent false update, leaving enrollment re-opened.
        window.history.replaceState({ wvPage: 'main' }, '');
        return true;
      }
      if (showNutritionCentersMap) {
        setShowNutritionCentersMap(false);
        const currentWvPage = window.history.state?.wvPage;
        if (currentWvPage && currentWvPage !== 'main') window.history.back();
        return true;
      }
      if (showActivityReport) {
        setShowActivityReport(false);
        const currentWvPage = window.history.state?.wvPage;
        if (currentWvPage && currentWvPage !== 'main') window.history.back();
        return true;
      }
      if (showActivityTimeReport) {
        setShowActivityTimeReport(false);
        const currentWvPage = window.history.state?.wvPage;
        if (currentWvPage && currentWvPage !== 'main') window.history.back();
        return true;
      }
      if (showReports) {
        setShowReports(false);
        const currentWvPage = window.history.state?.wvPage;
        if (currentWvPage && currentWvPage !== 'main') window.history.back();
        return true;
      }
      if (showWellnessScoreSetup) {
        setShowWellnessScoreSetup(false);
        const currentWvPage = window.history.state?.wvPage;
        if (currentWvPage && currentWvPage !== 'main') window.history.back();
        return true;
      }
      if (showWellnessScore) {
        setShowWellnessScore(false);
        const currentWvPage = window.history.state?.wvPage;
        if (currentWvPage && currentWvPage !== 'main') window.history.back();
        return true;
      }
      if (showProfilePage) {
        setShowProfilePage(false);
        const currentWvPage = window.history.state?.wvPage;
        if (currentWvPage && currentWvPage !== 'main') window.history.back();
        return true;
      }
      return false; // all navigation cases handled above; no Ionic router fallback needed
    };

    initializeBackButton(
      goBack,
      showToast,
      !showDashboard && !showWellnessCounselling && !showUniversityEnrollment && !showNutritionCentersMap && !showActivityReport && !showActivityTimeReport && !showTestimonials && !showReports && !showWellnessScoreSetup && !showWellnessScore && !showProfilePage,
    );
    return () => cleanupBackButton();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- showMainPage is useCallback([]) stable; listing it here causes a TDZ crash because it is declared after this effect
  }, [
    showDashboard,
    showWellnessCounselling,
    showUniversityEnrollment,
    showNutritionCentersMap,
    showActivityReport,
    showActivityTimeReport,
    showTestimonials,
    showReports,
    showWellnessScoreSetup,
    showWellnessScore,
    showProfilePage,
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
  // Disabled by default ? enable via `localStorage.setItem('authFsm.shadow', 'true')`
  // or REACT_APP_AUTH_FSM_SHADOW=true. Kill switch overrides everything.
  const authFsmLegacyRef = useRef({});
  const authFsmStartedRef = useRef(false);

  // Check user status (Active/Inactive) using lookup-user-id API
  const checkUserStatus = useCallback(
    async (user, skipInactiveModal = false) => {
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
        // Fail-open semantics preserved by the helper (network errors ? 'active').
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
          // ? New user ? SetupWizard will handle profile collection, no popup needed
          setShowUserNotFoundModal(false);
          setIsUserActive(true);
          if (role) setUserRole(role);
          return true;
        }

        if (result === "inactive") {
          // Skip showing modal if we're in the middle of coach OTP flow
          if (!skipInactiveModal) {
            setShowInactiveModal(true);
          }
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
    if (wellnessLeaderboardRef.current) {
      wellnessLeaderboardRef.current.refresh();
    }
  }, []);

  const showDashboardPage = useCallback(
    (preferredTab = null) => {
      // Guard: prevent duplicate concurrent navigation calls.
      if (navLockRef.current) return;
      navLockRef.current = true;
      try {
      // Fire status check in the background � do NOT await it.
      // Awaiting blocked the Diary nav for ~200-500 ms on every tap, and
      // held navLockRef=true during that window so rapid taps were silently
      // dropped. If the account has become inactive the periodic 60-second
      // check (or the auth-state-change IIFE) will surface the modal shortly;
      // we don't need to gate navigation on it here.
      if (user) {
        checkUserStatus(user).then((isActive) => {
          if (!isActive) {
            // Account became inactive while dashboard was opening � close it.
            setShowDashboard(false);
          }
        }).catch(() => {/* fail-open */});
      }

      // Clear transient capture/analysis state when switching to dashboard.
      // All setters are unconditional � setState(null) when already null is
      // a no-op in React (Object.is bail-out), so no extra render fires.
      // This also removes nutritionData/imagePreview/etc. from the dep array
      // below, preventing showDashboardPage from being recreated (and the
      // gallery-monitoring effect from re-initialising) on every AI result.
      setNutritionData(null);
      setImagePreview(null);
      setWatchResult(null);
      setEducationResult(null);
      clearWeightState();
      setSelectedImage(null);
      setImageType(null);

      // Stage 16 (final) � Dashboard about to open.
      // Any in-flight food save (savePromiseRef) continues in the background;
      // performNutritionSave calls triggerNutritionRefresh after the DB write
      // so the Dashboard refreshes automatically once the data is committed.
      // Awaiting here caused the Diary nav to appear frozen for up to ~10 s
      // (GPS timeout 5 s + DB write) when the user tapped Diary right after
      // taking a photo.
      _ctLog(16, 'showDashboardPage � setShowDashboard(true) about to fire', {
        hadPendingSave: !!savePromiseRef.current,
        preferredTab,
      });

      // Use explicitly requested tab when provided (e.g., profile menu shortcuts).
      // Never infer from imageTypeRef: after food/weight/education analysis the
      // imageType ref still holds the last classification, which would force the
      // Nutrition/Weight/Education tab even when the user explicitly taps Diary.
      // Always defer to null so the Dashboard restores the last-used tab from
      // localStorage � that is the correct behaviour for an explicit navigation.
      if (
        preferredTab === "weight" ||
        preferredTab === "nutrition" ||
        preferredTab === "education" ||
        preferredTab === "diary"
      ) {
        setDashboardInitialTab(preferredTab);
      } else {
        setDashboardInitialTab(null); // Defer to last-used tab (localStorage)
      }
      // Urgent update � navigation flags are now used directly (no useDeferredValue),\n      // so this is an immediate render with no deferral possible.
      setShowDashboard(true);
      Session.setCurrentPage("dashboard");
      // Push a browser history entry so the native back button can return to home.
      window.history.pushState({ wvPage: 'dashboard' }, '');
      } finally {
        navLockRef.current = false;
      }
    },
    // Only stable values in deps: user identity and its status checker.
    // Transient capture state (nutritionData, imagePreview, weightResult, etc.)
    // is now cleared unconditionally and read via refs, so it is NOT a dep.
    // This keeps showDashboardPage stable across AI analysis cycles and
    // prevents the gallery-monitoring effect from re-initialising on every result.
    [user, checkUserStatus],
  );

  // showMainPage is stable across renders (useCallback with no deps) because
  // all state reads inside it use the functional-updater or ref form, and
  // all state setters are stable references from useState/useRef. Wrapping
  // in useCallback prevents Dashboard from receiving a new onBack prop on
  // every render and avoids stale-closure in the Android back-button effect.
  const showMainPage = useCallback(() => {
    setShowDashboard(false);
    setDashboardInitialTab(null); // Clear initial tab when going back
    setDashboardInitialSelectedMember(null); // Clear deep-link member context
    setDashboardInitialDate(null); // Clear deep-link date context
    setDashboardInitialMealId(null); // Clear deep-link meal ID

    // Clear weight result, education result, and images when going back to main page
    clearWeightState();
    setEducationResult(null);
    setWatchResult(null);
    setNutritionData(null);
    setImagePreview(null);
    setSelectedImage(null);
    setImageType(null);
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
    // Pop the history entry that was pushed when the user navigated TO this
    // page. Using history.back() instead of pushState({wvPage:'main'}) is
    // critical: pushState would ADD a new 'main' entry on every back
    // navigation, causing the browser back button to drill through N
    // previously-visited pages instead of leaving the app.
    // Guard: only pop if the current entry is a tracked page (not already
    // at 'main' or an unknown external entry).
    const currentWvPage = window.history.state?.wvPage;
    if (currentWvPage && currentWvPage !== 'main') {
      window.history.back();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- all setters are stable; refs are not reactive
  }, []);

  // -- Cross-tab navigation helper -------------------------------------------
  // Used by the persistent 5-tab nav bar rendered on every full-page view
  // (Diary, Counselling, Enrollment, Physical Club). Handles:
  //   � first open from Home  ? pushState (adds an entry)
  //   � tab switch from another sub-page ? replaceState (keeps back ? Home clean)
  //   � go Home from sub-page ? history.back() (pops the sub-page entry)
  const navigateTo = useCallback((targetPage) => {
    // Onboarding owns the screen — do not open Profile / Diary / etc mid-wizard.
    if (onboardingBlockingRef.current && targetPage !== 'home') {
      return;
    }

    const currentWvPage = window.history.state?.wvPage;
    const isOnSubPage = currentWvPage && currentWvPage !== 'main';

    if (targetPage === 'home') {
      // Close every sub-page and pop the current history entry.
      setShowDashboard(false);
      setShowWellnessCounselling(false);
      setShowUniversityEnrollment(false);
      setShowNutritionCentersMap(false);
      setShowActivityReport(false);
      setShowActivityTimeReport(false);
      setShowTestimonials(false);
      setShowReports(false);
      setShowWellnessScoreSetup(false);
      setShowWellnessScore(false);
      setShowProfilePage(false);
      enrollmentHistoryPushedRef.current = false;
      Session.setCurrentPage('main');
      if (isOnSubPage) window.history.back();
      return;
    }

    if (targetPage === 'dashboard') {
      // Clear any pending AI error / photo preview so they don't linger
      // when the user switches to the Diary tab, causing layout glitches.
      setError(null);
      setImagePreview(null);
      lastImageFileRef.current = null;
      if (isOnSubPage) {
        // Close current sub-page; replace history so back still ? Home.
        setShowWellnessCounselling(false);
        setShowUniversityEnrollment(false);
        setShowNutritionCentersMap(false);
        setShowActivityReport(false);
        setShowActivityTimeReport(false);
        setShowTestimonials(false);
        setShowReports(false);
        setShowWellnessScoreSetup(false);
        setShowWellnessScore(false);
        setShowProfilePage(false);
        enrollmentHistoryPushedRef.current = false;
        window.history.replaceState({ wvPage: 'dashboard' }, '');
        Session.setCurrentPage('dashboard');
        setShowDashboard(true); // urgent � same reason as showDashboardPage
      } else {
        showDashboardPage();
      }
      return;
    }

    // For counselling / enrollment / physical-club / activity-report:
    // � Clear ALL current sub-pages.
    // � Replace history when switching tabs; push when opening from Home.
    setShowDashboard(false);
    setShowWellnessCounselling(false);
    setShowUniversityEnrollment(false);
    setShowNutritionCentersMap(false);
    setShowActivityReport(false);
    setShowActivityTimeReport(false);
    setShowTestimonials(false);
    setShowReports(false);
    setShowWellnessScoreSetup(false);
    setShowWellnessScore(false);
    setShowProfilePage(false);
    enrollmentHistoryPushedRef.current = false;

    if (isOnSubPage) {
      window.history.replaceState({ wvPage: targetPage }, '');
    } else {
      window.history.pushState({ wvPage: targetPage }, '');
    }

    switch (targetPage) {
      case 'counselling':
        setShowWellnessCounselling(true);
        break;
      case 'enrollment':
        enrollmentHistoryPushedRef.current = true;
        setShowUniversityEnrollment(true);
        break;
      case 'physical-club':
        setShowNutritionCentersMap(true);
        break;
      case 'activity-report':
        // Merged Attendance Report (ActivityReport): education attendance default tab.
        setShowActivityReport(true);
        break;
      case 'activity-time-report':
        setShowActivityTimeReport(true);
        break;
      case 'testimonials':
        setShowTestimonials(true);
        break;
      case 'reports':
        setShowReports(true);
        break;
      case 'profile':
        setShowProfilePage(true);
        break;
      case 'wellness-score':
        setShowWellnessScore(true);
        break;
      case 'wellness-score-setup':
        if (['admin', 'developer'].includes(userRole)) {
          setShowWellnessScoreSetup(true);
        }
        break;
      default:
        break;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- setters/refs stable; showDashboardPage stable
  }, [showDashboardPage, userRole]);
  // -- Permission flow ------------------------------------------------------
  //
  // Design: zero custom screens before OS dialogs. Permissions are requested
  // immediately in order. The PermissionBlockedDialog appears only AFTER an OS
  // prompt has been denied, as a last-resort block. Required permissions
  // (camera, location) block the app entirely; optional ones (notifications)
  // are silently skipped on denial.
  //
  // States
  //   activePermission = null          ? no gate, home accessible
  //   activePermission.canRequest=true ? [Allow Again] [Exit App]
  //   activePermission.canRequest=false? [Exit App] only (permanent)

  // Guard: prevents advancePermissionFlow from running concurrently.
  // Without this, the appStateChange listener could kick off a second run
  // while a native OS permission dialog is still open in the first run,
  // causing duplicate requests and unpredictable state.
  const _permissionFlowRunningRef = useRef(false);

  /**
   * Walk [camera ? location ? notifications] in order.
   *
   * For every non-granted permission, requestPermission() is called
   * IMMEDIATELY � no pre-dialog, no canRequest gate on the first check.
   *
   * Why skip the initial canRequest check?
   * Capacitor's checkPermissions() maps Android permission state via
   * shouldShowRequestPermissionRationale(). On a fresh install that method
   * returns false (never-asked), which Capacitor maps to 'denied', making
   * canRequest === false. Gating requestPermission on that value would show
   * the blocking dialog before the OS prompt ever fired.
   *
   * The OS itself is the arbiter:
   *   � First-time / 'prompt' ? OS shows the system dialog.
   *   � Permanent denial    ? OS silently returns 'denied'; no dialog shown.
   *
   * After requestPermission returns we re-check canRequest to decide whether
   * to offer "Allow Again" (still requestable) or just "Exit App" (permanent).
   */
  const advancePermissionFlow = useCallback(async () => {
    // Prevent concurrent runs (e.g. setup effect + appStateChange firing together).
    if (_permissionFlowRunningRef.current) return;
    _permissionFlowRunningRef.current = true;

    try {
      const PERMISSIONS = ['camera', 'location', 'notifications'];

      for (const type of PERMISSIONS) {
        const config = PermissionManager.PERMISSION_CONFIG[type];

        // Fast path: already granted � skip without touching the OS.
        const { granted: alreadyGranted } = await PermissionManager.checkPermission(type);
        if (alreadyGranted) continue;

        if (type === 'location') {
          const gpsOn = await nativeLifecycle.checkGpsEnabled();
          if (!gpsOn) {
            setShowGpsRequired(true);
            return;
          }
        }

        // Not granted � request directly. The OS either shows a dialog
        // (first-time or 'prompt') or silently returns denied (permanent).
        // We never show a custom screen before this call.
        const { granted: nowGranted } = await PermissionManager.requestPermission(type);
        if (nowGranted) continue;

        // Request returned denied.
        if (!config.required) continue; // Notifications is optional � skip.

        // Required permission denied. Re-check canRequest NOW � this
        // post-request value is accurate: Capacitor correctly maps 'prompt'
        // (Android first-denial, can ask again) vs 'denied' (permanent).
        const { canRequest: canRequestNow } = await PermissionManager.checkPermission(type);
        setActivePermission({ type, canRequest: canRequestNow });
        return; // Hold here; user action (Allow Again / Exit) resumes flow.
      }

      // All permissions satisfied � verify GPS is enabled.
      const gpsOn = await nativeLifecycle.checkGpsEnabled();
      if (!gpsOn) {
        setShowGpsRequired(true);
        return;
      }

      setActivePermission(null);
      localStorage.setItem('wv.permissionsGranted', '1');
      setPermissionsReady(true);
    } finally {
      _permissionFlowRunningRef.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Background location cache: keep latest GPS + club/city ready so photo
  // capture never waits on a spinner for geolocation.
  useEffect(() => {
    if (!user || !permissionsReady || !isUserActive || !apiBaseUrl) {
      return undefined;
    }
    let cancelled = false;
    (async () => {
      const uid = user?.id || (await getUserId(user).catch(() => null));
      if (cancelled || !uid) return;
      await startUserLocationCache({ apiBaseUrl, userId: uid });
    })();
    return () => {
      cancelled = true;
      stopUserLocationCache();
    };
  }, [user, permissionsReady, isUserActive, apiBaseUrl]);

  /**
   * Called when user taps "Allow Again" in PermissionDeniedModal.
   *
   * Invokes the native OS permission dialog directly (canRequest is true at
   * this point � the modal is only shown while the OS can still prompt).
   *   � Granted          ? reset flow lock, continue with remaining permissions.
   *   � Denied, can ask  ? keep PermissionDeniedModal visible (stay requestable).
   *   � Denied, permanent ? canRequest flips to false ? React automatically
   *                         switches from PermissionDeniedModal to
   *                         PermissionBlockedPage (no explicit navigation needed).
   */
  const handlePermissionAllow = useCallback(async (type) => {
    setPermissionDialogLoading(true);
    try {
      if (type === 'location') {
        const gpsOn = await nativeLifecycle.checkGpsEnabled();
        if (!gpsOn) {
          setActivePermission(null);
          setShowGpsRequired(true);
          return;
        }
      }

      const { granted } = await PermissionManager.requestPermission(type);
      if (granted) {
        setActivePermission(null);
        // Reset the concurrent-run guard before resuming the flow so
        // advancePermissionFlow can proceed to check the remaining permissions.
        _permissionFlowRunningRef.current = false;
        await advancePermissionFlow();
      } else {
        // Re-check canRequest after denial. If it flipped to false (permanent)
        // React will switch the rendered component to PermissionBlockedPage.
        const { canRequest } = await PermissionManager.checkPermission(type);
        setActivePermission({ type, canRequest });
      }
    } catch {
      const { canRequest } = await PermissionManager.checkPermission(type).catch(() => ({ canRequest: false }));
      setActivePermission({ type, canRequest });
    } finally {
      setPermissionDialogLoading(false);
    }
  }, [advancePermissionFlow]);

  const handleInactiveModalClose = async () => {
    setShowInactiveModal(false);
    isInactiveReactivationFlowRef.current = false;
    setIsInactiveReactivationFlow(false);

    // Add small delay to ensure modal is visible before sign out
    await new Promise((resolve) => setTimeout(resolve, 300));

    await handleSignOut();
  };

  // Called when user clicks "Contact Your Coach" inside the inactive modal.
  // Sends coach OTP then opens ValidateOTP immediately (no artificial delay).
  const handleInactiveReactivationSuccess = useCallback(async () => {
    isInactiveReactivationFlowRef.current = false;
    setShowValidateOTP(false);
    setIsInactiveReactivationFlow(false);
    setShowInactiveModal(false);
    setIsUserActive(true);
    setIsOtpVerified(true);
    Session.markOtpVerified();
    Session.clearUserSignedOut();
    setForceLoggedOut(false);

    const storedUserRaw = Session.getOtpUserRaw();
    if (storedUserRaw) {
      try {
        const parsedUser = JSON.parse(storedUserRaw);
        const reactivated = {
          ...parsedUser,
          status: "Active",
          Status: "Active",
        };
        Session.setOtpUser(reactivated);
        if (!reactivated.id && !reactivated.UserId) {
          const dbUserId = await getUserId(reactivated);
          if (dbUserId) {
            reactivated.id = dbUserId;
            Session.setDbUserId(dbUserId);
          }
        }
        clearUserIdCache();
        setUser(reactivated);
        setAuthLoading(false);
        // Re-check status in background after DB commit — do not block entry.
        checkUserStatus(reactivated, true).catch(() => {});
      } catch {
        /* ignore */
      }
    } else if (user) {
      setUser({ ...user, status: "Active", Status: "Active" });
    }
  }, [checkUserStatus, user]);

  const handleContactCoach = async () => {
    // Lock reactivation flow first so background setup/status effects cannot
    // open a non-reactivation ValidateOTP that auto-closes on fetchRequestInfo.
    isInactiveReactivationFlowRef.current = true;
    setIsInactiveReactivationFlow(true);
    setShowInactiveModal(false);
    setIsWaitingForCoachOTP(true);

    try {
      const storedUserRaw = Session.getOtpUserRaw();
      const storedUser = storedUserRaw ? JSON.parse(storedUserRaw) : user;
      const userEmail =
        storedUser?.email ||
        storedUser?.Email ||
        user?.email ||
        user?.Email ||
        Session.getUserEmail();
      const userPhone =
        storedUser?.phone ||
        storedUser?.PhoneNumber ||
        user?.phone ||
        user?.PhoneNumber;
      const userId =
        storedUser?.id ||
        storedUser?.UserId ||
        user?.id ||
        user?.UserId ||
        Session.getDbUserId();

      let coachId = inactiveCoachIdRef.current;
      let coachName = inactiveCoachName;

      if (!coachId) {
        const info = await fetchInactiveCoachInfo({
          apiBaseUrl,
          user: storedUser || user,
        });
        coachId = info.coachId;
        coachName = info.coachName;
        inactiveCoachIdRef.current = coachId;
        if (coachName) setInactiveCoachName(coachName);
      }

      if (userEmail || userPhone || userId) {
        const otpRes = await fetch(`${apiBaseUrl}/api/upline/request`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: userEmail || undefined,
            phone: userPhone || undefined,
            userId: userId || undefined,
            coachId: coachId || undefined,
          }),
        });
        const otpJson = await otpRes.json();

        if (otpRes.ok && otpJson.success !== false) {
          if (userEmail) Session.setUserEmail(userEmail);
          if (otpJson.coachName) setInactiveCoachName(otpJson.coachName);
          flushSync(() => {
            setIsWaitingForCoachOTP(false);
            setShowValidateOTP(true);
          });
          return;
        }

        const errMsg =
          otpJson.message ||
          otpJson.error ||
          "Could not reach your coach. Please try again.";
        setAlertModal({
          isOpen: true,
          title: "Unable to contact coach",
          message:
            otpJson.error === "NO_COACH_ASSIGNED"
              ? "No coach is assigned to your account. Please ask your wellness center to link you to a coach first."
              : errMsg,
          type: "warning",
        });
      } else {
        setAlertModal({
          isOpen: true,
          title: "Unable to contact coach",
          message:
            "Your account is missing contact details. Please sign in again or contact support.",
          type: "warning",
        });
      }
    } catch (_err) {
      console.error("[handleContactCoach] Error:", _err);
    }

    setIsInactiveReactivationFlow(false);
    isInactiveReactivationFlowRef.current = false;
    setIsWaitingForCoachOTP(false);
    setShowInactiveModal(true);
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

  // ? NATIVE LIFECYCLE PHASE: StatusBar overlay configuration delegated to
  // nativeLifecycle. Lazy import + native-only gate + warn-on-missing-plugin
  // semantics are preserved exactly inside the service.
  useEffect(() => {
    nativeLifecycle.initStatusBar();
  }, []);

  // ? HYGIENE FIX (May 2026): track our own listener handles. Previously this
  // effect's cleanup called `App.removeAllListeners()` which also wiped the
  // foreground-profile-check listener (registered further down at the
  // "Immediate profile check when app comes back to foreground" effect),
  // because Capacitor's removeAllListeners is plugin-wide. With the
  // showDashboardPage-dep effect re-running on callback identity changes,
  // the foreground profile check could disappear silently.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;

    let appStateHandle = null; // PluginListenerHandle for our appStateChange listener
    let notificationHandle = null; // PluginListenerHandle for galleryMonitorPlugin notificationClicked
    let cancelled = false;

    const init = async () => {
      try {
        await GalleryMonitor.initialize();
        if (cancelled) return;

        // ? NATIVE LIFECYCLE PHASE: registration plumbing routed through
        // nativeLifecycle.addAppStateListener. Returns the same
        // PluginListenerHandle shape as before; cleanup semantics unchanged
        // (this effect still removes only its own handle, never
        // App.removeAllListeners()).
        appStateHandle = await nativeLifecycle.addAppStateListener(
          ({ isActive }) => {
            if (isActive) {
              // Activate screen keep-awake when app comes to foreground
              KeepAwakePlugin.activate().catch((err) => {
                console.warn("?? Failed to activate keep-awake:", err);
              });

              GalleryMonitor.checkGallery();
            } else {
              // Deactivate screen keep-awake when app goes to background
              KeepAwakePlugin.deactivate().catch((err) => {
                console.warn("?? Failed to deactivate keep-awake:", err);
              });

              // Background n++ reset transient sub-pages so reopening shows dashboard
              const page = Session.getCurrentPage();
              if (page === "screen-time") {
                Session.setCurrentPage("main");
                setShowScreenTime(false);
              }

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

  // Email users: run profile completeness as the first gate (before activity / coach).
  useEffect(() => {
    if (!user) return;
    if (!isOtpVerified) return;
    const email = (user.email && user.email.trim()) || Session.getUserEmail();
    if (!email) return;
    // Always ask the API — session "complete" flags may be stale after new required fields (gender/photo).
    checkProfileCompletion(email, user, { silent: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: user/auth only
  }, [user?.id, user?.email, isOtpVerified, checkProfileCompletion]);

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
          // Fast path for returning users: surface home immediately.
          // Profile completeness runs here; physical activity → coach → OTP
          // are sequenced by dedicated effects so camera never opens mid-onboarding.
          setUser(user);
          setAuthLoading(false);

          // Background validation � fire and forget. All inner awaits only
          // mutate React state (setShow*, setIsUserActive, etc.) � safe to
          // call from an async IIFE after the render is already committed.
          (async () => {
            const isActive = await checkUserStatus(user);
            if (!isActive) return; // inactive/not-found modal already triggered

            if (!userEmail) return;
            debugLog("?? [Auth State] Checking profile completeness (coach setup deferred to sequenced gate)...");

            // Check if user manually skipped setup (localStorage first for quick bypass)
            if (Session.isSetupSkipped()) {
              debugLog(
                "?? [Auth State] User skipped setup (localStorage), bypassing wizard",
              );
            }

            // Always profile first. Coach selection / OTP are owned by the
            // setup-check effect which waits for physical activity to finish.
            await checkProfileCompletion(userEmail, user, { silent: true });
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

  // Setup for authenticated users.
  // First-install AND returning-user path: run advancePermissionFlow immediately.
  // No intro/primer screens � permissions are requested natively on the spot.
  // For returning users, permissionsReady starts true (fast launch); if any
  // permission was revoked, advancePermissionFlow sets activePermission which
  // blocks interaction via PermissionBlockedDialog (zIndex 99999).
  useEffect(() => {
    if (!user) return;
    let mounted = true;
    handleSaveUserCache(user);

    if (Capacitor.isNativePlatform()) {
      advancePermissionFlow().catch(() => {
        // Fail-open for unexpected plugin errors only.
        if (mounted) setPermissionsReady(true);
      });
    }

    return () => { mounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, advancePermissionFlow, handleSaveUserCache]);

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
        } else {
          // isOtpVerified=true but no user data in localStorage � stale flag
          // from a previous session (e.g. data was cleared while the flag
          // remained). Clear it so the render shows Login instead of a blank page.
          Session.clearOtpVerified();
          Session.clearOtpUser();
          setIsOtpVerified(false);
          setAuthLoading(false);
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
          refreshUserLocationCache();
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

  // Permission resume listener � fires whenever the app returns from background.
  //
  //   Case A: showGpsRequired � re-check GPS; dismiss when enabled.
  //
  //   Case B: a PermissionBlockedDialog is visible (activePermission != null).
  //           The user may have gone to device Settings and granted the permission.
  //           Re-check the specific permission only; clear the dialog if now granted.
  //           Do NOT call requestPermission() here � that would show the OS dialog
  //           unexpectedly on every resume while the custom dialog is visible.
  //
  //   Case C: no dialog, permissions already verified (permissionsReady) �
  //           a permission may have been revoked from Settings mid-session.
  //           Re-run advancePermissionFlow to detect and handle it.
  //
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;
    if (!user) return undefined;

    let handle = null;
    let cancelled = false;

    Promise.resolve(
      nativeLifecycle.addAppStateListener(async ({ isActive }) => {
        if (!isActive || cancelled) return;

        // Case A.
        if (showGpsRequired) {
          const gpsOn = await nativeLifecycle.checkGpsEnabled();
          if (!cancelled && gpsOn) {
            setShowGpsRequired(false);
            _permissionFlowRunningRef.current = false;
            await advancePermissionFlow();
          }
          return;
        }

        // Case B: dialog is visible � check if user granted from Settings.
        if (activePermission !== null) {
          const { granted } = await PermissionManager.checkPermission(activePermission.type);
          if (!cancelled && granted) {
            setActivePermission(null);
            // Reset lock so advancePermissionFlow can continue with remaining perms.
            _permissionFlowRunningRef.current = false;
            await advancePermissionFlow();
          }
          return;
        }

        // Case C: no dialog � full re-validation in case a permission was revoked.
        if (!cancelled) {
          await advancePermissionFlow();
        }
      }),
    )
      .then((h) => {
        if (cancelled) h?.remove?.();
        else handle = h;
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      try { handle?.remove?.(); } catch { /* ignore */ }
    };
  // Re-register when any of these change so the handler has fresh closure values.
  }, [user, showGpsRequired, activePermission, advancePermissionFlow]); // eslint-disable-line react-hooks/exhaustive-deps

  // Coach setup / OTP — only after profile + physical activity gates.
  // Shared helper so onboarding screens can open the next gate in the same
  // save handler (instant page switch — no interstitial loader).
  const resolveCoachSetupStatus = useCallback(async (userEmail) => {
    if (!userEmail || Session.isSetupSkipped()) {
      if (userEmail && Session.isSetupSkipped()) Session.markSetupSkipped();
      return;
    }
    try {
      const status = await fetchSetupStatus({ apiBaseUrl, email: userEmail });
      authFsm.send({
        type: authFsm.E.SETUP_STATUS_RESOLVED,
        result: status.result,
        isDemo: (userEmail || "").toLowerCase().trim() === DEMO_EMAIL,
        coachOtpVerified: Session.isCoachOtpVerified(),
      });

      if (status.result === "skipped") {
        Session.markSetupSkipped();
      } else if (status.result === "pendingOtp") {
        if (Session.isCoachOtpVerified()) {
          /* already verified */
        } else if ((userEmail || "").toLowerCase().trim() === DEMO_EMAIL) {
          await silentlyCompleteDemoSetup(userEmail);
        } else if (!isInactiveReactivationFlowRef.current) {
          setShowValidateOTP(true);
        }
      } else if (status.result === "incomplete") {
        if ((userEmail || "").toLowerCase().trim() === DEMO_EMAIL) {
          await silentlyCompleteDemoSetup(userEmail);
        } else {
          setShowSetupWizard(true);
        }
      }
    } catch (setupError) {
      console.warn("?? [Setup Check] Failed to check setup status:", setupError);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    if (!user || !isUserActive || isInactiveReactivationFlow) {
      return undefined;
    }
    if (showCompleteProfile || profileChecking) {
      setCoachSetupResolved(false);
      return undefined;
    }
    if (!physicalActivityResolved || showPhysicalActivitySetup) {
      setCoachSetupResolved(false);
      return undefined;
    }

    const userEmail = user.email || user.Email;
    if (!userEmail) {
      setCoachSetupResolved(false);
      return undefined;
    }

    // Already showing coach UI from an eager onComplete handoff — don't flicker.
    if (showSetupWizard || showValidateOTP) {
      setCoachSetupResolved(true);
      return undefined;
    }

    let cancelled = false;
    setCoachSetupResolved(false);

    (async () => {
      await resolveCoachSetupStatus(userEmail);
      if (!cancelled) setCoachSetupResolved(true);
    })();

    return () => { cancelled = true; };
  }, [
    user,
    isUserActive,
    isInactiveReactivationFlow,
    showCompleteProfile,
    profileChecking,
    physicalActivityResolved,
    showPhysicalActivitySetup,
    showSetupWizard,
    showValidateOTP,
    resolveCoachSetupStatus,
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
    savedUserNameRef.current = savedUserName;
  }, [savedUserName]);

  useEffect(() => {
    const email = user?.email || user?.Email;
    if (!email) return;
    const phoneNumber = user?.phoneNumber || user?.PhoneNumber;
    const cached = getCachedProfileUserName(email);
    if (hasValidProfileName(cached, { email, phoneNumber })) {
      setSavedUserName((prev) => (prev?.trim() ? prev : cached));
      return;
    }
    const authName = (user?.username || user?.userName || '').trim();
    if (hasValidProfileName(authName, { email, phoneNumber })) {
      setSavedUserName((prev) => (prev?.trim() ? prev : authName));
    }
  }, [user?.email, user?.Email, user?.username, user?.userName, user?.phoneNumber, user?.PhoneNumber]);

  useEffect(() => {
    const email = user?.email || user?.Email;
    if (!email || !apiBaseUrl) {
      setSavedProfileImage(null);
      return undefined;
    }
    const phoneNumber = user?.phoneNumber || user?.PhoneNumber;
    const { signal, cancel } = createAbortGroup();
    // Use standard caching ? no need to bust cache on every render
    fetch(
      `${apiBaseUrl}/api/user/profile?email=${encodeURIComponent(email)}&_t=${Date.now()}`,
      { signal, cache: 'no-store', headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' } },
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (signal.aborted) return;
        if (data?.success && data?.data?.profileImage)
          setSavedProfileImage(data.data.profileImage);
        else setSavedProfileImage(null);
        const profileName = data?.success ? data?.data?.userName : null;
        const profilePhone = data?.data?.phoneNumber || phoneNumber;
        if (hasValidProfileName(profileName, { email, phoneNumber: profilePhone })) {
          setSavedUserName(profileName);
          cacheProfileUserName(email, profileName);
        } else {
          const cached = getCachedProfileUserName(email);
          setSavedUserName(hasValidProfileName(cached, { email, phoneNumber: profilePhone }) ? cached : null);
        }
      })
      .catch((err) => {
        if (isAbortError(err)) return;
        setSavedProfileImage(null);
        const cached = getCachedProfileUserName(email);
        setSavedUserName(hasValidProfileName(cached, { email, phoneNumber }) ? cached : null);
      });
    return cancel;
  }, [user?.email, user?.Email, user?.phoneNumber, user?.PhoneNumber, apiBaseUrl]);

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
  // Weight capture state + save pipeline (hooks/useWeightCapture.js)
  const {
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
  } = useWeightCapture({
    user, apiBaseUrl, foodCaptureIdRef, captureLocationByIdRef,
    setAlertModal, setSaveLoading, setLoadingState,
    setBmrUpdateKey, handleLeaderboardRefresh, setError, refreshIdealWeight,
  });

  // Ref-sync: keep weightResultRef current so mount-only resume listener can
  // read the latest value without stale closure.
  useEffect(() => {
    weightResultRef.current = weightResult;
  }, [weightResult]);

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
    }, 900);
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
    idealWeight,
    weightDiff,
  ]);

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
          originalCapturedAt: unknownShareView.createdAt ?? null,
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
        originalCapturedAt: unknownShareView.createdAt ?? null,
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
   * Persist smartwatch / fitness-app screenshot activity without mounting UI.
   */
  const saveWatchActivityLog = async ({
    userId,
    imageBase64,
    caloriesBurned,
    source,
    captureId,
  }) => {
    const response = await fetch(`${apiBaseUrl}/api/education/logs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        imageBase64,
        platform: source || "Smartwatch",
        topic: `Calories Burned: ${caloriesBurned || 0} kcal`,
        confidence: 0.9,
        deviceInfo: window.navigator.userAgent,
        clientTimestamp: new Date().toISOString(),
        clientTimezoneOffset: new Date().getTimezoneOffset(),
        captureId: captureId || undefined,
      }),
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || "Failed to save activity log");
    }
    return data;
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
    { silent = false } = {},
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

      // Resolve GPS + nutrition-center attendance. Prefer capture-time stash when present.
      const captureIdForLoc = foodCaptureIdRef.current
        ? String(foodCaptureIdRef.current)
        : null;
      const stashedLocation = captureIdForLoc
        ? captureLocationByIdRef.current.get(captureIdForLoc)
        : null;
      let locationFields = stashedLocation
        ? stripLocationDiagnostics(stashedLocation)
        : {};
      let gpsDenied = false;
      if (!locationFields.latitude || !locationFields.longitude) {
        const resolved = await resolveLocationFields(apiBaseUrl, userId);
        const {
          permissionDenied,
          locationStatus,
          locationErrorCode,
          locationErrorDetail,
          locationLatencyMs,
          geocodeOk,
          ...fields
        } = resolved;
        gpsDenied = !!permissionDenied;
        locationFields = {
          ...locationFields,
          ...stripLocationDiagnostics(fields),
        };
        console.warn('[EDU-SAVE-LOCATION]', {
          status: locationStatus,
          errorCode: locationErrorCode,
          errorDetail: locationErrorDetail,
          latencyMs: locationLatencyMs,
          geocodeOk,
          usedCaptureTimeLocation: false,
          captureId: captureIdForLoc,
        });
      } else {
        console.warn('[EDU-SAVE-LOCATION]', {
          status: 'success',
          usedCaptureTimeLocation: true,
          captureId: captureIdForLoc,
          hasCoords: true,
        });
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

      // selectedClub (from club-selection modal) overrides the auto-detected club.
      const finalCenterId = selectedClub?.id || locationFields.nutritionCenterId;
      const finalCenterName =
        selectedClub?.center_name || locationFields.centerName;
      const finalPlatform =
        locationFields.attendanceType === "club" ? "Club" : educationData.platform;

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
          latitude: locationFields.latitude,
          longitude: locationFields.longitude,
          attendanceType: locationFields.attendanceType,
          nutritionCenterId: finalCenterId,
          centerName: finalCenterName,
          imageTimestamp: logTimestamp, // Pass EXIF timestamp to backend
          city: locationFields.city,
          village: locationFields.village,
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

      debugLog(`   ?? Attendance: ${locationFields.attendanceType.toUpperCase()}`);
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
      if (!silent) {
        setError(
          error.message || "Failed to save education log. Please try again.",
        );
      }
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
  const performNutritionSave = async (
    saveData,
    {
      silent = false,
      captureId: boundCaptureId = null,
      pendingSharePromise: boundPendingSharePromise = null,
    } = {},
  ) => {
    const saveStart = Date.now();
    let resolvedCaptureId = boundCaptureId ?? foodCaptureIdRef.current;
    const useGlobalCaptureRefs =
      boundCaptureId == null && boundPendingSharePromise == null;
    try {
      debugLog("?? [App] Starting nutrition save:", {
        userId: saveData.userId,
        imagePath: saveData.imagePath,
        hasImageBase64: !!saveData.imageBase64,
      });
      if (!silent) setSaveLoading(true);
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
      const pendingSharePromise =
        boundPendingSharePromise ?? pendingSharePromiseRef.current;
      if (pendingSharePromise) {
        const share = await pendingSharePromise;
        if (share && !resolvedCaptureId) {
          resolvedCaptureId = share.id;
        }
        if (useGlobalCaptureRefs) {
          pendingSharePromiseRef.current = null;
        }
      }
      // Stage 9 � pendingSharePromise resolved (captureId now settled)
      _ctLog(9, 'pendingSharePromise settled', {
        captureIdAfterSettle: resolvedCaptureId ?? 'null',
        pendingShareRefCleared: useGlobalCaptureRefs
          ? pendingSharePromiseRef.current == null
          : true,
      });

      // Prefer capture-time location (already on captures_table). Only re-resolve
      // GPS when the first save had no coords — avoids missing club/city when the
      // later domain save races or GPS fails the second time.
      const captureIdForLoc = resolvedCaptureId
        ? String(resolvedCaptureId)
        : null;
      const stashedLocation = captureIdForLoc
        ? captureLocationByIdRef.current.get(captureIdForLoc)
        : null;
      const _gpsStart = Date.now();
      _ctLog(10, 'GPS started', {
        hasCaptureTimeLocation: !!(stashedLocation?.latitude && stashedLocation?.longitude),
      });
      let clubLocationFields = stashedLocation
        ? stripLocationDiagnostics(stashedLocation)
        : {};
      let gpsDenied = false;
      if (!clubLocationFields.latitude || !clubLocationFields.longitude) {
        const resolved = await resolveLocationFields(apiBaseUrl, saveData.userId);
        const {
          permissionDenied,
          locationStatus,
          locationErrorCode,
          locationErrorDetail,
          locationLatencyMs,
          geocodeOk,
          ...fields
        } = resolved;
        gpsDenied = !!permissionDenied;
        clubLocationFields = {
          ...clubLocationFields,
          ...stripLocationDiagnostics(fields),
        };
        console.warn('[FOOD-SAVE-LOCATION]', {
          status: locationStatus,
          errorCode: locationErrorCode,
          errorDetail: locationErrorDetail,
          latencyMs: locationLatencyMs,
          geocodeOk,
          usedCaptureTimeLocation: false,
          captureId: captureIdForLoc,
        });
        if (captureIdForLoc) {
          captureLocationByIdRef.current.set(captureIdForLoc, { ...clubLocationFields });
        }
      } else {
        console.warn('[FOOD-SAVE-LOCATION]', {
          status: 'success',
          errorCode: null,
          errorDetail: null,
          usedCaptureTimeLocation: true,
          captureId: captureIdForLoc,
          hasCoords: true,
          hasCity: !!clubLocationFields.city,
        });
      }
      _ctLog(11, 'GPS finished', {
        attendanceType: clubLocationFields.attendanceType,
        hasCoords: !!(clubLocationFields.latitude && clubLocationFields.longitude),
        gpsLatencyMs: Date.now() - _gpsStart,
        locationError: gpsDenied ? 'PERMISSION_DENIED' : null,
        usedCaptureTimeLocation: !!(stashedLocation?.latitude && stashedLocation?.longitude),
      });
      if (!silent && gpsDenied) {
        setAlertModal({
          isOpen: true,
          title: "Location Permission Required",
          message:
            "To track your attendance at nutrition clubs, please enable location permissions in your device settings. Without location access, your attendance will be marked as Remote.",
          type: "warning",
        });
      }

      const saveRes = await saveNutritionAnalysis({
        ...saveData,
        ...clubLocationFields,
        // Pass captureId so the backend updates the pre-created pending row
        // instead of inserting a duplicate.  Reset the ref immediately after
        // so a retry cannot accidentally reuse the same row.
        captureId: resolvedCaptureId || undefined,
      });
      if (captureIdForLoc) {
        captureLocationByIdRef.current.delete(captureIdForLoc);
      }
      if (useGlobalCaptureRefs) {
        foodCaptureIdRef.current = null;
      }
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
      if (!silent) setSaveError(friendlySaveError);
      throw err;
    } finally {
      if (!silent) setSaveLoading(false);
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
    captureId: boundCaptureId = null,
    pendingSharePromise: boundPendingSharePromise = null,
    silent = false,
  }) => {
    if (!silent) setLoadingState("saving");

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
          await performNutritionSave(savePayload, {
            silent,
            captureId: boundCaptureId,
            pendingSharePromise: boundPendingSharePromise,
          });
          return;
        }

        if (!duplicateCheck || typeof duplicateCheck !== "object") {
          console.warn(
            "Invalid duplicate check response, proceeding with save",
          );
          await performNutritionSave(savePayload, {
            silent,
            captureId: boundCaptureId,
            pendingSharePromise: boundPendingSharePromise,
          });
          return;
        }

        if (false && duplicateCheck.isDuplicate) {
          debugLog("?? Duplicate food detected:", duplicateCheck);
          setDuplicateInfo(duplicateCheck);
          setPendingSaveData(savePayload);
          setShowDuplicateModal(true);
          setSaveLoading(false);
        } else {
          await performNutritionSave(savePayload, {
            silent,
            captureId: boundCaptureId,
            pendingSharePromise: boundPendingSharePromise,
          });
        }
      } catch (err) {
        console.error("? Save failed:", err?.message || err);
        if (!silent) setSaveError(getFriendlyErrorMessage(err));
        if (!silent) setSaveLoading(false);
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
    const instantShareUrl = `${apiBaseUrl}/share/${instantShareCode}`;

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
          const shareNamePromise = ensureShareDisplayName(
            savedUserNameRef.current ?? savedUserName,
            user,
            apiBaseUrl,
          );
          if (fileDataUrlPromise) {
            // FileReader started before overlay � usually already resolved.
            const [fileDataUrl, shareDisplayName] = await Promise.all([
              fileDataUrlPromise,
              shareNamePromise,
            ]);
            if (shareDisplayName && user?.email) {
              cacheProfileUserName(user.email, shareDisplayName);
              setSavedUserName(shareDisplayName);
            }
            const shareText = buildQuickShareText(shareDisplayName, getVersionString());
            // Dismiss overlay before opening share sheet — not after user finishes sharing.
            clearOverlayNow();
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
            const shareDisplayName = await shareNamePromise;
            if (shareDisplayName && user?.email) {
              cacheProfileUserName(user.email, shareDisplayName);
              setSavedUserName(shareDisplayName);
            }
            const shareText = buildQuickShareText(shareDisplayName, getVersionString());
            clearOverlayNow();
            const ok = await shareTextViaWhatsApp(shareText);
            _hasCompletedFirstShareRef.current = true;
            if (!ok) foodAutoSharedRef.current = false;
          }
        } catch (_) {
          // Native share failed — fall back to text-only.
          try {
            const shareDisplayName = await ensureShareDisplayName(
              savedUserNameRef.current ?? savedUserName,
              user,
              apiBaseUrl,
            );
            const shareText = buildQuickShareText(shareDisplayName, getVersionString());
            clearOverlayNow();
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
      setAlertModal({
        isOpen: true,
        title: "Sign in required",
        message: "Please sign in to save photos.",
        type: "warning",
      });
      imageProcessingInProgress.current = false;
      return;
    }

    // Re-check user status in real-time before upload
    const isActive = await checkUserStatus(user);
    if (!isActive) {
      setAlertModal({
        isOpen: true,
        title: "Account inactive",
        message:
          "Your account is inactive. Please contact your coach to reactivate.",
        type: "warning",
      });
      imageProcessingInProgress.current = false;
      return;
    }

    // Check file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      setAlertModal({
        isOpen: true,
        title: "File too large",
        message:
          "Image file is too large. Please choose a smaller image (max 10MB).",
        type: "error",
      });
      imageProcessingInProgress.current = false;
      return;
    }

    // ? MANUAL MODE: skip AI entirely, open best manual modal
    if (manualModeActive) {
      imageProcessingInProgress.current = false;
      openBestManualModal();
      return;
    }

    // TODO: Re-enable gallery date restrictions before production release.
    // TEMPORARILY DISABLED: web image freshness validation is commented out to allow users
    // to select images from WhatsApp, older gallery photos, and any available folder.
    /* GALLERY_DATE_RESTRICTION_ENABLED � begin disabled block
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
    GALLERY_DATE_RESTRICTION_ENABLED � end disabled block */

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
    setDetectedFoodNames([]);
    setLoading(false);
    setLoadingState(null);
    lastImageFileRef.current = file;
    savePromiseRef.current = null; // Clear any completed prior save

    // Stage 1 � handleImageSelect entered
    const _ct1Id = Math.random().toString(36).slice(2, 8).toUpperCase();
    captureTraceRef.current = { id: _ct1Id, t0: Date.now(), traceId: null };
    window.__captureTrace = { id: _ct1Id, t0: Date.now() };
    _ctLog(1, 'handleImageSelect entered', { fileSize: file?.size, hasExif: !!exifTimestamp });

    // ? PERFORMANCE TRACKING
    const perfStart = Date.now();
    debugLog("?? [PERF] ?? Image processing started");
    let capturePersisted = false;

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

      // Always compress to ≤800px / quality 0.7 before sending to Gemini.
      // Gemini tiles images at 768px — sending larger images creates multiple
      // tiles (4× tokens for a 1280px image vs 1× for 800px), slowing inference
      // and increasing 503 risk under load.  800px is sufficient for accurate
      // food / weight / education recognition.
      const compressStart = Date.now();

      let processedImage = imageBase64;
      let compressionApplied = false;

      try {
        processedImage = await compressImage(imageBase64, 0.7, 800);
        compressionApplied = true;
      } catch (_) {
        // Compression failed — proceed with original image
      }

      if (compressionApplied) {
        const origMB = imageBase64.length / (1024 * 1024);
        const newMB  = processedImage.length / (1024 * 1024);
        debugLog(
          `?? [PERF] Compression: ${Date.now() - compressStart}ms (${origMB.toFixed(2)}MB → ${newMB.toFixed(2)}MB)`,
        );
      } else {
        debugLog(`?? [PERF] Compression skipped (fallback to original)`);
      }

      // Offline: queue the image locally and exit.
      // The online listener below will automatically resubmit when connected.
      // Supports continuous shooting — multiple photos can be queued in a row.
      if (!navigator.onLine) {
        const n = captureQueue.enqueue({
          imageBase64:   processedImage,
          userId:        user?.id ?? null,
          exifTimestamp: exifTimestamp ?? null,
        });
        showToast(`No internet — photo queued${n > 0 ? ` (${n} waiting)` : ''}, will analyse when online`);
        return;
      }

      // Set preview immediately — GPS + capture POST run in the background UI
      // without a "Saving..." spinner (photo-first, no wait affordance).
      setImagePreview(processedImage);
      setLoading(false);
      setLoadingState(null);

      processedImageRef.current = processedImage;
      foodCaptureIdRef.current = null;
      setFoodShareUrl(null);

      // Instant location from background cache — never wait on GPS at photo time.
      const captureLocation = getCachedLocationFields();
      const {
        permissionDenied: captureGpsDenied,
        locationStatus,
        locationErrorCode,
        locationErrorDetail,
        locationLatencyMs,
        geocodeOk,
        gpsAccuracyM,
        fromCache,
        cacheAgeMs,
        ...captureLocationFields
      } = captureLocation || {
        attendanceType: 'remote',
        locationStatus: 'failed',
        locationErrorCode: 'NO_CACHED_LOCATION',
        locationErrorDetail: 'No cached location available at capture time',
      };
      const hasCoords = !!(
        captureLocationFields.latitude && captureLocationFields.longitude
      );
      // Client console (device) — also sent to Vercel via POST /captures diagnostics.
      console.warn('[CAPTURE-LOCATION]', {
        status: locationStatus || (hasCoords ? 'success' : 'failed'),
        errorCode: locationErrorCode || null,
        errorDetail: locationErrorDetail || null,
        attendanceType: captureLocationFields.attendanceType,
        hasCoords,
        hasCity: !!captureLocationFields.city,
        hasVillage: !!captureLocationFields.village,
        geocodeOk: !!geocodeOk,
        fromCache: !!fromCache,
        cacheAgeMs: cacheAgeMs ?? null,
        latencyMs: locationLatencyMs ?? 0,
        gpsAccuracyM: gpsAccuracyM ?? null,
      });
      _ctLog('loc', 'capture-time location from cache', {
        locationStatus: locationStatus || (hasCoords ? 'success' : 'failed'),
        locationErrorCode: locationErrorCode || null,
        locationErrorDetail: locationErrorDetail || null,
        attendanceType: captureLocationFields.attendanceType,
        hasCoords,
        hasCity: !!captureLocationFields.city,
        geocodeOk: !!geocodeOk,
        fromCache: !!fromCache,
        cacheAgeMs: cacheAgeMs ?? null,
      });
      // Soft hint only when cache never got a fix (watcher still warming / denied).
      // Do not block the photo save.
      if (captureGpsDenied && !hasCoords) {
        setAlertModal({
          isOpen: true,
          title: "Location Permission Required",
          message:
            "To track your attendance at nutrition clubs, please enable location permissions in your device settings. Without location access, your attendance will be marked as Remote.",
          type: "warning",
        });
      }

      // -- Phase 1 (critical): persist image + capture row BEFORE any AI work --
      const captureApiStart = Date.now();
      debugLog(
        `?? [PERF] ? POST /captures started (+${
          captureApiStart - perfStart
        }ms from capture start)`,
      );

      let captureShare = null;
      // Retry Phase 1 up to 3 times on transient server / network errors.
      // 4xx (auth, bad request) are not retried — they won't self-heal.
      const CAPTURE_MAX_ATTEMPTS = 3;
      let captureLastErr = null;
      for (let capAttempt = 1; capAttempt <= CAPTURE_MAX_ATTEMPTS; capAttempt++) {
        try {
          const capUserId = user?.id || (await getUserId(user));
          if (!capUserId) {
            throw new Error("Unable to resolve user account");
          }
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
                // Capture-time location / club from background cache
                latitude: captureLocationFields.latitude ?? null,
                longitude: captureLocationFields.longitude ?? null,
                city: captureLocationFields.city ?? null,
                village: captureLocationFields.village ?? null,
                attendanceType: captureLocationFields.attendanceType ?? null,
                nutritionCenterId: captureLocationFields.nutritionCenterId ?? null,
                centerName: captureLocationFields.centerName ?? null,
                locationStatus: locationStatus || (hasCoords ? 'success' : 'failed'),
                locationErrorCode: locationErrorCode || null,
                locationErrorDetail: locationErrorDetail || null,
                locationLatencyMs: locationLatencyMs ?? 0,
                geocodeOk: geocodeOk ?? null,
                gpsAccuracyM: gpsAccuracyM ?? null,
              }),
            },
          );
          if (!capRes.ok) {
            const retryable = capRes.status >= 500;
            const err = new Error(`Capture save failed (${capRes.status})`);
            err._retryable = retryable;
            throw err;
          }
          // Accept flat { ok, data } or accidental nested { httpStatus, body }.
        const capRaw = await capRes.json();
          const capData = capRaw?.body?.ok != null ? capRaw.body : capRaw;
        const capDuration = Date.now() - captureApiStart;
          if (!capData.ok || !capData.data?.id) {
            throw new Error("Capture save returned no id");
          }
          captureShare = {
            id: capData.data.id,
            url: `${apiBaseUrl}/share/${
              capData.data.shareCode || capData.data.token
            }`,
          };
          captureLocationByIdRef.current.set(
            String(captureShare.id),
            stripLocationDiagnostics(captureLocationFields),
          );
          debugLog(
            `?? [PERF] ? POST /captures: ${capDuration}ms (+${
              Date.now() - perfStart
            }ms from capture start) ? token ready (attempt ${capAttempt})`,
          );
          _ctLog(2, 'capture row created', {
            captureRowId: captureShare.id,
            shareCode: capData.data.shareCode || capData.data.token,
            latencyMs: capDuration,
            attempt: capAttempt,
          });
          captureLastErr = null;
          break; // success
        } catch (capErr) {
          captureLastErr = capErr;
          const retryable = capErr?._retryable !== false && capAttempt < CAPTURE_MAX_ATTEMPTS;
          debugLog(
            `?? [PERF] ? POST /captures attempt ${capAttempt} FAILED: ${capErr?.message || capErr}${
              retryable ? ` — retrying in 1s` : ''
            }`,
          );
          if (!retryable) break;
          await new Promise((r) => setTimeout(r, 1_000 * capAttempt));
        }
      }
      if (!captureShare) {
        debugLog(
          `?? [PERF] ? POST /captures FAILED after ${
            Date.now() - captureApiStart
          }ms: ${captureLastErr?.message || captureLastErr}`,
        );
        setAlertModal({
          isOpen: true,
          title: "Photo not saved",
          message:
            "Could not save your photo. Please check your connection and try again.",
          type: "error",
        });
        setLoading(false);
        setImagePreview(null);
        imageProcessingInProgress.current = false;
        return;
      }

      foodCaptureIdRef.current = captureShare.id;
      pendingSharePromiseRef.current = Promise.resolve(captureShare);

      // Phase 1 complete � image is safe; user can leave immediately.
      capturePersisted = true;
      setLoadingState("saved");
      setLoading(false);
      setImageType(null);
      setNutritionData(null);
      setWeightResult(null);
      setEducationResult(null);
      setWatchResult(null);
      setError(null);

      let resolvedUserIdForOrchestrate = user?.id;
      if (!resolvedUserIdForOrchestrate) {
        try {
          resolvedUserIdForOrchestrate = await getUserId(user);
        } catch (_) {}
      }

      markCaptureAnalyzing(captureShare.id, {
        ownerUserId: resolvedUserIdForOrchestrate ?? null,
        imageBase64: processedImage,
        capturedAt: new Date().toISOString(),
        currentAttempt: 1,  // Show "1/3" badge immediately; onAttempt callback keeps it in sync
        totalAttempts: 3,   // Must match MAX_ATTEMPTS in orchestratorService.js
      });
      triggerNutritionRefresh({ immediate: true, source: "capture-saved" });
      setDashboardInitialDate(null);
      // Stay on home — ImageUpload shows the saved photo + diary-update message.
      imageProcessingInProgress.current = false;

      debugLog(
        `?? [PERF] ? Phase 1 complete (+${
          Date.now() - perfStart
        }ms) � starting background AI`,
      );

      // Build compressed file for orchestrator (same as before).
      let fileForOrchestrate = file;
      try {
        const compressedBlob = await fetch(processedImage).then((r) => r.blob());
        fileForOrchestrate = new File(
          [compressedBlob],
          file.name || "capture.jpg",
          { type: "image/jpeg" },
        );
      } catch (_) {
        /* use original file */
      }

      const pendingSharePromise = Promise.resolve(captureShare);
      const bg = true; // background mode: never block home on AI; no result cards

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

      return;
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

      // Handle iOS "Load failed" network error � use alert modal, not home error banner
      if (
        errorMessage.toLowerCase() === "load failed" ||
        errorMessage.includes("Failed to fetch")
      ) {
        setAlertModal({
          isOpen: true,
          title: "Connection problem",
          message:
            "Please check your internet connection (WiFi or mobile data) and try again.",
          type: "error",
        });
      } else {
        setAlertModal({
          isOpen: true,
          title: "Could not process photo",
          message: errorMessage,
          type: "error",
        });
      }
      console.error("? Image processing error:", err);
    } finally {
      if (!capturePersisted) {
        setLoading(false);
        imageProcessingInProgress.current = false;
      }
      debugLog(
        `?? [PERF] ? TOTAL PROCESSING TIME: ${Date.now() - perfStart}ms`,
      );
      debugLog("????????????????????????????????????????????");
    }
  };

  // Offline capture queue: drain queued photos on network reconnection.
  useOfflineCaptureQueue(handleImageSelect, showToast);

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
          timezoneIana: getDeviceTimezoneIana() ?? "",
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
      clearHomeDashboardSnapshot();
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

        // Unified CompleteProfile (name/email/gender/height/diet/photo) runs as the
        // first gate via the profile-completion effects — before activity and coach.
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

  // Navigation flags are used directly (no useDeferredValue) so that tapping
  // any tab opens the page immediately even when image analysis is in-flight.
  // useDeferredValue was the root cause of the "navigation blocked" bug:
  // it always returns the stale false value first and only commits the new
  // true value in a background render, which gets interrupted by ongoing
  // urgent updates (setLoading, setImagePreview, setNutritionData�) and
  // never completes while analysis runs.

  // [BUG 3 FIX] No full-screen loading spinners anywhere. New installs and
  // returning users alike fall straight through to Login / Home. The native
  // Capacitor splash already covers app cold-start; once React mounts we go
  // directly to the correct route. Background auth/profile checks continue
  // silently � they just don't show a UI spinner.

  // silently they just don't show a UI spinner.

  const inactiveModalPortal = showInactiveModal ? (
    <InactiveUserModal
      userEmail={
        user?.email || user?.Email || Session.getUserEmail() || "your account"
      }
      coachName={inactiveCoachName}
      onClose={handleInactiveModalClose}
      onContactCoach={handleContactCoach}
    />
  ) : null;

  const alertModalPortal = (
    <CustomAlertModal
      isOpen={alertModal.isOpen}
      onClose={() => setAlertModal((prev) => ({ ...prev, isOpen: false }))}
      title={alertModal.title}
      message={alertModal.message}
      type={alertModal.type}
      confirmText={alertModal.confirmText}
      cancelText={alertModal.cancelText}
      onConfirm={alertModal.onConfirm}
    />
  );

  // -------------------------------------------------------------------------
  // HIGHEST PRIORITY: Show waiting modal if contacting coach
  // This MUST be before ALL other render branches so nothing can block it
  // -------------------------------------------------------------------------
  if (isWaitingForCoachOTP) {
    return (
      <>
        {alertModalPortal}
        <WaitingForCoachModal />
      </>
    );
  }
  // -------------------------------------------------------------------------

  // HIGHEST PRIORITY: Inactive reactivation — full-screen coach OTP entry.
  // Must replace Login entirely; overlay-on-Login was hidden behind lazy Suspense.
  if (showValidateOTP && isInactiveReactivationFlow) {
    return (
      <>
        {alertModalPortal}
        <Suspense
        fallback={
          <div
            className="fixed inset-0 z-[999999] flex items-center justify-center bg-white"
            aria-busy="true"
            aria-label="Loading verification screen"
          >
            <LoadingSpinner />
          </div>
        }
      >
        <ValidateOTP
          key="reactivation"
          isReactivationFlow
          userEmail={
            user?.email || user?.Email || Session.getUserEmail() || ""
          }
          coachName={inactiveCoachName || undefined}
          onClose={() => {
            isInactiveReactivationFlowRef.current = false;
            setShowValidateOTP(false);
            setIsInactiveReactivationFlow(false);
            handleSignOut();
          }}
          onSuccess={handleInactiveReactivationSuccess}
          onLogout={handleSignOut}
        />
      </Suspense>
      </>
    );
  }
  // -------------------------------------------------------------------------

  if (authLoading) {
    // On native, show the logo overlay instead of a blank screen � the native
    // splash may have already faded, so returning null would show white.
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
    // On web, show the Login page while Firebase resolves. Previously this
    // returned `inactiveModalPortal` (null for new/signed-out users), giving
    // a blank white screen for up to 5 seconds until the auth timeout fired.
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

  // OTP user restore in progress � stay invisible on native, show Login on web.
  // On web, returning null causes a white screen if the OTP state is stale
  // (isOtpVerified=true in localStorage but no valid otpUser data to restore).
  if (isOtpVerified && !user) {
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
    // Web: show Login so the user is never stuck on a blank page.
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

  // Profile check in progress � stay invisible on native, show Login on web
  // as a safety net so non-native users never see a blank page.
  if (profileChecking) {
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
    // Web: show Login so the user is never stuck on a blank page.
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
            coachName={inactiveCoachName}
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
          ReactDOM.createPortal(<WaitingForCoachModal />, document.body)}
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
        {alertModalPortal}
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
            coachName={inactiveCoachName}
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
        {/* Waiting for Coach OTP - Portal renders to document.body */}
        {isWaitingForCoachOTP &&
          ReactDOM.createPortal(<WaitingForCoachModal />, document.body)}
      </>
    );
  }

  const adminLikeRole = ['admin', 'developer'].includes(userRole);

  // Home keep-alive: sub-pages overlay Home instead of early-return
  // unmounting it. Returning to Home preserves scroll/state and avoids
  // dashboard API reloads unless a newer async activity log exists
  // (see homeDashboardActivity + NutritionRefreshContext.triggerRefresh).
  let homeOverlay = null;

  // Inline Profile Page — full-screen, below nav bar (no modal overlay)
  // Never show during onboarding (My Profile is not part of the setup wizard).
  if (showProfilePage && !onboardingBlocking) {
    homeOverlay = (
      <div className="ios-full-page bg-gray-50">
        <Header
          navOnly
          user={user}
          userRole={userRole}
          activePage={null}
          onShowHome={() => navigateTo('home')}
          onShowBackgroundHistory={() => navigateTo('dashboard')}
          onShowWellnessEnrollment={() => navigateTo('enrollment')}
          onShowWellnessCounselling={() => navigateTo('counselling')}
          onShowNutritionCentersMap={() => navigateTo('physical-club')}
          onShowActivityReport={() => navigateTo('activity-report')}
          onShowTestimonials={() => navigateTo('testimonials')}
          onShowReports={() => navigateTo('reports')}
        />
        <div className="ios-scroll-body">
          <UserProfilePage
            user={user}
            userRole={userRole}
            onBack={() => navigateTo('home')}
            onSignOut={handleSignOut}
            onProfileUpdate={(profileData) => {
              const email = user?.email || Session.getUserEmail() || "";
              profileCompletedRef.current = false;
              checkProfileCompletion(email, null, { afterSave: true });
              if (profileData?.name?.trim()) {
                setSavedUserName(profileData.name.trim());
                cacheProfileUserName(email, profileData.name);
              }
              if (profileData?.bmr || profileData?.physicalActivityLevel) {
                setBmrUpdateKey((prev) => prev + 1);
              }
              // Increment profileKey so Header re-fetches avatar/name
              setHeaderProfileKey((k) => k + 1);
              // Activity log: Home should refresh cards when returning from profile edits
              triggerNutritionRefresh({ immediate: true, source: 'profile-update' });
              setBodyParamsRefreshKey((k) => k + 1);
            }}
          />
        </div>
      </div>
    );
  } else if (showDashboard) {
    homeOverlay = (
      <div className="ios-full-page bg-[#e8f5e9]">
        {/* 5-tab nav bar � always visible on every sub-page */}
        <Header
          navOnly
          user={user}
          userRole={userRole}
          activePage="dashboard"
          onShowHome={() => navigateTo('home')}
          onShowBackgroundHistory={() => navigateTo('dashboard')}
          onShowWellnessEnrollment={() => navigateTo('enrollment')}
          onShowWellnessCounselling={() => navigateTo('counselling')}
          onShowNutritionCentersMap={() => navigateTo('physical-club')}
          onShowActivityReport={() => navigateTo('activity-report')}
          onShowTestimonials={() => navigateTo('testimonials')}
          onShowReports={() => navigateTo('reports')}
        />
        <div className="ios-scroll-body">
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
              onWatchBurnedCaloriesReset={() => setWatchBurnedCalories(0)}
              initialSelectedMember={dashboardInitialSelectedMember}
              initialDate={dashboardInitialDate}
              initialMealId={dashboardInitialMealId}
            />
          </Suspense>
        </div>
      </div>
    );
  } else if (showWellnessCounselling) {
    homeOverlay = (
      <div className="ios-full-page">
        <Header
          navOnly
          user={user}
          userRole={userRole}
          activePage="counselling"
          onShowHome={() => navigateTo('home')}
          onShowBackgroundHistory={() => navigateTo('dashboard')}
          onShowWellnessEnrollment={() => navigateTo('enrollment')}
          onShowWellnessCounselling={() => navigateTo('counselling')}
          onShowNutritionCentersMap={() => navigateTo('physical-club')}
          onShowActivityReport={() => navigateTo('activity-report')}
          onShowTestimonials={() => navigateTo('testimonials')}
          onShowReports={() => navigateTo('reports')}
        />
        <div className="ios-scroll-body">
          <Suspense fallback={null}>
            <WellnessCounselling
              user={user}
              refreshKey={bodyParamsRefreshKey}
              onCardSaved={() => {
                setHeaderProfileKey((k) => k + 1);
                setBmrUpdateKey((k) => k + 1);
              }}
              onBack={() => {
                setShowWellnessCounselling(false);
                const currentWvPage = window.history.state?.wvPage;
                if (currentWvPage && currentWvPage !== 'main') window.history.back();
              }}
            />
          </Suspense>
        </div>
      </div>
    );
  } else if (showUniversityEnrollment) {
    homeOverlay = (
      <div className="ios-full-page">
        <Header
          navOnly
          user={user}
          userRole={userRole}
          activePage="enrollment"
          onShowHome={() => navigateTo('home')}
          onShowBackgroundHistory={() => navigateTo('dashboard')}
          onShowWellnessEnrollment={() => navigateTo('enrollment')}
          onShowWellnessCounselling={() => navigateTo('counselling')}
          onShowNutritionCentersMap={() => navigateTo('physical-club')}
          onShowActivityReport={() => navigateTo('activity-report')}
          onShowTestimonials={() => navigateTo('testimonials')}
          onShowReports={() => navigateTo('reports')}
        />
        <div className="ios-scroll-body">
          <Suspense fallback={null}>
            <WellnessUniversityEnrollment
              embedded
              user={user}
              userRole={userRole}
              onBack={() => {
                enrollmentHistoryPushedRef.current = false;
                setShowUniversityEnrollment(false);
                window.history.replaceState({ wvPage: 'main' }, '');
              }}
            />
          </Suspense>
        </div>
      </div>
    );
  } else if (showActivityReport) {
    homeOverlay = (
      <div className="ios-full-page">
        <Header
          navOnly
          user={user}
          userRole={userRole}
          activePage="activity-report"
          onShowHome={() => navigateTo('home')}
          onShowBackgroundHistory={() => navigateTo('dashboard')}
          onShowWellnessEnrollment={() => navigateTo('enrollment')}
          onShowWellnessCounselling={() => navigateTo('counselling')}
          onShowNutritionCentersMap={() => navigateTo('physical-club')}
          onShowActivityReport={() => navigateTo('activity-report')}
          onShowTestimonials={() => navigateTo('testimonials')}
          onShowReports={() => navigateTo('reports')}
        />
        <div className="ios-scroll-body">
          <Suspense fallback={null}>
            <ActivityReport
              user={user}
              userRole={userRole}
              apiBaseUrl={apiBaseUrl}
              onBack={() => {
                setShowActivityReport(false);
                const currentWvPage = window.history.state?.wvPage;
                if (currentWvPage && currentWvPage !== 'main') window.history.back();
              }}
            />
          </Suspense>
        </div>
      </div>
    );
  } else if (showActivityTimeReport) {
    homeOverlay = (
      <div className="ios-full-page">
        <Header
          navOnly
          user={user}
          userRole={userRole}
          activePage="activity-report"
          onShowHome={() => navigateTo('home')}
          onShowBackgroundHistory={() => navigateTo('dashboard')}
          onShowWellnessEnrollment={() => navigateTo('enrollment')}
          onShowWellnessCounselling={() => navigateTo('counselling')}
          onShowNutritionCentersMap={() => navigateTo('physical-club')}
          onShowActivityReport={() => navigateTo('activity-report')}
          onShowTestimonials={() => navigateTo('testimonials')}
          onShowReports={() => navigateTo('reports')}
        />
        <div className="ios-scroll-body">
          <Suspense fallback={null}>
            <ActivityTimeReport
              user={user}
              userRole={userRole}
              apiBaseUrl={apiBaseUrl}
              onBack={() => {
                setShowActivityTimeReport(false);
                const currentWvPage = window.history.state?.wvPage;
                if (currentWvPage && currentWvPage !== 'main') window.history.back();
              }}
            />
          </Suspense>
        </div>
      </div>
    );
  } else if (showNutritionCentersMap) {
    homeOverlay = (
      <>
        <div className="ios-full-page bg-[#e8f5e9]">
          <Header
            navOnly
            user={user}
            userRole={userRole}
            activePage="physical-club"
            onShowHome={() => navigateTo('home')}
            onShowBackgroundHistory={() => navigateTo('dashboard')}
            onShowWellnessEnrollment={() => navigateTo('enrollment')}
            onShowWellnessCounselling={() => navigateTo('counselling')}
            onShowNutritionCentersMap={() => navigateTo('physical-club')}
            onShowActivityReport={() => navigateTo('activity-report')}
            onShowTestimonials={() => navigateTo('testimonials')}
            onShowReports={() => navigateTo('reports')}
          />
          <div className="ios-scroll-body">
            <Suspense fallback={<LoadingSpinner message="Loading nutrition centers map..." />}>
              <NutritionCentersMap
                embedded
                user={user}
                onBack={() => {
                  setShowNutritionCentersMap(false);
                  const currentWvPage = window.history.state?.wvPage;
                  if (currentWvPage && currentWvPage !== 'main') window.history.back();
                }}
                onEditCenter={(center) => {
                  setEditCenterData(center);
                  setShowRegisterCenter(true);
                }}
                onRegisterCenter={() => {
                  setEditCenterData(null);
                  setShowRegisterCenter(true);
                }}
              />
            </Suspense>
          </div>
        </div>
        {showRegisterCenter && (
          <Suspense fallback={null}>
            <NutritionCenterRegistration
              user={user}
              initialCenter={editCenterData}
              onBack={() => {
                setShowRegisterCenter(false);
                setEditCenterData(null);
              }}
            />
          </Suspense>
        )}
      </>
    );
  } else if (showTestimonials) {
    homeOverlay = (
      <div className="ios-full-page bg-gray-50">
        <Header
          navOnly
          user={user}
          userRole={userRole}
          activePage="testimonials"
          onShowHome={() => navigateTo('home')}
          onShowBackgroundHistory={() => navigateTo('dashboard')}
          onShowWellnessEnrollment={() => navigateTo('enrollment')}
          onShowWellnessCounselling={() => navigateTo('counselling')}
          onShowNutritionCentersMap={() => navigateTo('physical-club')}
          onShowActivityReport={() => navigateTo('activity-report')}
          onShowTestimonials={() => navigateTo('testimonials')}
          onShowReports={() => navigateTo('reports')}
        />
        <div className="ios-scroll-body">
          <Suspense fallback={<LoadingSpinner message="Loading testimonials�" />}>
            <TestimonialsPage
              user={{ userId: user?.id ?? userContext?.userId ?? null }}
              userRole={userRole}
              onBack={() => {
                setShowTestimonials(false);
                const currentWvPage = window.history.state?.wvPage;
                if (currentWvPage && currentWvPage !== 'main') window.history.back();
              }}
            />
          </Suspense>
        </div>
      </div>
    );
  } else if (showWellnessScoreSetup && isFlagEnabled('ff.wellness-score-sheet') && adminLikeRole) {
    homeOverlay = (
      <Suspense fallback={<LoadingSpinner message="Loading Wellness Score Setup..." />}>
        <WellnessScoreSetup
          user={user}
          apiBaseUrl={apiBaseUrl}
          onBack={() => {
            setShowWellnessScoreSetup(false);
            const currentWvPage = window.history.state?.wvPage;
            if (currentWvPage && currentWvPage !== 'main') window.history.back();
          }}
        />
      </Suspense>
    );
  } else if (showWellnessScore && isFlagEnabled('ff.wellness-score-sheet')) {
    homeOverlay = (
      <Suspense fallback={<LoadingSpinner message="Loading Wellness Score..." />}>
        <WellnessScorePage
          user={user}
          apiBaseUrl={apiBaseUrl}
          nutritionRefreshKey={nutritionRefreshKey}
          onBack={() => {
            setShowWellnessScore(false);
            const currentWvPage = window.history.state?.wvPage;
            if (currentWvPage && currentWvPage !== 'main') window.history.back();
          }}
        />
      </Suspense>
    );
  } else if (showReports && isFlagEnabled('ff.reports-module')) {
    homeOverlay = (
      <div className="ios-full-page bg-gray-50">
        <Header
          navOnly
          user={user}
          userRole={userRole}
          activePage="reports"
          onShowHome={() => navigateTo('home')}
          onShowBackgroundHistory={() => navigateTo('dashboard')}
          onShowWellnessEnrollment={() => navigateTo('enrollment')}
          onShowWellnessCounselling={() => navigateTo('counselling')}
          onShowNutritionCentersMap={() => navigateTo('physical-club')}
          onShowActivityReport={() => navigateTo('activity-report')}
          onShowTestimonials={() => navigateTo('testimonials')}
          onShowReports={() => navigateTo('reports')}
        />
        <div className="ios-scroll-body">
          <Suspense fallback={<LoadingSpinner message="Loading reports�" />}>
            <DownlineWeightReport
              user={user}
              onBack={() => {
                setShowReports(false);
                const currentWvPage = window.history.state?.wvPage;
                if (currentWvPage && currentWvPage !== 'main') window.history.back();
              }}
            />
          </Suspense>
        </div>
      </div>
    );
  }

  // Main app interface — Home stays mounted under overlays (display:none)
  return (
    <>
      <div
        style={{ display: homeOverlay ? 'none' : undefined }}
        aria-hidden={Boolean(homeOverlay)}
      >
    <LocationGuard>
      <div
        className="ios-full-page"
        style={{
          background: 'linear-gradient(180deg, #ecfdf5 0%, #f0fdf4 100%)',
        }}
      >
        {/* -- Permission denied modal (canRequest: true) ---------------------
          Shown after a first denial when the OS can still present a dialog.
          Small overlay card: "<Perm> permission is required to continue."
          [ Allow Again ] immediately re-invokes the native OS dialog.
          [ Exit ] closes the app.
          When the user denies a second time (Android "Don't ask again") the
          state flips to canRequest: false and React automatically unmounts
          this modal and mounts PermissionBlockedPage instead. */}
        {activePermission?.canRequest === true && (
          <PermissionDeniedModal
            type={activePermission.type}
            config={PermissionManager.PERMISSION_CONFIG[activePermission.type]}
            onAllow={() => handlePermissionAllow(activePermission.type)}
            onExit={() => { import('@capacitor/app').then(({ App: CApp }) => CApp.exitApp()); }}
            loading={permissionDialogLoading}
          />
        )}

        {/* -- Permission blocked page (canRequest: false) ----------------------
          Full-screen page for permanently denied permissions.
          Shown when Android reports "Don't ask again" or iOS denies (permanent).
          Provides per-permission title + description + "Open App Settings".
          The resume listener (above) auto-dismisses this page when the user
          grants the permission from device Settings and returns to the app. */}
        {activePermission?.canRequest === false && (
          <PermissionBlockedPage
            type={activePermission.type}
            config={PermissionManager.PERMISSION_CONFIG[activePermission.type]}
            onOpenSettings={() => {
              if (activePermission.type === 'location') {
                nativeLifecycle.openLocationPermissionSettings();
              } else {
                PermissionManager.openAppSettings();
              }
            }}
            onExit={() => { import('@capacitor/app').then(({ App: CApp }) => CApp.exitApp()); }}
          />
        )}

        {/* GPS required � shown when location permission is granted but Location
          Services (GPS) are off. Blocks all app usage until GPS is enabled.
          App.js permission resume listener re-checks GPS on every app-foreground
          event and auto-dismisses this modal when GPS is confirmed on. */}
        {showGpsRequired && (
          <GpsRequiredModal
            platform={Capacitor.getPlatform()}
            onOpenSettings={() => nativeLifecycle.openLocationSettings()}
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
                <Sparkles
                  size={20}
                  color="#FFD700"
                  aria-hidden="true"
                  style={{
                    flexShrink: 0,
                    animation: "_wb_stars_spin 3s linear infinite",
                  }}
                />

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
          onShowHome={showMainPage}
          onShowWellnessEnrollment={() => {
            if (enrollmentHistoryPushedRef.current || showUniversityEnrollment) return;
            enrollmentHistoryPushedRef.current = true;
            setShowUniversityEnrollment(true);
            window.history.pushState({ wvPage: 'enrollment' }, '');
          }}
          onShowWellnessCounselling={() => {
            if (showWellnessCounselling) return;
            setShowWellnessCounselling(true);
            window.history.pushState({ wvPage: 'counselling' }, '');
          }}
          onShowNutritionCentersMap={() => {
            if (!showNutritionCentersMap) {
              window.history.pushState({ wvPage: 'physical-club' }, '');
            }
            setShowNutritionCentersMap(true);
          }}
          onShowActivityReport={() => navigateTo('activity-report')}
          onShowTestimonials={() => navigateTo('testimonials')}
          onShowReports={() => navigateTo('reports')}
          onShowWellnessScoreSetup={() => navigateTo('wellness-score-setup')}
          wellnessScoreSetupEnabled={['admin', 'developer'].includes(userRole) && isFlagEnabled('ff.wellness-score-sheet')}
          activePage={
            showDashboard ? 'dashboard' :
            showUniversityEnrollment ? 'enrollment' :
            showWellnessCounselling ? 'counselling' :
            showNutritionCentersMap ? 'physical-club' :
            showActivityReport || showActivityTimeReport ? 'activity-report' :
            showTestimonials ? 'testimonials' :
            showReports ? 'reports' :
            showWellnessScoreSetup ? 'wellness-score-setup' :
            'home'
          }
          onShowRegisterCenter={null}
          onSignOut={handleSignOut}
          onLeaderboardRefresh={handleLeaderboardRefresh}
          onOpenProfile={() => {
            if (onboardingBlockingRef.current) return;
            navigateTo('profile');
          }}
          profileKey={headerProfileKey}
          // manualModeActive={manualModeActive}   // AI TOGGLE DISABLED
          // onToggleManualMode={toggleManualMode}  // AI TOGGLE DISABLED
          onProfileSaved={(profileData) => {
            const email = user?.email || Session.getUserEmail() || "";
            profileCompletedRef.current = false;
            checkProfileCompletion(email, null, { afterSave: true });
            if (profileData?.name?.trim()) {
              setSavedUserName(profileData.name.trim());
              cacheProfileUserName(email, profileData.name);
            }
            // If a new BMR was saved, force NutritionDashboard to re-fetch it
            if (profileData?.bmr || profileData?.physicalActivityLevel) {
              setBmrUpdateKey((prev) => prev + 1);
            }
            triggerNutritionRefresh({ immediate: true, source: 'profile-saved' });
            setBodyParamsRefreshKey((k) => k + 1);
          }}
        />

        {/* Weight Loss Leaderboard Strip - Configure in src/config/leaderboardConfig.js */}
        <WeightLossLeaderboard
          ref={leaderboardRef}
          apiBaseUrl={apiBaseUrl}
          topN={LEADERBOARD_CONFIG.TOP_N}
        />

        {/* Wellness Score Leaderboard — top 10 today's IST wellness % */}
        {isFlagEnabled('ff.wellness-score-sheet') && (
          <WellnessScoreLeaderboard
            ref={wellnessLeaderboardRef}
            apiBaseUrl={apiBaseUrl}
            topN={10}
          />
        )}

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

            {/* -- Hero banner: greeting + Camera / Gallery CTAs (always visible) -- */}
            <div className="mx-1 mt-1 rounded-2xl overflow-hidden shadow-lg"
                style={{ background: 'linear-gradient(135deg, #064e3b 0%, #065f46 45%, #047857 100%)' }}>
                <div className="px-2 py-3">
                  {/* Date pill */}
                  <div className="flex items-center justify-between">
                    {/* Date */}
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">
                      {new Date().toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>

                    {/* Greeting */}
                   <h2 className="text-xs font-bold text-white text-right">
  {(() => {
    const h = new Date().getHours();
    const firstName = (savedUserName || user?.displayName || '').split(' ')[0];

    const name = firstName
      ? firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase()
      : '';

    const greeting =
      h < 12
        ? 'Good Morning'
        : h < 17
        ? 'Good Afternoon'
        : 'Good Evening';

    return name
      ? `${greeting}, ${name}! 👋`
      : `${greeting}! 👋`;
  })()}
</h2>
                  </div>

                  {/* Camera � primary CTA opens camera directly; gallery icon for choosing existing photo */}
                  <div className="mt-5 flex gap-3">
                    <button
                      onClick={() => fileInputRef.current?.openCamera?.()}
                      disabled={loading}
                      className="flex-1 flex items-center justify-center gap-2.5 bg-white rounded-xl py-3 shadow-sm active:scale-95 transition-transform disabled:opacity-50"
                      aria-label="Open camera"
                    >
                      <svg className="w-5 h-5 text-emerald-700" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="text-sm font-bold text-emerald-700">Take Photo</span>
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.openGallery?.()}
                      disabled={loading}
                      className="flex items-center justify-center gap-1.5 bg-white rounded-xl px-4 py-3 shadow-sm active:scale-95 transition-transform disabled:opacity-50"
                      aria-label="Choose from gallery"
                    >
                      <svg className="w-5 h-5 text-emerald-700" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-sm font-bold text-emerald-700">Gallery</span>
                    </button>
                  </div>
                </div>
              </div>

            {/* Today's Nutrition Carousel � Calories � Macros � Heart Healthy � Low Carb */}
            <HomeNutritionCarousel
              user={user}
              apiBaseUrl={apiBaseUrl}
              bmrUpdateKey={bmrUpdateKey}
              nutritionRefreshKey={nutritionRefreshKey}
              watchBurnedCalories={watchBurnedCalories}
              onOpenWellnessScore={() => navigateTo('wellness-score')}
              onOpenWellnessScoreSetup={
                ['admin', 'developer'].includes(userRole)
                  ? () => navigateTo('wellness-score-setup')
                  : undefined
              }
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
                  foodNames={detectedFoodNames}
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
                {/* Off-screen weight share card \xe2\x80\x94 captured by precaptureShareImage for instant share */}
                <WeightShareCard
                  ref={weightAnalysisShareRef}
                  user={user}
                  savedUserName={savedUserName}
                  savedProfileImage={savedProfileImage}
                  sharePhotoBase64={sharePhotoBase64}
                  imagePreview={imagePreview}
                  weightResult={weightResult}
                  weightDiff={weightDiff}
                  idealWeight={idealWeight}
                />

                {/* Visible weight result card */}
                <WeightResultCard
                  weightResult={weightResult}
                  weightDiff={weightDiff}
                  idealWeight={idealWeight}
                  isEditingWeight={isEditingWeight}
                  editWeightValue={editWeightValue}
                  isSavingWeightEdit={isSavingWeightEdit}
                  weightEditError={weightEditError}
                  setEditWeightValue={setEditWeightValue}
                  setIsEditingWeight={setIsEditingWeight}
                  setWeightEditError={setWeightEditError}
                  handleWeightEditSave={handleWeightEditSave}
                />
              </>
            )}


            {/* Saving Toast � hidden during async capture (photo already saved) */}
            {saveLoading && loadingState !== "saved" && (
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

            {/* Error Toast � hidden during async capture; analysis errors live in Diary only */}
            {saveError && loadingState !== "saved" && (
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

            {/* Safe-area bottom padding */}
            <div style={{ minHeight: 'env(safe-area-inset-bottom, 12px)', height: 'env(safe-area-inset-bottom, 12px)' }} />

          </div>{/* end max-w-lg inner */}
        </div>{/* end flex-1 scroll area */}

        {/* Inactive User Modal */}
        {showInactiveModal && (
          <InactiveUserModal
            userEmail={user?.email || user?.Email || "your account"}
            coachName={inactiveCoachName}
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

        {/* Email Gate removed — email is collected on CompleteProfilePage */}

        {showPhysicalActivitySetup && user && !showCompleteProfile && !showSetupWizard && !showValidateOTP && (
          <PhysicalActivitySetup
            user={user}
            apiBaseUrl={apiBaseUrl}
            onComplete={async () => {
              const email =
                user?.email || user?.Email || Session.getUserEmail() || "";
              // Resolve coach gate while this screen is still visible, then switch.
              setCoachSetupResolved(false);
              await resolveCoachSetupStatus(email);
              setCoachSetupResolved(true);
              setShowPhysicalActivitySetup(false);
              setPhysicalActivityResolved(true);
              setBmrUpdateKey((prev) => prev + 1);
            }}
          />
        )}

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

        <UserProfileModal
          isOpen={showNewUserProfileModal}
          onClose={() => setShowNewUserProfileModal(false)}
          user={user}
          onProfileUpdate={() => {
            debugLog("? [NewUserProfile] Profile updated successfully");
            setBodyParamsRefreshKey((k) => k + 1);
            triggerNutritionRefresh({ immediate: true, source: 'new-user-profile' });
          }}
        />

        {/* -- Mandatory Profile Completion Gate (first onboarding screen) -----
           Name, email, gender, height, diet, photo — then activity → coach → OTP → camera.
      ------------------------------------------------------------------- */}
        {showCompleteProfile && !profileChecking && user && (
          <CompleteProfilePage
            user={user}
            apiBaseUrl={apiBaseUrl}
            showPictureSection={true}
            snoozeData={profilePicSnoozeData}
            userId={user.id || user.UserId || Session.getDbUserId()}
            onComplete={async (savedData) => {
              const savedEmail =
                savedData?.email
                || user?.email
                || user?.Email
                || Session.getUserEmail()
                || "";
              if (savedEmail) {
                Session.setUserEmail(savedEmail);
                Session.markProfileComplete(savedEmail);
                const cachedRaw = Session.getOtpUserRaw();
                if (cachedRaw) {
                  try {
                    const cached = JSON.parse(cachedRaw);
                    Session.setOtpUser({
                      ...cached,
                      email: savedEmail,
                      ...(savedData?.userName
                        ? { username: savedData.userName, userName: savedData.userName }
                        : {}),
                    });
                  } catch { /* non-fatal */ }
                }
              }
              profileCompletedRef.current = true;

              setUser((prevUser) => {
                if (!prevUser) return prevUser;
                return {
                  ...prevUser,
                  email: savedEmail || prevUser.email,
                  username: savedData?.userName || prevUser.username,
                  userName: savedData?.userName || prevUser.userName,
                  ...(savedData?.profileImage
                    ? {
                        profileImage: savedData.profileImage,
                        ProfileImage: savedData.profileImage,
                        photoURL: savedData.profileImage,
                      }
                    : {}),
                };
              });
              if (savedData?.userName && savedEmail) {
                cacheProfileUserName(savedEmail, savedData.userName);
                setSavedUserName(savedData.userName);
              }

              // Prefetch next gate while this screen is still up, then switch in one paint.
              let needActivity = true;
              if (savedEmail) {
                try {
                  const { data } = await fetchProfile(savedEmail);
                  needActivity = !(data && data.physicalActivityLevel);
                } catch {
                  needActivity = true;
                }
              }

              if (needActivity) {
                setShowPhysicalActivitySetup(true);
                setPhysicalActivityResolved(true);
                setCoachSetupResolved(false);
              } else {
                setShowPhysicalActivitySetup(false);
                setPhysicalActivityResolved(true);
                setCoachSetupResolved(false);
                await resolveCoachSetupStatus(savedEmail);
                setCoachSetupResolved(true);
              }

              setShowCompleteProfile(false);
              setProfileChecking(false);
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

        {/* Register Nutrition Center (main app � when not on Physical Club full page) */}
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

        {/* Setup Wizard - Coach Selection (after profile + physical activity) */}
        {showSetupWizard && !showCompleteProfile && !showPhysicalActivitySetup && (
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
              userEmail={user?.email || user?.Email || Session.getUserEmail()}
              coachName={isInactiveReactivationFlow ? inactiveCoachName || undefined : undefined}
              onClose={() => {
                console.log("?? [ValidateOTP onClose] User closed modal", {
                  isInactiveReactivationFlow,
                });
                setShowValidateOTP(false);
                if (isInactiveReactivationFlow) {
                  isInactiveReactivationFlowRef.current = false;
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
                if (isInactiveReactivationFlow) {
                  handleInactiveReactivationSuccess();
                  return;
                }
                setShowValidateOTP(false);
                // Coach OTP verified — profile + activity already done earlier.
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

        {/* Waiting for coach OTP — portal so it renders above all other layers */}
        {isWaitingForCoachOTP &&
          ReactDOM.createPortal(<WaitingForCoachModal />, document.body)}
      </div>
    </LocationGuard>
      </div>
      {homeOverlay}
    </>
  );
}

// Wrap app in NutritionRefreshProvider for global nutrition data refresh
const AppWithProviders = () => (
  <NutritionRefreshProvider>
    <WellnessValleyApp />
  </NutritionRefreshProvider>
);

export default AppWithProviders;






