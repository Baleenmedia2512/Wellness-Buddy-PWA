/**
 * CaptureClassifyPage — full-screen post-capture: pick type or run AI in background.
 * AI does not populate this screen; results appear in Diary.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Loader2,
  Sparkles,
  UtensilsCrossed,
  GraduationCap,
  Droplets,
  Info,
  Timer,
} from 'lucide-react';
import { isFlagEnabled } from '../../config/featureFlags';
import {
  promoteUnknownToFood,
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
import { ManualWeightEntryModal, saveWeight } from '../../features/weight';
import { ManualEducationEntryModal, saveLog } from '../../features/education';
import { ManualWatchEntryModal } from '../../features/activity';
import {
  fetchAiCreditsStatus,
  reserveAiCredit,
} from '../../features/ai-credits';
import { fetchWaterIntake, todayLocal } from '../../features/water';

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
  { id: 'education', Icon: GraduationCap, label: 'Education' },
  { id: 'shake', src: '/bottle.png', label: 'Shake', isImgIcon: true },
  { id: 'water', Icon: Droplets, label: 'Water' },
  { id: 'food', Icon: UtensilsCrossed, label: 'Food' },
  // smartwatch flow = calories burned; label is Exercise (green fire)
  { id: 'smartwatch', src: '/emoji/1f525-green.svg', label: 'Exercise', isImgIcon: true },
];

/** Home hero banner greens — keep classify screen on-brand with Take Photo card. */
const BRAND = {
  pageBg: '#e8f5e9',
  hero: 'linear-gradient(135deg, #064e3b 0%, #065f46 45%, #047857 100%)',
  mint: '#e8f5e9',
  forest: '#064e3b',
  active: '#16a34a',
};

/** Milliseconds until next local midnight in `timezoneIana` (credit day boundary). */
function msUntilNextMidnight(timezoneIana) {
  const tz = timezoneIana || 'Asia/Kolkata';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const num = (type) => Number(parts.find((p) => p.type === type)?.value || 0);
  const elapsed = num('hour') * 3600 + num('minute') * 60 + num('second');
  const remainingSec = Math.max(0, 24 * 3600 - elapsed);
  // At exactly 00:00:00, day just flipped — treat as 0 for unlock UX.
  return remainingSec === 24 * 3600 ? 0 : remainingSec * 1000;
}

function formatCountdown(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function useCreditsResetCountdown(timezoneIana) {
  const [label, setLabel] = useState(() =>
    formatCountdown(msUntilNextMidnight(timezoneIana)),
  );
  useEffect(() => {
    const tick = () => setLabel(formatCountdown(msUntilNextMidnight(timezoneIana)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [timezoneIana]);
  return label;
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

function AiCreditsPanel({ credits, loading, outOfCredits }) {
  const resetIn = useCreditsResetCountdown(credits?.timezoneIana);

  if (loading && !credits) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-green-100 bg-white px-3.5 py-3 shadow-sm">
        <Loader2 className="h-4 w-4 animate-spin text-emerald-700" />
        <span className="text-sm text-green-700/70">Checking AI credits…</span>
      </div>
    );
  }
  if (!credits) return null;

  const limit = Math.max(0, Number(credits.dailyLimit) || 0);
  const used = Math.max(0, Number(credits.used) || 0);
  const remaining = Math.max(0, Number(credits.remaining) ?? Math.max(0, limit - used));
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;

  return (
    <div className="overflow-hidden rounded-2xl border border-green-100 bg-white shadow-sm">
      <div className="px-3.5 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700/80">
              Daily AI credits
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-bold text-gray-900">
              <span className={outOfCredits ? 'text-amber-600' : 'text-emerald-700'}>
                {remaining}
              </span>
              <span className="font-semibold text-gray-400"> of {limit} left</span>
            </p>
          </div>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: BRAND.mint }}>
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${pct}%`,
              background: outOfCredits ? '#d97706' : BRAND.active,
            }}
          />
        </div>
        <div className="mt-2.5 flex items-center justify-between gap-2 rounded-xl px-2.5 py-2" style={{ background: BRAND.mint }}>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
            <Timer className="h-3.5 w-3.5 text-emerald-700" aria-hidden />
            {outOfCredits ? 'New AI unlocks in' : 'Credits refresh in'}
          </span>
          <span className="font-mono text-sm font-extrabold tabular-nums text-emerald-900" aria-live="polite">
            {resetIn}
          </span>
        </div>
      </div>
      <div
        className="flex items-start gap-1.5 border-t border-green-50 px-3.5 py-2 text-[11px] leading-snug text-emerald-800/80"
        style={{ background: BRAND.mint }}
      >
        <Info className="mt-0.5 h-3 w-3 shrink-0 text-emerald-700" aria-hidden />
        {outOfCredits
          ? 'Limit reached for today. Log with a type below — no AI charge.'
          : '1 credit = 1 AI run (including unrecognised photos). Types below use 0 credits.'}
      </div>
    </div>
  );
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
  // Today's hydration total (all exempted beverages) — water stepper tracks this.
  const [waterTodayMl, setWaterTodayMl] = useState(0);
  const [waterTodayLoading, setWaterTodayLoading] = useState(false);

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

  const exit = () => {
    onSaved?.();
    onBack?.();
  };

  const saveFoodAnalysis = async (analysisResult, toastMsg) => {
    await promoteUnknownToFood({
      captureId,
      viewerUserId: userId,
      analysisResult,
      originalCapturedAt: originalCapturedAt || null,
    });
    onToast?.(toastMsg);
    exit();
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
      exit();
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
      exit();
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
      exit();
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
      exit();
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
  const aiLockedUi = outOfCredits;
  const aiDisabled = aiStarting || outOfCredits || creditsChecking;

  return (
    <div className="fixed inset-0 z-40 flex flex-col" style={{ background: BRAND.pageBg }}>
      {/* Header — white bar like Home */}
      <header className="safe-top shrink-0 border-b border-green-100 bg-white shadow-sm">
        <div className="mx-auto flex max-w-lg items-center gap-2 px-3 py-2.5">
          <button
            type="button"
            onClick={onBack}
            className="rounded-xl p-2 text-emerald-700 transition hover:bg-[#e8f5e9]"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-extrabold text-green-700">Classify photo</h1>
            <p className="truncate text-xs text-green-600">
              {showAiButton
                ? 'AI analyze, or log a type now'
                : 'Choose a type to log now'}
            </p>
          </div>
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-sm"
            style={{ background: BRAND.hero }}
            aria-hidden
          >
            {showAiButton ? (
              <Sparkles className="h-4 w-4" />
            ) : (
              <UtensilsCrossed className="h-4 w-4" />
            )}
          </div>
        </div>
      </header>

      {/* Body — flex layout, no page scroll */}
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-3 overflow-hidden px-3 pb-3 pt-3">
        {showCreditsPanel && (
          <AiCreditsPanel
            credits={credits}
            loading={creditsLoading}
            outOfCredits={outOfCredits}
          />
        )}

        {/* Photo: thumb + AI CTA when AI on; full preview when AI off */}
        {showAiButton ? (
          <section className="flex shrink-0 items-stretch gap-2.5">
            {previewSrc ? (
              <div className="h-[4.75rem] w-[4.75rem] shrink-0 overflow-hidden rounded-2xl border border-green-100 bg-white shadow-sm">
                <img
                  src={previewSrc}
                  alt="Captured"
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              <div className="h-[4.75rem] w-[4.75rem] shrink-0 rounded-2xl" style={{ background: BRAND.mint }} />
            )}
            <button
              type="button"
              onClick={handleAiAnalyze}
              disabled={aiDisabled}
              className={[
                'flex min-h-[4.75rem] flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-3 text-center transition active:scale-[0.99]',
                aiLockedUi
                  ? 'cursor-not-allowed bg-white text-gray-400 shadow-sm ring-1 ring-gray-200'
                  : 'text-white shadow-lg',
              ].join(' ')}
              style={aiLockedUi ? undefined : { background: BRAND.hero }}
            >
              {aiStarting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Sparkles className="h-5 w-5" />
              )}
              <span className="text-sm font-bold leading-tight">
                {aiStarting
                  ? 'Starting…'
                  : outOfCredits
                    ? 'Daily limit reached'
                    : 'Analyze with AI'}
              </span>
              {!aiStarting && !outOfCredits && (
                <span className="text-[10px] font-medium text-emerald-200">
                  Uses 1 credit · result in Diary
                </span>
              )}
              {outOfCredits && (
                <span className="text-[10px] font-medium text-gray-400">
                  Use a type below instead
                </span>
              )}
            </button>
          </section>
        ) : (
          <section className="shrink-0">
            {previewSrc ? (
              <div
                className="flex w-full items-center justify-center overflow-hidden rounded-2xl border border-green-100 shadow-sm"
                style={{ background: BRAND.mint, maxHeight: '11rem', minHeight: '7.5rem' }}
              >
                <img
                  src={previewSrc}
                  alt="Captured"
                  className="max-h-44 w-full object-contain"
                />
              </div>
            ) : (
              <div
                className="w-full rounded-2xl"
                style={{ background: BRAND.mint, height: '7.5rem' }}
              />
            )}
          </section>
        )}

        {hint && (
          <p className="shrink-0 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {hint}
          </p>
        )}

        {/* Type grid */}
        <section className="flex min-h-0 flex-1 flex-col">
          <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700/70">
              {showAiButton ? 'Or log as' : 'Log as'}
            </p>
            {showAiButton && (
              <p className="text-[10px] font-medium text-green-600/70">0 credits · no AI</p>
            )}
          </div>
          <div className="grid min-h-0 flex-1 grid-cols-4 content-start gap-2">
            {CATEGORIES.map(({ id, Icon, src, label, isImgIcon }) => (
              <button
                key={id}
                type="button"
                disabled={saving || aiStarting}
                onClick={() => handleCategoryClick(id)}
                className="flex min-h-0 flex-col items-center justify-center gap-1.5 rounded-2xl border border-green-100 bg-white px-1.5 py-3 text-center shadow-sm transition hover:border-green-300 hover:shadow-md active:scale-[0.97] disabled:opacity-50"
              >
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-emerald-700"
                  style={{ background: BRAND.mint }}
                >
                  {isImgIcon ? (
                    <PublicIcon src={src} className="h-5 w-5" alt="" />
                  ) : (
                    <Icon className="h-[18px] w-[18px]" strokeWidth={2.1} aria-hidden />
                  )}
                </span>
                <span className="text-[12px] font-bold leading-tight text-emerald-900">{label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Footer — mint pill like Wellness Score “Tap to view…” */}
        <button
          type="button"
          onClick={onBack}
          className="safe-bottom inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold text-emerald-700 shadow-sm transition active:scale-[0.99]"
          style={{ background: BRAND.mint }}
        >
          <ArrowLeft className="h-4 w-4" />
          Later — keep in Diary
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
        skipTypeSelect
      />
      <ManualWatchEntryModal
        isOpen={activeForm === 'smartwatch'}
        onClose={() => setActiveForm(null)}
        onSave={handleWatchSave}
        onBack={() => setActiveForm(null)}
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
        subtitle="Macros scale by scoops — e.g. 2–3 scoops in one cup of water"
        unitLabel="Scoops"
        min={AFRESH_PRODUCT.minScoops}
        max={AFRESH_PRODUCT.maxScoops}
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
        unitLabel="Amount"
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
