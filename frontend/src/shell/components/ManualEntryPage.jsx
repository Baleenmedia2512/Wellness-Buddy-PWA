/**
 * CaptureClassifyPage — full-screen post-capture: pick type or run AI in background.
 * AI does not populate this screen; results appear in Diary.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dumbbell,
  Loader2,
  Lock,
  Sparkles,
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
} from '../../features/nutrition';
import { ManualWeightEntryModal, saveWeight, warmLatestWeightCache } from '../../features/weight';
import { ManualEducationEntryModal, saveLog } from '../../features/education';
import { ManualWatchEntryModal } from '../../features/activity';
import { fetchWatchBurnedCalories } from '../../features/nutrition/services/nutritionDashboard/burnedCaloriesApi';
import {
  fetchAiCreditsStatus,
  reserveAiCredit,
} from '../../features/ai-credits';
import { fetchWaterIntake, todayLocal } from '../../features/water';
import { isIOS } from '../../shared/utils/platform';

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
  { id: 'weight', src: '/scale.png', label: 'Weight', isImgIcon: true },
  { id: 'afresh', src: '/coffee.png', label: 'Afresh', isImgIcon: true },
  { id: 'education', src: '/education.svg', label: 'Education', isImgIcon: true },
  { id: 'shake', src: '/bottle.png', label: 'Shake', isImgIcon: true },
  { id: 'water', src: '/water.svg', label: 'Water', isImgIcon: true },
  { id: 'food', Icon: UtensilsCrossed, label: 'Food' },
  // smartwatch flow = calories burned; label is Workout (green weightlifter / Lucide on iOS)
  { id: 'smartwatch', src: '/emoji/1f3cb-green.svg', label: 'Workout', isImgIcon: true, Icon: Dumbbell },
];

/** Home hero banner greens — keep classify screen on-brand with Take Photo card. */
const BRAND = {
  pageBg: '#e8f5e9',
  hero: 'linear-gradient(135deg, #064e3b 0%, #065f46 45%, #047857 100%)',
  mint: '#e8f5e9',
  forest: '#064e3b',
  active: '#16a34a',
  /** Log-as premium button tokens */
  btnBorder: '#B8F5D7',
  btnPressBg: '#ECFDF5',
  btnSelected: '#065F46',
  btnIconBg: '#ECFDF5',
  btnLabel: '#064e3b',
};

/** Shared Log-as button chrome — compact premium mobile tiles (~15–20% smaller). */
const LOG_AS_BTN_BASE =
  'log-as-btn aspect-square flex min-w-0 w-full max-w-[6.25rem] min-[380px]:max-w-[6.75rem] sm:max-w-[7.25rem] flex-col items-center justify-center gap-1 justify-self-center rounded-[20px] px-1 py-1.5 text-center transition-all duration-200 ease-out disabled:pointer-events-none disabled:opacity-50 min-[380px]:gap-1.5 min-[380px]:px-1.5 min-[380px]:py-2';

const LOG_AS_BTN_IDLE = [
  LOG_AS_BTN_BASE,
  'log-as-btn--idle border-[1.5px] bg-white',
  'shadow-[0_4px_14px_rgba(6,78,59,0.08),0_1px_3px_rgba(6,78,59,0.05)]',
  'active:translate-y-0.5 active:scale-[0.97] active:shadow-[0_2px_6px_rgba(6,78,59,0.07)]',
].join(' ');

const LOG_AS_BTN_SELECTED = [
  LOG_AS_BTN_BASE,
  'log-as-btn--selected border-[1.5px] border-[#065F46] bg-[#065F46] text-white',
  'shadow-[0_8px_22px_rgba(6,95,70,0.38),0_0_0_3px_rgba(6,95,70,0.16)]',
  'active:translate-y-0.5 active:scale-[0.97] active:shadow-[0_3px_10px_rgba(6,95,70,0.28),0_0_0_2px_rgba(6,95,70,0.12)]',
].join(' ');

function LogAsIconWrap({ selected = false, muted = false, compact = false, children }) {
  return (
    <span
      className={[
        'flex shrink-0 items-center justify-center rounded-full',
        compact
          ? 'h-9 w-9 min-[380px]:h-10 min-[380px]:w-10 sm:h-11 sm:w-11'
          : 'h-10 w-10 min-[380px]:h-11 min-[380px]:w-11 sm:h-12 sm:w-12',
        selected
          ? 'bg-white/15 ring-1 ring-white/25'
          : muted
            ? 'bg-gray-100 text-gray-400'
            : 'text-emerald-700',
      ].join(' ')}
      style={selected || muted ? undefined : { background: BRAND.btnIconBg }}
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
  const foods = (payload?.detailedItems || []).map((item) => ({
    name: item.name,
    nutrition: item.nutrition || {},
    portion: item.portionDescription || item.portion,
    weight_g: item.weight_g,
    volume_ml: item.volume_ml,
    unit: item.unit,
    isLiquid: item.isLiquid,
  }));
  return {
    foods,
    total: payload?.nutrition || {},
    confidence: payload?.confidence || 'high',
    processedBy: payload?.processedBy || 'shake_calculator',
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
  const [saving, setSaving] = useState(false);
  const [closingWithoutLog, setClosingWithoutLog] = useState(false);
  // Today's hydration total (all exempted beverages) — water stepper tracks this.
  const [waterTodayMl, setWaterTodayMl] = useState(0);
  const [waterTodayLoading, setWaterTodayLoading] = useState(false);
  const [workoutTodayKcal, setWorkoutTodayKcal] = useState(0);
  const [workoutTodayLoading, setWorkoutTodayLoading] = useState(false);

  // New capture while this screen stays mounted — close any open sub-form.
  useEffect(() => {
    setActiveForm(null);
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

  // Load today's consumed water whenever the water stepper opens (diary edits reflect here).
  useEffect(() => {
    if (activeForm !== 'water' || !userId) return undefined;
    let cancelled = false;
    setWaterTodayLoading(true);
    fetchWaterIntake(userId, todayLocal())
      .then((data) => {
        if (cancelled) return;
        const total = Math.max(0, Math.round(Number(data?.totalMl) || 0));
        setWaterTodayMl(total);
      })
      .catch(() => {
        if (!cancelled) setWaterTodayMl(0);
      })
      .finally(() => {
        if (!cancelled) setWaterTodayLoading(false);
      });
    return () => { cancelled = true; };
  }, [activeForm, userId]);

  // Load today's watch calories whenever the workout modal opens.
  useEffect(() => {
    if (activeForm !== 'smartwatch' || !userId) return undefined;
    let cancelled = false;
    setWorkoutTodayLoading(true);
    fetchWatchBurnedCalories({ apiBaseUrl, userId, date: todayLocal() })
      .then((total) => {
        if (cancelled) return;
        setWorkoutTodayKcal(Math.max(0, Math.round(Number(total) || 0)));
      })
      .catch(() => {
        if (!cancelled) setWorkoutTodayKcal(0);
      })
      .finally(() => {
        if (!cancelled) setWorkoutTodayLoading(false);
      });
    return () => { cancelled = true; };
  }, [activeForm, userId, apiBaseUrl]);

  useEffect(() => {
    if (userId) warmLatestWeightCache(userId);
  }, [userId]);

  const exit = async () => {
    await onSaved?.();
    // Share sheet was shown — return to main whether user shared or dismissed.
    onBack?.();
  };

  /** Discard capture and leave — must not remain in Diary as unknown/Other. */
  const handleCloseWithoutLog = async () => {
    if (closingWithoutLog || saving || aiStarting) return;
    setClosingWithoutLog(true);
    try {
      if (captureId && userId) {
        await deleteCapture({ captureId, userId });
      }
      onBack?.();
    } catch {
      onToast?.("Couldn't discard photo — try again.");
      setClosingWithoutLog(false);
    }
  };

  const saveFoodAnalysis = async (analysisResult, toastMsg) => {
    await promoteUnknownToFood({
      captureId,
      viewerUserId: userId,
      analysisResult,
      originalCapturedAt: originalCapturedAt || null,
    });
    onToast?.(toastMsg);
    await exit();
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
    setActiveForm(id);
  };

  const handleFoodSave = async (manualData) => {
    setSaving(true);
    try {
      await saveFoodAnalysis(buildAnalysisFromManualFood(manualData), 'Food saved to Diary');
      setActiveForm(null);
    } catch (err) {
      const msg = err?.message || 'Failed to save food';
      setHint(msg);
      throw new Error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleWeightSave = async ({ weightValue, unit, bmr }) => {
    setSaving(true);
    try {
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
      await exit();
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
      await exit();
    } catch (err) {
      const msg = err?.message || 'Failed to save activity';
      setHint(msg);
      throw new Error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleShakeLog = async (payload) => {
    await saveFoodAnalysis(shakePayloadToAnalysis(payload), 'Shake saved to Diary');
    setActiveForm(null);
  };

  const handleAfreshConfirm = async (scoops) => {
    await saveFoodAnalysis(buildAfreshAnalysisResult(scoops), 'Afresh saved to Diary');
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
      await exit();
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
          <div className="grid w-full grid-cols-2 content-start justify-items-center gap-2.5 min-[400px]:grid-cols-3 min-[400px]:gap-3 sm:gap-3.5">
            {CATEGORIES.map(({ id, Icon, src, label, isImgIcon }) => {
              // iOS WebView often blanks custom emoji SVGs — use Lucide for Workout.
              const useLucideOnIos = id === 'smartwatch' && isIOS() && Icon;
              return (
              <button
                key={id}
                type="button"
                disabled={saving || aiStarting || closingWithoutLog}
                onClick={() => handleCategoryClick(id)}
                className={LOG_AS_BTN_IDLE}
                style={{ borderColor: BRAND.btnBorder }}
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
                  className="max-w-full truncate px-0.5 text-[11px] font-semibold leading-tight min-[380px]:text-[12px] sm:text-[13px]"
                  style={{ color: BRAND.btnLabel }}
                >
                  {label}
                </span>
              </button>
            ))}

            {showAiButton && (
              outOfCredits ? (
                <div
                  className={`${LOG_AS_BTN_BASE} border-[1.5px] bg-white opacity-80 shadow-[0_4px_14px_rgba(0,0,0,0.05)]`}
                  style={{ borderColor: BRAND.btnBorder }}
                  aria-disabled="true"
                  title="Daily AI limit reached — unlocks at midnight"
                >
                  <LogAsIconWrap muted compact>
                    <Lock
                      className="h-7 w-7 min-[380px]:h-8 min-[380px]:w-8 sm:h-9 sm:w-9"
                      aria-hidden
                    />
                  </LogAsIconWrap>
                  <span className="max-w-full truncate whitespace-nowrap px-0.5 text-[10px] font-semibold leading-none text-gray-500 min-[380px]:text-[11px] sm:text-[12px]">
                    Unlock in
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
          className="safe-bottom inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-2xl border border-green-100 bg-white py-3 text-sm font-bold text-emerald-700 shadow-sm transition active:scale-[0.99] disabled:opacity-50"
        >
          {closingWithoutLog ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <X className="h-4 w-4" aria-hidden />
          )}
          Cancel, Don't Log
        </button>
      </main>

      <SmartFoodSearchModal
        isOpen={activeForm === 'food'}
        onClose={() => setActiveForm(null)}
        onSave={handleFoodSave}
        apiBaseUrl={apiBaseUrl}
        userId={userId}
        skipTypeSelect
      />
      <ManualWeightEntryModal
        isOpen={activeForm === 'weight'}
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
        isOpen={activeForm === 'smartwatch'}
        onClose={() => setActiveForm(null)}
        onSave={handleWatchSave}
        onBack={() => setActiveForm(null)}
        todayBaseline={workoutTodayKcal}
        loading={workoutTodayLoading}
      />
      <ManualEducationEntryModal
        isOpen={activeForm === 'education'}
        onClose={() => setActiveForm(null)}
        onSave={handleEducationSave}
        skipTypeSelect
        formTitle="Education"
        formSubtitle="Choose platform and meeting session"
      />
      <ShakeCalculatorModal
        isOpen={activeForm === 'shake'}
        onClose={() => setActiveForm(null)}
        onLog={handleShakeLog}
      />
      <ServingStepperModal
        isOpen={activeForm === 'afresh'}
        title="Afresh"
        subtitle="Log number of scoops consumed so far"
        unitLabel="Scoops"
        iconSrc="/coffee.png"
        min={1}
        max={8}
        step={1}
        defaultValue={AFRESH_PRODUCT.defaultScoops}
        onClose={() => setActiveForm(null)}
        onConfirm={handleAfreshConfirm}
        confirmLabel="Log Afresh"
      />
      <ServingStepperModal
        isOpen={activeForm === 'water'}
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
