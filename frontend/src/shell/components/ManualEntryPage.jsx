/**
 * CaptureClassifyPage — post-capture: pick type or run AI in background.
 * AI does not populate this screen; results appear in Diary (same as before).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Loader2, Sparkles, X } from 'lucide-react';
import { isFlagEnabled } from '../../config/featureFlags';
import {
  promoteUnknownToFood,
} from '../../features/captures';
import { SmartFoodSearchModal } from '../../features/nutrition';
import { ManualWeightEntryModal, saveWeight } from '../../features/weight';
import { ManualEducationEntryModal, saveLog } from '../../features/education';
import { ManualWatchEntryModal } from '../../features/activity';
import {
  fetchAiCreditsStatus,
  reserveAiCredit,
} from '../../features/ai-credits';

const CATEGORIES = [
  { id: 'food', icon: '🍽️', label: 'Food / Drink', sub: 'Meal, shake, tea…' },
  { id: 'weight', icon: '⚖️', label: 'Weight', sub: 'Scale reading' },
  { id: 'education', icon: '🎓', label: 'Education', sub: 'Meeting screenshot' },
  { id: 'exercise', icon: '⌚', label: 'Exercise', sub: 'Calories burned' },
];

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

export default function ManualEntryPage({
  userId,
  apiBaseUrl,
  captureId,
  imageBase64,
  onBack,
  onSaved,
  onStartBackgroundAi,
}) {
  const creditsEnabled = isFlagEnabled('ff.ai-credits');
  const [credits, setCredits] = useState(null);
  const [creditsLoading, setCreditsLoading] = useState(false);
  const [aiStarting, setAiStarting] = useState(false);
  const [hint, setHint] = useState(null);
  const [activeForm, setActiveForm] = useState(null); // food | weight | education | exercise | null
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
      // Exit immediately; analysis continues in background → Diary.
      onStartBackgroundAi?.({ reservationId });
      exit();
    } catch (err) {
      setHint(err?.message || 'Could not start AI — pick a type below.');
      setAiStarting(false);
    }
  };

  const handleFoodSave = async (manualData) => {
    setSaving(true);
    try {
      await promoteUnknownToFood({
        captureId,
        viewerUserId: userId,
        analysisResult: buildAnalysisFromManualFood(manualData),
        originalCapturedAt: null,
      });
      setActiveForm(null);
      exit();
    } catch (err) {
      setHint(err?.message || 'Failed to save food');
      throw err;
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
      exit();
    } catch (err) {
      setHint(err?.message || 'Failed to save weight');
      throw err;
    } finally {
      setSaving(false);
    }
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
      exit();
    } catch (err) {
      setHint(err?.message || 'Failed to save education');
      throw err;
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
      exit();
    } catch (err) {
      setHint(err?.message || 'Failed to save activity');
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const showAiButton = !creditsEnabled || credits?.enabled;
  const outOfCredits = creditsEnabled && credits && (credits.remaining ?? 0) <= 0;
  const aiDisabled = aiStarting || outOfCredits || creditsLoading;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-black/70">
      <div className="mt-auto mx-auto w-full max-w-sm rounded-t-3xl bg-white shadow-xl max-h-[92vh] flex flex-col safe-bottom">
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-2">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-gray-900">What is this photo?</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Analyze with AI, or choose a type to log now.
            </p>
            {creditsEnabled && credits && (
              <p className="text-xs text-gray-400 mt-1">
                AI left today: {credits.remaining}/{credits.dailyLimit}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onBack}
            className="rounded-full p-2 text-gray-500 hover:bg-gray-100 shrink-0"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 pb-6 space-y-4">
          {previewSrc && (
            <img
              src={previewSrc}
              alt="Captured"
              className="w-full rounded-xl object-cover max-h-48 bg-gray-100"
            />
          )}

          {showAiButton && (
            <button
              type="button"
              onClick={handleAiAnalyze}
              disabled={aiDisabled}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3.5 text-sm font-semibold text-white disabled:bg-gray-300 disabled:text-gray-600"
            >
              {aiStarting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {aiStarting
                ? 'Starting…'
                : outOfCredits
                  ? 'Daily AI limit reached'
                  : 'Analyze with AI'}
            </button>
          )}

          {hint && (
            <p className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
              {hint}
            </p>
          )}

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Or log as
            </p>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map(({ id, icon, label, sub }) => (
                <button
                  key={id}
                  type="button"
                  disabled={saving || aiStarting}
                  onClick={() => setActiveForm(id)}
                  className="flex flex-col items-start gap-0.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-left hover:border-emerald-300 hover:bg-emerald-50/50 active:scale-[0.98] transition disabled:opacity-50"
                >
                  <span className="text-xl leading-none">{icon}</span>
                  <span className="text-sm font-semibold text-gray-900">{label}</span>
                  <span className="text-xs text-gray-500">{sub}</span>
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={onBack}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Done — keep photo in Diary
          </button>
        </div>
      </div>

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
      <ManualEducationEntryModal
        isOpen={activeForm === 'education'}
        onClose={() => setActiveForm(null)}
        onSave={handleEducationSave}
        onBack={() => setActiveForm(null)}
        skipTypeSelect
      />
      <ManualWatchEntryModal
        isOpen={activeForm === 'exercise'}
        onClose={() => setActiveForm(null)}
        onSave={handleWatchSave}
        onBack={() => setActiveForm(null)}
      />
    </div>
  );
}
