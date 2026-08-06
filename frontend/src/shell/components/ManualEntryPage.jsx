/**
 * CaptureClassifyPage — full-screen post-capture: pick type or run AI in background.
 * AI does not populate this screen; results appear in Diary.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dumbbell,
  Loader2,
  Lock,
  Salad,
  Sparkles,
  UtensilsCrossed,
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
} from '../../features/nutrition';
import { ManualWeightEntryModal, saveWeight, warmLatestWeightCache, getCachedLatestWeight, fetchLatestWeightEntry } from '../../features/weight';
import { ManualEducationEntryModal, saveLog } from '../../features/education';
import { ManualWatchEntryModal } from '../../features/activity';
import { fetchWatchBurnedCalories } from '../../features/nutrition/services/nutritionDashboard/burnedCaloriesApi';
import {
  fetchAiCreditsStatus,
  reserveAiCredit,
} from '../../features/ai-credits';
import { fetchWaterIntake, todayLocal } from '../../features/water';
import { isIOS } from '../../shared/utils/platform';
import { buildDiaryShareSuffix } from '../../features/diary';
import HealthySnacksSubSelectModal from './HealthySnacksSubSelectModal';
import {
  MANUAL_LOG_CATEGORY,
  resolveManualLogCategoryClick,
  resolveHealthySnacksSubtypeClick,
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
    id: MANUAL_LOG_CATEGORY.HEALTHY_SNACKS,
    Icon: Salad,
    label: 'Healthy Snacks & Soups',
    wrapLabel: true,
  },
  // smartwatch flow = calories burned; label is Workout (green weightlifter / Lucide on iOS)
  {
    id: MANUAL_LOG_CATEGORY.SMARTWATCH,
    src: '/emoji/1f3cb-green.svg',
    label: 'Workout',
    isImgIcon: true,
    Icon: Dumbbell,
  },
];

/** Home hero banner greens — keep classify screen on-brand with Take Photo card. */
const BRAND = {
  pageBg: '#e8f5e9',
  hero: 'linear-gradient(135deg, #064e3b 0%, #065f46 45%, #047857 100%)',
  mint: '#e8f5e9',
  forest: '#064e3b',
  active: '#16a34a',
};

/** Shared Log-as button chrome — fills one cell in the 3×3 grid. */
const LOG_AS_BTN_BASE =
  'log-as-btn flex h-full min-h-[4.75rem] w-full min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-center cursor-pointer select-none transition-[transform,box-shadow,background-color,border-color] duration-150 ease-out disabled:pointer-events-none disabled:opacity-50 min-[380px]:min-h-[5rem] min-[380px]:gap-1.5 sm:min-h-[5.25rem]';

const LOG_AS_BTN_IDLE = [
  LOG_AS_BTN_BASE,
  'log-as-btn--idle border-2 bg-gradient-to-b from-white to-emerald-50/70',
  'border-emerald-200/90 text-emerald-900',
  'shadow-[0_3px_0_0_rgba(6,95,70,0.22)]',
  'active:translate-y-[2px] active:shadow-[0_1px_0_0_rgba(6,95,70,0.18)]',
].join(' ');

const LOG_AS_BTN_SELECTED = [
  LOG_AS_BTN_BASE,
  'log-as-btn--selected border-2 border-emerald-800 bg-gradient-to-b from-emerald-600 to-emerald-700 text-white',
  'shadow-[0_3px_0_0_#064e3b]',
  'active:translate-y-[2px] active:shadow-[0_1px_0_0_#064e3b]',
].join(' ');

function LogAsIconWrap({ selected = false, muted = false, compact = false, children }) {
  return (
    <span
      className={[
        'flex shrink-0 items-center justify-center',
        compact
          ? 'h-8 w-8 min-[380px]:h-9 min-[380px]:w-9 sm:h-10 sm:w-10'
          : 'h-9 w-9 min-[380px]:h-10 min-[380px]:w-10 sm:h-11 sm:w-11',
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

/** Next credit-reset calendar day in `timezoneIana`, e.g. "Aug 04". */
function formatUnlockDate(timezoneIana) {
  const tz = timezoneIana || 'Asia/Kolkata';
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const num = (type) => Number(parts.find((p) => p.type === type)?.value || 0);
  const elapsed = num('hour') * 3600 + num('minute') * 60 + num('second');
  const remainingSec = elapsed === 0 ? 0 : Math.max(0, 24 * 3600 - elapsed);
  const target = remainingSec === 0 ? now : new Date(now.getTime() + remainingSec * 1000);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    month: 'short',
    day: '2-digit',
  }).format(target);
}

/** Unlock date line for the Auto Detect tile when credits are exhausted. */
function LogAsUnlockDate({ timezoneIana, className = '' }) {
  const label = formatUnlockDate(timezoneIana);
  return (
    <span
      className={`max-w-full truncate whitespace-nowrap tabular-nums ${className}`}
      title={`AI credit unlocks on ${label}`}
    >
      {label}
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
  apiBaseUrl,
  captureId,
  imageBase64,
  originalCapturedAt = null,
  onBack,
  onSaved,
  onStartBackgroundAi,
  onToast,
}) {
  const creditsEnabled = isFlagEnabled('ff.ai-credits');
  const [credits, setCredits] = useState(null);
  // Start loading=true so first paint never flashes green "Analyze" before status returns.
  const [creditsLoading, setCreditsLoading] = useState(() => isFlagEnabled('ff.ai-credits'));
  const [aiStarting, setAiStarting] = useState(false);
  const [hint, setHint] = useState(null);
  const [activeForm, setActiveForm] = useState(null);
  /** When food search opened from Healthy Snacks & Soups subtypes. */
  const [foodEntryMeta, setFoodEntryMeta] = useState(null);
  const [saving, setSaving] = useState(false);
  const [closingWithoutLog, setClosingWithoutLog] = useState(false);
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

  // New capture while this screen stays mounted — close any open sub-form.
  useEffect(() => {
    setActiveForm(null);
    setFoodEntryMeta(null);
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

  useEffect(() => {
    refreshCredits();
  }, [refreshCredits]);

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

  // Prefetch so Afresh / Water open instantly (avoids heavy food-corrections/stats + images).
  useEffect(() => {
    if (!userId) return undefined;
    beverageSummaryReadyRef.current = false;
    return loadBeverageToday();
  }, [userId, loadBeverageToday]);

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

  useEffect(() => {
    if (!userId) return undefined;
    workoutSummaryReadyRef.current = false;
    return loadWorkoutToday();
  }, [userId, loadWorkoutToday]);

  useEffect(() => {
    if (activeForm !== 'smartwatch') return undefined;
    return loadWorkoutToday({ showLoading: !workoutSummaryReadyRef.current });
  }, [activeForm, loadWorkoutToday]);

  useEffect(() => {
    if (userId) warmLatestWeightCache(userId);
  }, [userId]);

  const exit = async (shareMeta = null) => {
    await onSaved?.(shareMeta);
    // Share sheet was shown — return to main whether user shared or dismissed.
    onBack?.();
  };

  /** Discard capture and leave — must not remain in Diary as unknown/Other. */
  const handleCloseWithoutLog = () => {
    if (closingWithoutLog || saving || aiStarting) return;
    setClosingWithoutLog(true);
    const id = captureId;
    const uid = userId;
    // Leave immediately — awaiting delete felt like a hang under network load.
    onBack?.();
    if (id && uid) {
      void deleteCapture({ captureId: id, userId: uid }).catch(() => {
        onToast?.("Couldn't discard photo — it may still appear in Diary.");
      });
    }
  };

  const saveFoodAnalysis = async (analysisResult, toastMsg, activityCaption = null) => {
    await promoteUnknownToFood({
      captureId,
      viewerUserId: userId,
      analysisResult,
      originalCapturedAt: originalCapturedAt || null,
    });
    onToast?.(toastMsg);
    await exit(activityCaption ? { activityCaption } : null);
  };

  const handleAiAnalyze = async () => {
    if (!userId || !imageBase64 || aiStarting) return;
    setHint(null);
    setAiStarting(true);
    try {
      let reservationId = null;
      if (creditsEnabled) {
        const reserved = await reserveAiCredit({ userId, apiBaseUrl });
        setCredits(reserved);
        if (!reserved?.allowed || !reserved.reservationId) {
          setHint(
            reserved?.reason === 'limit_reached'
              ? 'Daily AI limit reached — pick a type below to log manually.'
              : 'Could not start AI — pick a type below to log manually.',
          );
          setAiStarting(false);
          return;
        }
        reservationId = reserved.reservationId;
      }
      onStartBackgroundAi?.({ reservationId });
      await exit();
    } catch (err) {
      setHint(err?.message || 'Could not start AI — pick a type below.');
      setAiStarting(false);
    }
  };

  const handleCategoryClick = (id) => {
    if (saving || aiStarting) return;
    const next = resolveManualLogCategoryClick(id);
    if (!next) return;
    if (next.kind === 'healthy-snacks-picker') {
      setFoodEntryMeta(null);
      setActiveForm(MANUAL_LOG_CATEGORY.HEALTHY_SNACKS);
      return;
    }
    setFoodEntryMeta(null);
    setActiveForm(next.formId);
  };

  const handleHealthySnacksPick = (subtypeId) => {
    const next = resolveHealthySnacksSubtypeClick(subtypeId);
    if (!next) return;
    setFoodEntryMeta({
      fromHealthySnacks: true,
      subtypeId: next.subtype.id,
      headerTitle: next.subtype.headerTitle,
      headerSubtitle: 'Type the food item below',
      initialQuery: next.subtype.searchHint || '',
    });
    setActiveForm(next.formId);
  };

  const closeFoodSearch = () => {
    if (foodEntryMeta?.fromHealthySnacks) {
      setFoodEntryMeta(null);
      setActiveForm(MANUAL_LOG_CATEGORY.HEALTHY_SNACKS);
      return;
    }
    setFoodEntryMeta(null);
    setActiveForm(null);
  };

  const handleFoodSave = async (manualData) => {
    const analysis = buildAnalysisFromManualFood(manualData);
    const foodName = analysis?.foods?.[0]?.name || manualData?.name || 'Food';
    const n = analysis?.total || analysis?.foods?.[0]?.nutrition || {};
    const activityCaption = buildDiaryShareSuffix('food', {
      foodName,
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
    }).catch((err) => {
      onToast?.(err?.message || "Couldn't save food — check Diary.");
    });

    await exit(activityCaption ? { activityCaption } : null);
  };

  const handleWeightSave = async ({ weightValue, unit, bmr }) => {
    setSaving(true);
    try {
      // Capture previous BEFORE saveWeight updates the latest-weight cache.
      let previousWeight = getCachedLatestWeight(userId)?.value ?? null;
      if (previousWeight == null && userId) {
        try {
          previousWeight = (await fetchLatestWeightEntry(userId))?.value ?? null;
        } catch {
          previousWeight = null;
        }
      }

      await saveWeight({
        userId,
        weightValue,
        unit: unit || 'kg',
        bmr,
        captureId,
        imageBase64ToSave: imageBase64,
      });
      setActiveForm(null);
      onToast?.('Weight saved to Diary');
      await exit({
        activityCaption: buildDiaryShareSuffix('weight', {
          previousWeight,
          currentWeight: weightValue,
        }),
      });
    } catch (err) {
      const msg = err?.message || 'Failed to save weight';
      setHint(msg);
      throw new Error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleWatchSave = async ({ caloriesBurned, source }) => {
    setSaving(true);
    try {
      await saveLog({
        userId,
        platform: source || 'Smartwatch',
        topic: `Calories Burned: ${caloriesBurned} kcal`,
        captureId,
        imageBase64,
      });
      setActiveForm(null);
      onToast?.('Activity saved to Diary');
      await exit({
        activityCaption: buildDiaryShareSuffix('workout', {
          caloriesBurned,
        }),
      });
    } catch (err) {
      const msg = err?.message || 'Failed to save activity';
      setHint(msg);
      throw new Error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleShakeLog = async (payload) => {
    const analysis = shakePayloadToAnalysis(payload);
    const shakeName = analysis?.foods?.[0]?.name || 'Protein Shake';
    await saveFoodAnalysis(
      analysis,
      'Shake saved to Diary',
      buildDiaryShareSuffix('shake', {
        shakeName,
        servings: 1,
        shakeProducts: analysis.shakeProducts,
      }),
    );
    setActiveForm(null);
  };

  const handleAfreshConfirm = async (targetScoops) => {
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
    await saveFoodAnalysis(
      analysis,
      `+${delta} scoop${delta === 1 ? '' : 's'} Afresh logged (today ${target})`,
      buildDiaryShareSuffix('afresh', { scoops: delta, calories }),
    );
    setActiveForm(null);
  };

  const handleWaterConfirm = async (targetMl) => {
    const target = Math.max(0, Math.round(Number(targetMl) || 0));
    const current = Math.max(0, Math.round(Number(waterTodayMl) || 0));
    const delta = target - current;
    if (delta <= 0) {
      // Already at/above target — reductions happen via Diary edit/delete.
      setActiveForm(null);
      return;
    }
    await saveFoodAnalysis(
      buildWaterAnalysisResult(delta),
      `+${delta} ml water logged (today ${target} ml)`,
      buildDiaryShareSuffix('water', { volumeMl: delta }),
    );
  };

  const handleEducationSave = async ({ platform, topic }) => {
    setSaving(true);
    try {
      await saveLog({
        userId,
        platform,
        topic,
        captureId,
        imageBase64,
      });
      setActiveForm(null);
      onToast?.('Education saved to Diary');
      await exit({
        activityCaption: buildDiaryShareSuffix('education', {
          platform,
          session: topic,
        }),
      });
    } catch (err) {
      const msg = err?.message || 'Failed to save education';
      setHint(msg);
      throw new Error(msg);
    } finally {
      setSaving(false);
    }
  };

  // Don't treat credits as available until status has loaded — avoids green CTA flash then lock.
  const creditsChecking = creditsEnabled && creditsLoading;
  const outOfCredits = creditsEnabled && credits != null && (credits.remaining ?? 0) <= 0;
  // Only show AI CTA / credits when mode is confirmed on — never surface “AI off” to users.
  const showCreditsPanel = creditsEnabled && credits != null && credits.enabled === true;
  const showAiButton = !creditsEnabled || (credits != null && credits.enabled === true);
  const aiDisabled = aiStarting || outOfCredits || creditsChecking || closingWithoutLog;

  return (
    <div className="fixed inset-0 z-40 flex flex-col" style={{ background: BRAND.pageBg }}>
      {/* Header — white bar like Home */}
      <header className="safe-top shrink-0 border-b border-green-100 bg-white shadow-sm">
        <div className="mx-auto max-w-lg px-3 py-2.5">
          <h1 className="truncate text-base font-extrabold text-green-700">What is this image?</h1>
          <p className="truncate text-xs text-green-600">
            Select one button from below — e.g. Weight, Afresh, Food…
          </p>
        </div>
      </header>

      {/* Body — flex layout, no page scroll */}
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-3 overflow-hidden px-3 pb-3 pt-3">
        {/* Photo preview */}
        <section className="shrink-0">
          {previewSrc ? (
            <div
              className="flex w-full items-center justify-center overflow-hidden rounded-2xl border border-green-100 shadow-sm"
              style={{
                background: BRAND.mint,
                maxHeight: showAiButton ? '6.5rem' : '11rem',
                minHeight: showAiButton ? '4.5rem' : '7.5rem',
              }}
            >
              <img
                src={previewSrc}
                alt="Captured"
                className={`w-full object-contain ${showAiButton ? 'max-h-24' : 'max-h-44'}`}
              />
            </div>
          ) : (
            <div
              className="w-full rounded-2xl"
              style={{ background: BRAND.mint, height: showAiButton ? '4.5rem' : '7.5rem' }}
            />
          )}
        </section>

        {hint && (
          <p className="shrink-0 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {hint}
          </p>
        )}

        {/* Type grid — premium compact Log-as buttons */}
        <section className="flex min-h-0 flex-1 flex-col">
          <div className="mb-2.5 flex shrink-0 items-center justify-between gap-2">
            <p className="shrink-0 text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700/70">
              Log as
            </p>
          </div>
          <div className="grid h-full min-h-0 w-full flex-1 grid-cols-3 grid-rows-3 gap-2 sm:gap-2.5">
            {CATEGORIES.map(({ id, Icon, src, label, isImgIcon, wrapLabel }) => {
              // iOS WebView often blanks custom emoji SVGs — use Lucide for Workout.
              const useLucideOnIos = id === MANUAL_LOG_CATEGORY.SMARTWATCH && isIOS() && Icon;
              return (
              <button
                key={id}
                type="button"
                disabled={saving || closingWithoutLog}
                onClick={() => handleCategoryClick(id)}
                className={LOG_AS_BTN_IDLE}
              >
                <LogAsIconWrap>
                  {useLucideOnIos ? (
                    <Icon className="h-5 w-5" strokeWidth={2.1} aria-hidden />
                  ) : isImgIcon ? (
                    <PublicIcon
                      src={src}
                      className="h-8 w-8 min-[380px]:h-9 min-[380px]:w-9 sm:h-10 sm:w-10"
                      alt=""
                    />
                  ) : (
                    <Icon
                      className="h-8 w-8 min-[380px]:h-9 min-[380px]:w-9 sm:h-10 sm:w-10"
                      strokeWidth={2}
                      aria-hidden
                    />
                  )}
                </LogAsIconWrap>
                <span
                  className={[
                    'max-w-full px-0.5 font-bold leading-tight text-emerald-900',
                    wrapLabel
                      ? 'line-clamp-2 whitespace-normal text-[9px] min-[380px]:text-[10px] sm:text-[11px]'
                      : 'truncate text-[11px] min-[380px]:text-[12px] sm:text-[13px]',
                  ].join(' ')}
                >
                  {label}
                </span>
              </button>
              );
            })}

            {showAiButton && (
              outOfCredits ? (
                <div
                  className={`${LOG_AS_BTN_IDLE} cursor-default`}
                  aria-disabled="true"
                  title="Daily AI limit reached — unlocks at midnight"
                >
                  <LogAsIconWrap compact>
                    <Lock
                      className="h-7 w-7 min-[380px]:h-8 min-[380px]:w-8 sm:h-9 sm:w-9"
                      aria-hidden
                    />
                  </LogAsIconWrap>
                  <span className="max-w-full truncate whitespace-nowrap px-0.5 text-[10px] font-semibold leading-none text-emerald-800 min-[380px]:text-[11px] sm:text-[12px]">
                    Unlock on
                  </span>
                  {showCreditsPanel && (
                    <LogAsUnlockDate
                      timezoneIana={credits?.timezoneIana}
                      className="text-[11px] font-medium text-amber-600 min-[380px]:text-[12px] sm:text-[13px]"
                    />
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleAiAnalyze}
                  disabled={aiDisabled}
                  className={[
                    LOG_AS_BTN_SELECTED,
                    creditsChecking ? 'opacity-80' : '',
                  ].join(' ')}
                >
                  <LogAsIconWrap selected compact={Boolean(showCreditsPanel)}>
                    {aiStarting ? (
                      <Loader2 className="h-8 w-8 animate-spin text-white min-[380px]:h-9 min-[380px]:w-9 sm:h-10 sm:w-10" />
                    ) : (
                      <Sparkles className="h-8 w-8 text-white min-[380px]:h-9 min-[380px]:w-9 sm:h-10 sm:w-10" />
                    )}
                  </LogAsIconWrap>
                  <span className="max-w-full truncate whitespace-nowrap px-0.5 text-[11px] font-semibold leading-tight text-white min-[380px]:text-[12px] sm:text-[13px]">
                    {aiStarting ? 'Starting…' : 'Auto Detect'}
                  </span>
                  {showCreditsPanel && credits && (
                    <p className="max-w-full truncate whitespace-nowrap text-[8px] font-semibold tabular-nums text-emerald-100/90 min-[380px]:text-[9px] sm:text-[10px]">
                      <span className="text-white">
                        {Math.max(0, Number(credits.remaining) ?? 0)}
                      </span>
                      {' of '}
                      {Math.max(0, Number(credits.dailyLimit) || 0)}
                    </p>
                  )}
                  {showCreditsPanel && creditsLoading && !credits && (
                    <p className="text-[8px] text-emerald-100/80 min-[380px]:text-[9px] sm:text-[10px]">
                      Checking…
                    </p>
                  )}
                </button>
              )
            )}
          </div>
        </section>

        {/* Footer — discard capture (not saved to Diary) and return */}
        <button
          type="button"
          onClick={handleCloseWithoutLog}
          disabled={saving || aiStarting || closingWithoutLog}
          className="safe-bottom log-as-btn log-as-btn--idle inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl border-2 border-red-200 bg-gradient-to-b from-white to-red-50/40 py-3.5 text-sm font-bold text-red-600 shadow-[0_3px_0_0_rgba(220,38,38,0.2)] transition-[transform,box-shadow] duration-150 active:translate-y-[2px] active:shadow-[0_1px_0_0_rgba(220,38,38,0.18)] disabled:opacity-50"
        >
          {closingWithoutLog && (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          )}
          Cancel, Don't Log
        </button>
      </main>

      <SmartFoodSearchModal
        isOpen={activeForm === MANUAL_LOG_CATEGORY.FOOD}
        onClose={closeFoodSearch}
        onSave={handleFoodSave}
        apiBaseUrl={apiBaseUrl}
        userId={userId}
        skipTypeSelect
        headerTitle={foodEntryMeta?.headerTitle}
        headerSubtitle={foodEntryMeta?.headerSubtitle}
        initialQuery={foodEntryMeta?.initialQuery || ''}
      />
      <HealthySnacksSubSelectModal
        isOpen={activeForm === MANUAL_LOG_CATEGORY.HEALTHY_SNACKS}
        onClose={() => {
          setFoodEntryMeta(null);
          setActiveForm(null);
        }}
        onPick={handleHealthySnacksPick}
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
    </div>
  );
}
