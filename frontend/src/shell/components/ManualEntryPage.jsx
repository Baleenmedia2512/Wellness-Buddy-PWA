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
  Watch,
  Droplets,
  CupSoda,
  Milk,
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
} from '../../features/nutrition';
import { ManualWeightEntryModal, saveWeight } from '../../features/weight';
import { saveLog } from '../../features/education';
import { ManualWatchEntryModal } from '../../features/activity';
import {
  fetchAiCreditsStatus,
  reserveAiCredit,
} from '../../features/ai-credits';
import BathroomScaleIcon from '../../shared/components/icons/BathroomScaleIcon';

const CATEGORIES = [
  { id: 'food', Icon: UtensilsCrossed, label: 'Food' },
  { id: 'weight', Icon: BathroomScaleIcon, label: 'Weight', isImgIcon: true },
  { id: 'education', Icon: GraduationCap, label: 'Education' },
  { id: 'smartwatch', Icon: Watch, label: 'Watch' },
  { id: 'water', Icon: Droplets, label: 'Water' },
  { id: 'afresh', Icon: CupSoda, label: 'Afresh' },
  { id: 'shake', Icon: Milk, label: 'Shake' },
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
    const total = m.total || foods.reduce(
      (a, f) => ({
        calories: a.calories + (f.nutrition.calories || 0),
        protein: a.protein + (f.nutrition.protein || 0),
        carbs: a.carbs + (f.nutrition.carbs || 0),
        fat: a.fat + (f.nutrition.fat || 0),
        fiber: a.fiber + (f.nutrition.fiber || 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
    );
    return { foods, total, confidence: 'high' };
  }
  const item = toItem({
    name: m.foodName,
    calories: m.calories,
    protein: m.protein,
    carbs: m.carbs,
    fat: m.fat,
    fiber: m.fiber,
  });
  return { foods: [item], total: item.nutrition, confidence: 'high' };
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
            <p className="mt-0.5 text-sm font-bold text-gray-900">
              <span className={outOfCredits ? 'text-amber-600' : 'text-emerald-700'}>
                {remaining}
              </span>
              <span className="font-semibold text-gray-400"> of {limit} left</span>
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs text-gray-500">Used today</p>
            <p className="text-sm font-extrabold tabular-nums text-emerald-700">{used}/{limit}</p>
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
          ? 'Limit reached for today. Log with a type below — no AI charge. Resets at midnight.'
          : '1 credit = 1 successful food AI recognition. Types below use 0 credits.'}
      </div>
    </div>
  );
}

export default function ManualEntryPage({
  userId,
  apiBaseUrl,
  captureId,
  imageBase64,
  onBack,
  onSaved,
  onStartBackgroundAi,
  onToast,
}) {
  const creditsEnabled = isFlagEnabled('ff.ai-credits');
  const [credits, setCredits] = useState(null);
  const [creditsLoading, setCreditsLoading] = useState(false);
  const [aiStarting, setAiStarting] = useState(false);
  const [hint, setHint] = useState(null);
  const [activeForm, setActiveForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const previewSrc = useMemo(() => {
    if (!imageBase64) return null;
    return imageBase64.startsWith('data:')
      ? imageBase64
      : `data:image/jpeg;base64,${imageBase64}`;
  }, [imageBase64]);

  const refreshCredits = useCallback(async () => {
    if (!creditsEnabled || !userId) return;
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

  const exit = () => {
    onSaved?.();
    onBack?.();
  };

  const saveFoodAnalysis = async (analysisResult, toastMsg) => {
    await promoteUnknownToFood({
      captureId,
      viewerUserId: userId,
      analysisResult,
      originalCapturedAt: null,
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

  /** Education: one tap — always Zoom, no platform picker. */
  const handleEducationTap = async () => {
    if (saving) return;
    setSaving(true);
    setHint(null);
    try {
      await saveLog({
        userId,
        platform: 'Zoom',
        topic: 'Education Meeting',
        captureId,
        imageBase64,
      });
      onToast?.('Education saved to Diary');
      exit();
    } catch (err) {
      setHint(err?.message || 'Failed to save education');
    } finally {
      setSaving(false);
    }
  };

  const handleCategoryClick = (id) => {
    if (saving || aiStarting) return;
    if (id === 'education') {
      handleEducationTap();
      return;
    }
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

  const handleAfreshConfirm = async (cups) => {
    await saveFoodAnalysis(buildAfreshAnalysisResult(cups), 'Afresh saved to Diary');
    setActiveForm(null);
  };

  const handleWaterConfirm = async (ml) => {
    await saveFoodAnalysis(buildWaterAnalysisResult(ml), 'Water saved to Diary');
    setActiveForm(null);
  };

  const showAiButton = !creditsEnabled || credits?.enabled !== false;
  const outOfCredits = creditsEnabled && credits && (credits.remaining ?? 0) <= 0;
  const aiDisabled = aiStarting || outOfCredits || creditsLoading;

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
            <p className="truncate text-xs text-green-600">AI analyze, or log a type now</p>
          </div>
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-sm"
            style={{ background: BRAND.hero }}
          >
            <Sparkles className="h-4 w-4" aria-hidden />
          </div>
        </div>
      </header>

      {/* Body — flex layout, no page scroll */}
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-3 overflow-hidden px-3 pb-3 pt-3">
        {creditsEnabled && (
          <AiCreditsPanel
            credits={credits}
            loading={creditsLoading}
            outOfCredits={outOfCredits}
          />
        )}

        {/* Compact photo + AI CTA (hero greens = Take Photo banner) */}
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
            <div className="h-[4.75rem] w-[4.75rem] shrink-0 rounded-2xl bg-white" style={{ background: BRAND.mint }} />
          )}
          {showAiButton && (
            <button
              type="button"
              onClick={handleAiAnalyze}
              disabled={aiDisabled}
              className={[
                'flex min-h-[4.75rem] flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-3 text-center shadow-lg transition active:scale-[0.99]',
                outOfCredits
                  ? 'cursor-not-allowed bg-white text-gray-400 ring-1 ring-gray-200 shadow-sm'
                  : 'text-white',
              ].join(' ')}
              style={outOfCredits ? undefined : { background: BRAND.hero }}
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
                    ? 'AI limit reached'
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
          )}
        </section>

        {hint && (
          <p className="shrink-0 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {hint}
          </p>
        )}

        {/* Type grid — white cards, forest-green icons (Home nav style) */}
        <section className="flex min-h-0 flex-1 flex-col">
          <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700/70">
              Or log as
            </p>
            <p className="text-[10px] font-medium text-green-600/70">0 credits · no AI</p>
          </div>
          <div className="grid min-h-0 flex-1 grid-cols-4 content-start gap-2">
            {CATEGORIES.map(({ id, Icon, label, isImgIcon }) => (
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
                    <Icon className="h-5 w-5" alt="" />
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
      <ShakeCalculatorModal
        isOpen={activeForm === 'shake'}
        onClose={() => setActiveForm(null)}
        onLog={handleShakeLog}
      />
      <ServingStepperModal
        isOpen={activeForm === 'afresh'}
        title="Afresh"
        subtitle="Uses preset Herbalife Afresh macros per cup"
        unitLabel="Cups"
        min={1}
        max={8}
        step={1}
        defaultValue={1}
        onClose={() => setActiveForm(null)}
        onConfirm={handleAfreshConfirm}
        confirmLabel="Log Afresh"
      />
      <ServingStepperModal
        isOpen={activeForm === 'water'}
        title="Water"
        subtitle="Log how much you drank"
        unitLabel="Amount"
        min={100}
        max={2000}
        step={100}
        defaultValue={250}
        formatValue={(n) => `${n} ml`}
        onClose={() => setActiveForm(null)}
        onConfirm={handleWaterConfirm}
        confirmLabel="Log Water"
      />
    </div>
  );
}
