/**
 * CaptureClassifyPage — full-screen post-capture: pick type manually, or
 * during lunch (with AI credits) auto-start background AI (no Auto Detect button).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dumbbell,
  Loader2,
  Salad,
  Star,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { isFlagEnabled } from '../../config/featureFlags';
import {
  promoteUnknownToFood,
  deleteCapture,
} from '../../features/captures';
import {
  SmartFoodSearchModal,
  ShakeCalculatorModal,
  ServingStepperModal,
  buildWaterAnalysisResult,
  buildAfreshAnalysisResult,
  AFRESH_PRODUCT,
  buildAnalysisFromManualFood as buildManualFoodAnalysis,
  fetchWatchBurnedCalories,
} from '../../features/nutrition';
import { seedMealAfterPromotion } from '../../features/nutrition/services/seedMealAfterPromotion';
import {
  ManualWeightEntryModal,
  saveWeight,
  warmLatestWeightCache,
  getCachedLatestWeight,
  computeIdealWeightRange,
  pickIdealWeightKg,
} from '../../features/weight';
import { getProfile, getCachedProfile } from '../../features/user/services/user.api';
import { ManualEducationEntryModal, saveLog } from '../../features/education';
import { ManualWatchEntryModal } from '../../features/activity';
import {
  fetchAiCreditsStatus,
  reserveAiCredit,
  getAiCreditUiState,
  reserveFailureMessage,
  decideLunchAutoAi,
} from '../../features/ai-credits';
import { fetchWaterIntake, todayLocal } from '../../features/water';
import { isIOS } from '../../shared/utils/platform';
import { buildDiaryShareSuffix, extractFoodShareItems } from '../../features/diary';
import { useNutritionRefreshOptional } from '../../shared/context/NutritionRefreshContext';
import { refreshDailyWellnessScoreAfterSave } from '../../features/wellness-score-sheet/services/refreshDailyWellnessScoreNow';
import { prefetchTimeWindows } from '../../features/wellness-score-sheet/hooks/useTimeWindows';
import GoodHabitFlow from './GoodHabitFlow';
import { saveGoodHabit } from '../../features/good-habits';
import {
  MANUAL_LOG_CATEGORY,
  DRY_SALAD_META,
  resolveManualLogCategoryClick,
} from '../domain/manualLogCategories';

/** PNG/SVG from `frontend/public` — same pattern as BathroomScaleIcon. */
function PublicIcon({ src, className = '', alt = '' }) {
  const base = process.env.PUBLIC_URL || '';
  return (
    <img
      src={`${base}${src}`}
      alt={alt}
      draggable={false}
      className={`inline-block select-none object-contain ${className}`}
    />
  );
}

const CATEGORIES = [
  { id: MANUAL_LOG_CATEGORY.WEIGHT, src: '/scale.png', label: 'Weight', isImgIcon: true },
  { id: MANUAL_LOG_CATEGORY.AFRESH, src: '/coffee.png', label: 'Afresh', isImgIcon: true },
  { id: MANUAL_LOG_CATEGORY.EDUCATION, src: '/education.svg', label: 'Education', isImgIcon: true },
  { id: MANUAL_LOG_CATEGORY.SHAKE, src: '/bottle.png', label: 'Shake', isImgIcon: true },
  { id: MANUAL_LOG_CATEGORY.WATER, src: '/water.svg', label: 'Water', isImgIcon: true },
  { id: MANUAL_LOG_CATEGORY.FOOD, Icon: UtensilsCrossed, label: 'Food' },
  {
    id: MANUAL_LOG_CATEGORY.DRY_SALAD,
    Icon: Salad,
    label: 'Target Nutrition',
  },
  // smartwatch flow = calories burned; label is Workout (green weightlifter / Lucide on iOS)
  {
    id: MANUAL_LOG_CATEGORY.SMARTWATCH,
    src: '/emoji/1f3cb-green.svg',
    label: 'Workout',
    isImgIcon: true,
    Icon: Dumbbell,
  },
  { id: MANUAL_LOG_CATEGORY.GOOD_HABIT, Icon: Star, label: 'Good Habit' },
];

/** Home hero banner greens — keep classify screen on-brand with Take Photo card. */
const BRAND = {
  pageBg: '#e8f5e9',
  hero: 'linear-gradient(135deg, #064e3b 0%, #065f46 45%, #047857 100%)',
  mint: '#e8f5e9',
  forest: '#064e3b',
  active: '#16a34a',
};

/** Shared Log-as button chrome — fills one cell in the 3×4 grid. */
const LOG_AS_BTN_BASE =
  'log-as-btn flex h-full min-h-0 w-full min-w-0 flex-col items-center justify-center gap-0.5 overflow-hidden rounded-xl px-1 py-1.5 text-center cursor-pointer select-none transition-[transform,box-shadow,background-color,border-color] duration-150 ease-out disabled:pointer-events-none disabled:opacity-50 min-[360px]:gap-1 min-[360px]:px-1.5 min-[360px]:py-2';

/** Label under icon — wraps up to 2 lines in grid cells. */
const LOG_AS_LABEL =
  'w-full min-w-0 max-w-full px-0.5 text-center font-bold leading-[1.15] text-emerald-900 line-clamp-2 whitespace-normal text-[9px] min-[360px]:text-[10px] min-[400px]:text-[11px] sm:text-[12px]';

const LOG_AS_BTN_IDLE = [
  LOG_AS_BTN_BASE,
  'log-as-btn--idle border-2 bg-gradient-to-b from-white to-emerald-50/70',
  'border-emerald-200/90 text-emerald-900',
  'shadow-[0_3px_0_0_rgba(6,95,70,0.22)]',
  'active:translate-y-[2px] active:shadow-[0_1px_0_0_rgba(6,95,70,0.18)]',
].join(' ');

function LogAsIconWrap({ selected = false, muted = false, compact = true, children }) {
  return (
    <span
      className={[
        'flex shrink-0 items-center justify-center',
        compact
          ? 'h-6 w-6 min-[360px]:h-7 min-[360px]:w-7 min-[400px]:h-8 min-[400px]:w-8 sm:h-9 sm:w-9'
          : 'h-8 w-8 min-[360px]:h-9 min-[360px]:w-9 min-[400px]:h-10 min-[400px]:w-10 sm:h-11 sm:w-11',
        selected
          ? 'rounded-full bg-white/15 ring-1 ring-white/25'
          : muted
            ? 'rounded-full bg-gray-100 text-gray-400'
            : 'text-emerald-700',
      ].join(' ')}
    >
      {children}
    </span>
  );
}

function buildAnalysisFromManualFood(m) {
  // Re-exported helper keeps micros from master/history search selections.
  return buildManualFoodAnalysis(m);
}

/** Shake calculator payload → promoteUnknownToFood analysis shape (same as AI). */
function shakePayloadToAnalysis(payload) {
  const shakeProducts = payload?.shakeProducts || null;
  const foods = (payload?.detailedItems || []).map((item) => ({
    name: item.name,
    nutrition: item.nutrition || {},
    portion: item.portionDescription || item.portion,
    weight_g: item.weight_g,
    volume_ml: item.volume_ml,
    unit: item.unit,
    isLiquid: item.isLiquid,
    shakeProducts: item.shakeProducts || shakeProducts || null,
  }));
  return {
    foods,
    total: payload?.nutrition || {},
    confidence: payload?.confidence || 'high',
    processedBy: payload?.processedBy || 'shake_calculator',
    shakeProducts,
  };
}

export default function ManualEntryPage({
  userId,
  userEmail = null,
  apiBaseUrl,
  captureId,
  imageBase64,
  originalCapturedAt = null,
  /**
   * Post-camera/gallery: Cancel removes the orphan capture (Don't Log).
   * Diary re-classify: Cancel only closes — the existing diary row must stay.
   */
  discardCaptureOnCancel = true,
  onBack,
  onSaved,
  onStartBackgroundAi,
  onToast,
}) {
  const nutritionRefresh = useNutritionRefreshOptional();
  const refreshAfterPersist = useCallback((source) => {
    // Fire only after DB write — early refresh locks in a stale Home/sheet total.
    nutritionRefresh?.triggerRefresh({ immediate: true, source });
    void refreshDailyWellnessScoreAfterSave({ userId, apiBaseUrl });
  }, [nutritionRefresh, userId, apiBaseUrl]);

  const creditsEnabled = isFlagEnabled('ff.ai-credits');
  const goodHabitEnabled = isFlagEnabled('ff.good-habit');
  const [credits, setCredits] = useState(null);
  // Start loading=true so first paint never flashes green "Analyze" before status returns.
  const [creditsLoading, setCreditsLoading] = useState(() => isFlagEnabled('ff.ai-credits'));
  const [aiStarting, setAiStarting] = useState(false);
  const [hint, setHint] = useState(null);
  const [activeForm, setActiveForm] = useState(null);
  /** When food search opened from Snacks & Soups subtypes. */
  const [foodEntryMeta, setFoodEntryMeta] = useState(null);
  const [closingWithoutLog, setClosingWithoutLog] = useState(false);
  /** Full-screen preview of the captured photo. */
  const [previewExpanded, setPreviewExpanded] = useState(false);
  // Today's hydration total (all exempted beverages) — water stepper tracks this.
  const [waterTodayMl, setWaterTodayMl] = useState(0);
  const [waterTodayLoading, setWaterTodayLoading] = useState(false);
  // Today's Afresh scoops only — independent of water ml total.
  const [afreshTodayScoops, setAfreshTodayScoops] = useState(0);
  const [afreshTodayLoading, setAfreshTodayLoading] = useState(false);
  // True after light /api/water/intake has returned once (prefetch or open).
  const beverageSummaryReadyRef = useRef(false);
  const [workoutTodayKcal, setWorkoutTodayKcal] = useState(0);
  const [workoutTodayLoading, setWorkoutTodayLoading] = useState(false);
  // True after light watch-calories has returned once (prefetch or open).
  const workoutSummaryReadyRef = useRef(false);
  // BMI 19–23 range from profile height — warmed so share caption is sync on Save.
  const idealWeightRangeRef = useRef(null);

  useEffect(() => {
    if (!userEmail) {
      idealWeightRangeRef.current = null;
      return undefined;
    }
    const cached = getCachedProfile(userEmail);
    if (cached?.data?.height) {
      idealWeightRangeRef.current = computeIdealWeightRange(cached.data.height);
    }
    let cancelled = false;
    getProfile(userEmail)
      .then((res) => {
        if (cancelled) return;
        idealWeightRangeRef.current = computeIdealWeightRange(res?.data?.height);
      })
      .catch(() => {
        // Non-critical: WhatsApp caption omits Ideal when height is unavailable.
      });
    return () => { cancelled = true; };
  }, [userEmail]);

  // Capture row must exist before LOG AS / AI can finish. Upload runs in the
  // background — UI stays interactive; taps are queued until captureId arrives.
  const captureReady = Boolean(captureId);
  const [pendingLogAsId, setPendingLogAsId] = useState(null);
  const [pendingAi, setPendingAi] = useState(false);
  /** Lunch auto-AI may run once per capture (no Auto Detect button). */
  const lunchAutoAttemptedRef = useRef(false);

  // New capture while this screen stays mounted — close any open sub-form.
  // Do not clear pendingLogAsId / pendingAi here: captureId often flips null → id
  // on the same mount, and those pending taps must flush once ready.
  useEffect(() => {
    setActiveForm(null);
    setFoodEntryMeta(null);
    setPreviewExpanded(false);
    lunchAutoAttemptedRef.current = false;
  }, [captureId]);

  const previewSrc = useMemo(() => {
    if (!imageBase64) return null;
    return imageBase64.startsWith('data:')
      ? imageBase64
      : `data:image/jpeg;base64,${imageBase64}`;
  }, [imageBase64]);

  const refreshCredits = useCallback(async () => {
    if (!creditsEnabled || !userId) {
      setCreditsLoading(false);
      return;
    }
    setCreditsLoading(true);
    try {
      const data = await fetchAiCreditsStatus({ userId, apiBaseUrl });
      setCredits(data);
    } catch {
      setCredits(null);
    } finally {
      setCreditsLoading(false);
    }
  }, [creditsEnabled, userId, apiBaseUrl]);

  // Fetch credits on mount (parallel with capture upload) so lunch auto-AI
  // can decide as soon as the capture row exists.
  useEffect(() => {
    refreshCredits();
  }, [captureReady, refreshCredits]);

  const creditUi = useMemo(() => getAiCreditUiState(credits), [credits]);

  // When slots are temporarily held (pending), poll quietly — no scary lock UI.
  useEffect(() => {
    if (!captureReady || creditUi.phase !== 'busy') return undefined;
    const id = setInterval(() => refreshCredits(), 15_000);
    return () => clearInterval(id);
  }, [captureReady, creditUi.phase, refreshCredits]);

  // Light beverage summary (AnalysisData only — no images). Powers water ml + Afresh scoops.
  const loadBeverageToday = useCallback((opts = {}) => {
    const { showWaterLoading = false, showAfreshLoading = false } = opts;
    if (!userId) return () => {};
    let cancelled = false;
    if (showWaterLoading) setWaterTodayLoading(true);
    if (showAfreshLoading) setAfreshTodayLoading(true);
    fetchWaterIntake(userId, todayLocal())
      .then((data) => {
        if (cancelled) return;
        setWaterTodayMl(Math.max(0, Math.round(Number(data?.totalMl) || 0)));
        setAfreshTodayScoops(Math.max(0, Math.round(Number(data?.totalAfreshScoops) || 0)));
        beverageSummaryReadyRef.current = true;
      })
      .catch(() => {
        if (cancelled) return;
        if (showWaterLoading) setWaterTodayMl(0);
        if (showAfreshLoading) setAfreshTodayScoops(0);
      })
      .finally(() => {
        if (cancelled) return;
        if (showWaterLoading) setWaterTodayLoading(false);
        if (showAfreshLoading) setAfreshTodayLoading(false);
      });
    return () => { cancelled = true; };
  }, [userId]);

  // Light watch-calories summary — prefetch so Workout opens without a spinner wait.
  const loadWorkoutToday = useCallback((opts = {}) => {
    const { showLoading = false } = opts;
    if (!userId) return () => {};
    let cancelled = false;
    if (showLoading) setWorkoutTodayLoading(true);
    fetchWatchBurnedCalories({ apiBaseUrl, userId, date: todayLocal() })
      .then((total) => {
        if (cancelled) return;
        setWorkoutTodayKcal(Math.max(0, Math.round(Number(total) || 0)));
        workoutSummaryReadyRef.current = true;
      })
      .catch(() => {
        if (cancelled) return;
        if (showLoading) setWorkoutTodayKcal(0);
      })
      .finally(() => {
        if (cancelled) return;
        if (showLoading) setWorkoutTodayLoading(false);
      });
    return () => { cancelled = true; };
  }, [userId, apiBaseUrl]);

  // Prefetch beverage / workout summaries only after capture is saved (idle).
  useEffect(() => {
    if (!userId || !captureReady) return undefined;
    beverageSummaryReadyRef.current = false;
    workoutSummaryReadyRef.current = false;
    let cancelled = false;
    let idleId = null;
    let timeoutId = null;
    const start = () => {
      if (cancelled) return;
      loadBeverageToday();
      loadWorkoutToday();
      warmLatestWeightCache(userId);
    };
    if (typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(start, { timeout: 1200 });
    } else {
      timeoutId = setTimeout(start, 120);
    }
    return () => {
      cancelled = true;
      if (idleId != null && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId != null) clearTimeout(timeoutId);
    };
  }, [userId, captureReady, loadBeverageToday, loadWorkoutToday]);

  // Refresh when stepper opens. Spinner only if prefetch has not finished yet.
  useEffect(() => {
    if (activeForm === 'water') {
      return loadBeverageToday({ showWaterLoading: !beverageSummaryReadyRef.current });
    }
    if (activeForm === 'afresh') {
      return loadBeverageToday({ showAfreshLoading: !beverageSummaryReadyRef.current });
    }
    return undefined;
  }, [activeForm, loadBeverageToday]);

  useEffect(() => {
    if (activeForm !== 'smartwatch') return undefined;
    return loadWorkoutToday({ showLoading: !workoutSummaryReadyRef.current });
  }, [activeForm, loadWorkoutToday]);

  const exit = (shareMeta = null) => {
    // Leave classify immediately — share sheet opens from App in the background.
    // onSaved must read imageBase64 synchronously before onBack clears the payload.
    onSaved?.(shareMeta);
    onBack?.();
  };

  /** Close classify — optionally discard a new capture (not when opened from Diary). */
  const handleCloseWithoutLog = () => {
    if (closingWithoutLog) return;
    // Allow cancel while Auto Detect is only queued (photo still saving).
    if (aiStarting && !pendingAi) return;
    setPendingLogAsId(null);
    setPendingAi(false);
    setAiStarting(false);
    setClosingWithoutLog(true);
    const id = captureId;
    const uid = userId;
    // Leave immediately — awaiting delete felt like a hang under network load.
    onBack?.();
    if (discardCaptureOnCancel && id && uid) {
      void deleteCapture({ captureId: id, userId: uid }).catch(() => {
        onToast?.("Couldn't discard photo — it may still appear in Diary.");
      });
    }
  };

  const saveFoodAnalysis = (analysisResult, toastMsg, activityCaption = null) => {
    // Close classify immediately — promote runs in background (same as Food).
    onToast?.(toastMsg);
    void promoteUnknownToFood({
      captureId,
      viewerUserId: userId,
      analysisResult,
      originalCapturedAt: originalCapturedAt || null,
    })
      .then((result) => {
        seedMealAfterPromotion({
          ownerUserId: userId,
          result,
          analysisResult,
          capturedAt: originalCapturedAt || null,
        });
        refreshAfterPersist('manual-log-persisted');
      })
      .catch((err) => {
        onToast?.(err?.message || "Couldn't save — check Diary.");
      });
    exit(activityCaption ? { activityCaption } : null);
  };

  const openCategory = useCallback((id) => {
    const next = resolveManualLogCategoryClick(id);
    if (!next) return;
    if (next.kind === 'dry-salad') {
      setFoodEntryMeta({
        fromDrySalad: true,
        headerTitle: DRY_SALAD_META.headerTitle,
        headerSubtitle: DRY_SALAD_META.headerSubtitle,
      });
      setActiveForm(MANUAL_LOG_CATEGORY.FOOD);
      return;
    }
    if (next.kind === 'good-habit-picker') {
      setFoodEntryMeta(null);
      setActiveForm(MANUAL_LOG_CATEGORY.GOOD_HABIT);
      return;
    }
    setFoodEntryMeta(null);
    setActiveForm(next.formId);
  }, []);

  const startAiAnalyze = useCallback(async () => {
    if (!userId || !imageBase64 || !captureId) return;
    setHint(null);
    setAiStarting(true);
    try {
      let reservationId = null;
      if (creditsEnabled) {
        const reserved = await reserveAiCredit({ userId, apiBaseUrl });
        setCredits(reserved);
        if (!reserved?.allowed || !reserved.reservationId) {
          setHint(reserveFailureMessage(reserved?.reason));
          setAiStarting(false);
          return;
        }
        reservationId = reserved.reservationId;
      }
      // Pass ids directly — App must not re-read manualEntryPayload (stale closure).
      onStartBackgroundAi?.({ reservationId, captureId, imageBase64, userId });
      exit();
    } catch (err) {
      setHint(err?.message || 'Could not start AI — pick a type below.');
      setAiStarting(false);
    }
  }, [userId, imageBase64, captureId, creditsEnabled, apiBaseUrl, onStartBackgroundAi, exit]);

  // Lunch window + remaining AI credits → auto-start detection (no button).
  // Breakfast / dinner / exhausted credits stay on manual Log-as.
  // Diary re-classify (discardCaptureOnCancel=false) stays manual — no surprise AI.
  useEffect(() => {
    if (!discardCaptureOnCancel) return undefined;
    if (!captureReady || !userId || !imageBase64) return undefined;
    if (lunchAutoAttemptedRef.current) return undefined;
    if (aiStarting || pendingAi || closingWithoutLog) return undefined;
    if (creditsEnabled && (creditsLoading || credits == null)) return undefined;

    let cancelled = false;

    (async () => {
      const windows = await prefetchTimeWindows();
      if (cancelled || lunchAutoAttemptedRef.current) return;

      const decision = decideLunchAutoAi({
        now: new Date(),
        lunchWindow: windows?.lunch ?? null,
        creditStatus: creditsEnabled ? credits : null,
        creditsFlagEnabled: creditsEnabled,
        timezoneIana: credits?.timezoneIana,
      });

      if (!decision.shouldAutoAi) return;
      lunchAutoAttemptedRef.current = true;
      void startAiAnalyze();
    })();

    return () => {
      cancelled = true;
    };
  }, [
    discardCaptureOnCancel,
    captureReady,
    userId,
    imageBase64,
    creditsEnabled,
    creditsLoading,
    credits,
    aiStarting,
    pendingAi,
    closingWithoutLog,
    startAiAnalyze,
  ]);

  const handleCategoryClick = (id) => {
    if (closingWithoutLog) return;
    // Queued Auto Detect can still be switched to a Log-as type.
    if (aiStarting && !pendingAi) return;
    if (!captureReady) {
      setPendingLogAsId(id);
      setPendingAi(false);
      setAiStarting(false);
      return;
    }
    openCategory(id);
  };

  // Flush queued Log-as once the background capture POST finishes.
  useEffect(() => {
    if (!captureReady) return;
    if (pendingLogAsId) {
      const id = pendingLogAsId;
      setPendingLogAsId(null);
      openCategory(id);
      return;
    }
    if (pendingAi) {
      setPendingAi(false);
      void startAiAnalyze();
    }
  }, [captureReady, pendingLogAsId, pendingAi, openCategory, startAiAnalyze]);

  const closeFoodSearch = () => {
    setFoodEntryMeta(null);
    setActiveForm(null);
  };

  const handleFoodSave = async (manualData) => {
    const analysis = buildAnalysisFromManualFood(manualData);
    const foodName = analysis?.foods?.[0]?.name || manualData?.name || 'Food';
    const foodItems = extractFoodShareItems(analysis);
    const n = analysis?.total || analysis?.foods?.[0]?.nutrition || {};
    // Dry Salad and full Food: name + kcal only for the compact share caption.
    const fromSnacks = Boolean(foodEntryMeta?.fromDrySalad);
    const activityCaption = fromSnacks
      ? buildDiaryShareSuffix('food', {
          foodName,
          foodItems,
          calories: n.calories ?? 0,
        })
      : buildDiaryShareSuffix('food', {
          foodName,
          foodItems,
          calories: n.calories ?? 0,
          protein: n.protein ?? 0,
          carbs: n.carbs ?? 0,
          fat: n.fat ?? 0,
          fiber: n.fiber ?? 0,
          glycemicIndex: n.glycemic_index ?? n.glycemicIndex ?? null,
        });

    // Close search UI immediately — promote runs in background (same as Cancel discard).
    setFoodEntryMeta(null);
    setActiveForm(null);
    onToast?.('Food saved to Diary');

    void promoteUnknownToFood({
      captureId,
      viewerUserId: userId,
      analysisResult: analysis,
      originalCapturedAt: originalCapturedAt || null,
    })
      .then((result) => {
        seedMealAfterPromotion({
          ownerUserId: userId,
          result,
          analysisResult: analysis,
          capturedAt: originalCapturedAt || null,
        });
        refreshAfterPersist('manual-food-persisted');
      })
      .catch((err) => {
        onToast?.(err?.message || "Couldn't save food — check Diary.");
      });

    exit(activityCaption ? { activityCaption } : null);
  };

  const handleWeightSave = ({ weightValue, unit, bmr }) => {
    // Share caption uses cache only — do not block Save on a network round-trip.
    const previousWeight = getCachedLatestWeight(userId)?.value ?? null;
    const idealRange = idealWeightRangeRef.current
      || computeIdealWeightRange(getCachedProfile(userEmail)?.data?.height);
    const capId = captureId;
    const uid = userId;
    const img = imageBase64;

    setActiveForm(null);
    onToast?.('Weight saved to Diary');
    exit({
      activityCaption: buildDiaryShareSuffix('weight', {
        previousWeight,
        currentWeight: weightValue,
        idealWeight: pickIdealWeightKg(weightValue, idealRange),
      }),
    });

    void saveWeight({
      userId: uid,
      weightValue,
      unit: unit || 'kg',
      bmr,
      captureId: capId,
      imageBase64ToSave: img,
    }).then(() => {
      refreshAfterPersist('manual-weight-persisted');
    }).catch((err) => {
      onToast?.(err?.message || "Couldn't save weight — check Diary.");
    });
  };

  const handleWatchSave = ({ caloriesBurned, source }) => {
    const capId = captureId;
    const uid = userId;
    const img = imageBase64;

    setActiveForm(null);
    onToast?.('Activity saved to Diary');
    exit({
      activityCaption: buildDiaryShareSuffix('workout', {
        caloriesBurned,
      }),
    });

    void saveLog({
      userId: uid,
      platform: source || 'Smartwatch',
      topic: `Calories Burned: ${caloriesBurned} kcal`,
      captureId: capId,
      imageBase64: img,
    }).then(() => {
      refreshAfterPersist('manual-workout-persisted');
    }).catch((err) => {
      onToast?.(err?.message || "Couldn't save activity — check Diary.");
    });
  };

  const handleShakeLog = (payload) => {
    const analysis = shakePayloadToAnalysis(payload);
    const shakeName = analysis?.foods?.[0]?.name || 'Protein Shake';
    setActiveForm(null);
    saveFoodAnalysis(
      analysis,
      'Shake saved to Diary',
      buildDiaryShareSuffix('shake', {
        shakeName,
        servings: 1,
        shakeProducts: analysis.shakeProducts,
      }),
    );
  };

  const handleAfreshConfirm = (targetScoops) => {
    const target = Math.max(0, Math.round(Number(targetScoops) || 0));
    const current = Math.max(0, Math.round(Number(afreshTodayScoops) || 0));
    const delta = target - current;
    if (delta <= 0) {
      // Already at/above target — reductions happen via Diary edit/delete.
      setActiveForm(null);
      return;
    }
    const analysis = buildAfreshAnalysisResult(delta);
    const calories = analysis?.total?.calories ?? 0;
    setActiveForm(null);
    // Share today's running total (after this log), not just the delta — same as water.
    saveFoodAnalysis(
      analysis,
      `+${delta} scoop${delta === 1 ? '' : 's'} Afresh logged (today ${target})`,
      buildDiaryShareSuffix('afresh', { scoops: target, calories }),
    );
  };

  const handleWaterConfirm = (targetMl) => {
    const target = Math.max(0, Math.round(Number(targetMl) || 0));
    const current = Math.max(0, Math.round(Number(waterTodayMl) || 0));
    const delta = target - current;
    if (delta <= 0) {
      // Already at/above target — reductions happen via Diary edit/delete.
      setActiveForm(null);
      return;
    }
    setActiveForm(null);
    // Share today's running total (after this log), not just the delta.
    saveFoodAnalysis(
      buildWaterAnalysisResult(delta),
      `+${delta} ml water logged (today ${target} ml)`,
      buildDiaryShareSuffix('water', { volumeMl: target }),
    );
  };

  const handleEducationSave = ({ platform, topic }) => {
    const capId = captureId;
    const uid = userId;
    const img = imageBase64;

    setActiveForm(null);
    onToast?.('Education saved to Diary');
    exit({
      activityCaption: buildDiaryShareSuffix('education', {
        platform,
        session: topic,
      }),
    });

    void saveLog({
      userId: uid,
      platform,
      topic,
      captureId: capId,
      imageBase64: img,
    }).then(() => {
      refreshAfterPersist('manual-education-persisted');
    }).catch((err) => {
      onToast?.(err?.message || "Couldn't save education — check Diary.");
    });
  };

  const handleGoodHabitSave = async ({
    habitType,
    imageBase64: habitImage,
    shareImage,
  }) => {
    // Persist first, then refresh score, then leave — exiting early left Home
    // on the pre-save total until a full page reload.
    await saveGoodHabit({
      userId,
      captureId,
      habitType,
      notes: '',
      imageBase64: habitImage,
      clientTimestamp: originalCapturedAt || null,
    });
    refreshAfterPersist('manual-good-habit-persisted');
    onToast?.('Good Habit saved to Diary');
    exit({
      activityCaption: buildDiaryShareSuffix('good-habit', { habitType }),
      shareImage: shareImage || habitImage || imageBase64,
    });
  };

  // Don't treat credits as available until status has loaded — avoids green CTA flash then lock.
  const aiTemporarilyBusy = creditsEnabled && creditUi.phase === 'busy';
  const logAsDisabled = closingWithoutLog || (aiStarting && !pendingAi);

  return (
    <div className="fixed inset-0 z-40 flex flex-col" style={{ background: BRAND.pageBg }}>
      {/* Header — white bar like Home */}
      <header className="safe-top shrink-0 border-b border-green-100 bg-white shadow-sm">
        <div className="mx-auto max-w-lg px-3 py-2 min-[360px]:py-2.5">
          <h1 className="text-sm font-extrabold text-green-700 min-[360px]:text-base">
            What is this image?
          </h1>
          <p className="text-[11px] leading-snug text-green-600 min-[360px]:text-xs">
            {aiStarting && !pendingAi
              ? 'Starting AI detection…'
              : 'Select one button below — Weight, Afresh, Food…'}
          </p>
        </div>
      </header>

      {/* Body — photo shrinks on short phones; grid + cancel stay reachable */}
      <main className="mx-auto flex w-full max-w-lg min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain px-2.5 pb-2.5 pt-2 min-[360px]:gap-3 min-[360px]:px-3 min-[360px]:pb-3 min-[360px]:pt-3">
        {/* Photo preview — tap to open full-screen; height scales with viewport */}
        <section className="shrink-0">
          {previewSrc ? (
            <button
              type="button"
              onClick={() => setPreviewExpanded(true)}
              className="flex h-[min(28vh,10.5rem)] w-full max-h-52 cursor-zoom-in items-center justify-center overflow-hidden rounded-2xl border border-green-100 shadow-sm transition-opacity active:opacity-90 min-[360px]:h-[min(30vh,12rem)] sm:h-60 sm:max-h-none"
              style={{ background: BRAND.mint }}
              aria-label="View photo full screen"
            >
              <img
                src={previewSrc}
                alt="Captured"
                className="h-full w-full object-contain"
                decoding="async"
              />
            </button>
          ) : (
            <div
              className="h-[min(28vh,10.5rem)] w-full max-h-52 rounded-2xl min-[360px]:h-[min(30vh,12rem)] sm:h-60 sm:max-h-none"
              style={{ background: BRAND.mint }}
            />
          )}
        </section>

        {hint && (
          <p className="shrink-0 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {hint}
          </p>
        )}

        {aiTemporarilyBusy && !hint && (
          <p className="shrink-0 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            AI detect is temporarily unavailable. Try again in a few minutes — your credits are not used yet.
          </p>
        )}

        {/* Type grid — large Log-as tiles matching original layout */}
        <section className="flex min-h-0 flex-1 flex-col">
          <div className="mb-1.5 flex shrink-0 items-center justify-between gap-2 min-[360px]:mb-2.5">
            <p className="shrink-0 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700/70 min-[360px]:text-[11px]">
              Log as
            </p>
          </div>
          <div className="grid w-full flex-1 grid-cols-3 auto-rows-[minmax(4.25rem,1fr)] gap-1.5 min-h-[16rem] min-[360px]:min-h-[18rem] min-[360px]:gap-2 sm:min-h-[20rem] sm:gap-2.5">
            {CATEGORIES.filter((cat) => goodHabitEnabled || cat.id !== MANUAL_LOG_CATEGORY.GOOD_HABIT).map(({ id, Icon, src, label, isImgIcon }) => {
              // iOS WebView often blanks custom emoji SVGs — use Lucide for Workout.
              const useLucideOnIos = id === MANUAL_LOG_CATEGORY.SMARTWATCH && isIOS() && Icon;
              const isPending = pendingLogAsId === id;
              return (
              <button
                key={id}
                type="button"
                disabled={logAsDisabled}
                onClick={() => handleCategoryClick(id)}
                className={LOG_AS_BTN_IDLE}
                aria-busy={isPending || undefined}
              >
                <LogAsIconWrap>
                  {isPending ? (
                    <Loader2
                      className="h-5 w-5 animate-spin min-[360px]:h-6 min-[360px]:w-6 min-[400px]:h-7 min-[400px]:w-7 sm:h-8 sm:w-8"
                      aria-hidden
                    />
                  ) : useLucideOnIos ? (
                    <Icon className="h-5 w-5" strokeWidth={2.1} aria-hidden />
                  ) : isImgIcon ? (
                    <PublicIcon
                      src={src}
                      className="h-5 w-5 min-[360px]:h-6 min-[360px]:w-6 min-[400px]:h-7 min-[400px]:w-7 sm:h-8 sm:w-8"
                      alt=""
                    />
                  ) : (
                    <Icon
                      className="h-5 w-5 min-[360px]:h-6 min-[360px]:w-6 min-[400px]:h-7 min-[400px]:w-7 sm:h-8 sm:w-8"
                      strokeWidth={2}
                      aria-hidden
                    />
                  )}
                </LogAsIconWrap>
                <span className={LOG_AS_LABEL}>
                  {label}
                </span>
              </button>
              );
            })}
          </div>
        </section>

        {/* Footer — new capture: discard row; diary re-classify: close only */}
        <button
          type="button"
          onClick={handleCloseWithoutLog}
          disabled={closingWithoutLog || (aiStarting && !pendingAi)}
          className={`safe-bottom log-as-btn log-as-btn--idle inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl border-2 py-3 text-sm font-bold shadow-[0_3px_0_0_rgba(0,0,0,0.08)] transition-[transform,box-shadow] duration-150 active:translate-y-[2px] disabled:opacity-50 min-[360px]:py-3.5 ${
            discardCaptureOnCancel
              ? 'border-red-200 bg-gradient-to-b from-white to-red-50/40 text-red-600 shadow-[0_3px_0_0_rgba(220,38,38,0.2)] active:shadow-[0_1px_0_0_rgba(220,38,38,0.18)]'
              : 'border-gray-200 bg-white text-gray-700 active:shadow-[0_1px_0_0_rgba(0,0,0,0.06)]'
          }`}
        >
          {closingWithoutLog && (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          )}
          {discardCaptureOnCancel ? "Cancel, Don't Log" : 'Cancel'}
        </button>
      </main>

      <SmartFoodSearchModal
        key={foodEntryMeta?.fromDrySalad ? 'dry-salad' : 'food'}
        isOpen={activeForm === MANUAL_LOG_CATEGORY.FOOD}
        onClose={closeFoodSearch}
        onSave={handleFoodSave}
        apiBaseUrl={apiBaseUrl}
        userId={userId}
        skipTypeSelect
        headerTitle={foodEntryMeta?.headerTitle}
        headerSubtitle={foodEntryMeta?.headerSubtitle}
        initialQuery={foodEntryMeta?.initialQuery || ''}
        catalogMode={Boolean(foodEntryMeta?.fromDrySalad)}
      />
      <GoodHabitFlow 
        isOpen={activeForm === MANUAL_LOG_CATEGORY.GOOD_HABIT}
        onClose={() => setActiveForm(null)}
        capturedPreview={previewSrc}
        onSave={handleGoodHabitSave}
      />
      <ManualWeightEntryModal
        isOpen={activeForm === MANUAL_LOG_CATEGORY.WEIGHT}
        onClose={() => setActiveForm(null)}
        onSave={handleWeightSave}
        onBack={() => setActiveForm(null)}
        userId={userId}
        imagePreview={previewSrc}
        skipTypeSelect
      />
      <ManualWatchEntryModal
        key={captureId}
        formKey={captureId}
        isOpen={activeForm === MANUAL_LOG_CATEGORY.SMARTWATCH}
        onClose={() => setActiveForm(null)}
        onSave={handleWatchSave}
        onBack={() => setActiveForm(null)}
        todayBaseline={workoutTodayKcal}
        loading={workoutTodayLoading}
      />
      <ManualEducationEntryModal
        isOpen={activeForm === MANUAL_LOG_CATEGORY.EDUCATION}
        onClose={() => setActiveForm(null)}
        onSave={handleEducationSave}
        skipTypeSelect
        formTitle="Education"
        formSubtitle="Choose platform and meeting session"
      />
      <ShakeCalculatorModal
        isOpen={activeForm === MANUAL_LOG_CATEGORY.SHAKE}
        onClose={() => setActiveForm(null)}
        onLog={handleShakeLog}
      />
      <ServingStepperModal
        isOpen={activeForm === MANUAL_LOG_CATEGORY.AFRESH}
        title="Afresh"
        subtitle="Scoops consumed so far today"
        unitLabel="Scoops"
        iconSrc="/coffee.png"
        min={afreshTodayScoops}
        max={Math.max(AFRESH_PRODUCT.maxScoops, afreshTodayScoops + AFRESH_PRODUCT.maxScoops)}
        step={1}
        defaultValue={afreshTodayScoops}
        baseline={afreshTodayScoops}
        loading={afreshTodayLoading}
        formatValue={(n) => `${n} ${n === 1 ? 'scoop' : 'scoops'}`}
        onClose={() => setActiveForm(null)}
        onConfirm={handleAfreshConfirm}
        confirmLabel="Log Afresh"
      />
      <ServingStepperModal
        isOpen={activeForm === MANUAL_LOG_CATEGORY.WATER}
        title="Water"
        subtitle="How much you drank so far today"
        iconSrc="/water.svg"
        unitLabel=""
        min={waterTodayMl}
        max={Math.max(5000, waterTodayMl + 3000)}
        step={100}
        defaultValue={waterTodayMl}
        baseline={waterTodayMl}
        loading={waterTodayLoading}
        quickAddPresets={[
          { label: '100 ml', amount: 100 },
          { label: '1 L', amount: 1000 },
        ]}
        formatValue={(n) => `${n} ml`}
        onClose={() => setActiveForm(null)}
        onConfirm={handleWaterConfirm}
        confirmLabel="Log Water"
      />

      {/* Full-screen captured photo */}
      {previewExpanded && previewSrc && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-3"
          role="dialog"
          aria-modal="true"
          aria-label="Full screen photo"
          onClick={() => setPreviewExpanded(false)}
        >
          <button
            type="button"
            onClick={() => setPreviewExpanded(false)}
            className="absolute right-3 top-3 z-[101] rounded-full bg-white/15 p-2.5 text-white backdrop-blur-sm transition-colors active:bg-white/25"
            aria-label="Close full screen photo"
          >
            <X className="h-6 w-6" strokeWidth={2.5} aria-hidden />
          </button>
          <img
            src={previewSrc}
            alt="Captured full size"
            className="max-h-full max-w-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
