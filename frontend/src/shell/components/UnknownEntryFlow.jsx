/**
 * UnknownEntryFlow.jsx — shell-hosted flow for an "Other" (unknown) diary row.
 *
 * ADR-0003: tapping an unknown row on the single Diary page opens this flow.
 *   - view:    UnknownShareViewer shows the image with Retry / Edit / Delete.
 *   - Retry:   re-run Gemini on the image; if confident, promote unknown→food.
 *   - Edit:    pick a category (Food / Weight / Education) and transfer the
 *              data to that vertical:
 *                · Food      → SmartFoodSearchModal → promote the capture
 *                              unknown→food with the chosen nutrition.
 *                · Weight    → ManualWeightEntryModal → save a weight record.
 *                · Education → ManualEducationEntryModal → save an education log.
 *   - Delete:  soft-delete the capture (2026-06-09).
 *
 * The shell layer is permitted to compose features/* (see shell/README).
 * On any successful change we call `onChanged()` so the feed re-fetches.
 */
import React, { useState } from 'react';
import { analyzeImage } from '../../shared/services/orchestratorService';
// VSA-compliant barrel imports (helpers exported via features/captures/index.js)
import {
  promoteUnknownToFood,
  deleteCapture,
  buildAnalysisFromGeminiAnalysis,
  hasRecognizedFood,
} from '../../features/captures';
import { SmartFoodSearchModal } from '../../features/nutrition';
import { ManualWeightEntryModal, saveWeight } from '../../features/weight';
import { ManualEducationEntryModal, saveLog } from '../../features/education';

function base64ToImageFile(b64, filename = 'capture.jpg') {
  const dataUrl = b64.startsWith('data:') ? b64 : `data:image/jpeg;base64,${b64}`;
  const [meta, content] = dataUrl.split(',');
  const mime = (meta.match(/data:(.*?);/) || [, 'image/jpeg'])[1];
  const bin = atob(content);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], filename, { type: mime });
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
    calories: m.calories, protein: m.protein, carbs: m.carbs, fat: m.fat, fiber: m.fiber,
  });
  return { foods: [item], total: item.nutrition, confidence: 'high' };
}

export default function UnknownEntryFlow({
  open,
  captureId,
  imageBase64,
  canMutate = true,
  userId,
  apiBaseUrl,
  onClose,
  onChanged,
  onDeleteWithUndo,
}) {
  const [stage, setStage] = useState('view'); // view | pick | food | weight | education
  const [retrying, setRetrying] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);

  // Auto-run AI retry in background when the viewer opens.
  // This way the user sees the image + type picker immediately while AI is working.
  const hasAutoRetried = React.useRef(false);

  React.useEffect(() => {
    if (!open || !canMutate || !captureId || !imageBase64 || !userId) return;
    if (hasAutoRetried.current) return;
    hasAutoRetried.current = true;
    // Kick off AI analysis silently without blocking the UI
    runAiRetry({ silent: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const close = () => {
    setStage('view');
    setRetrying(false);
    setDeleting(false);
    setError(null);
    hasAutoRetried.current = false;
    onClose?.();
  };

  const finish = (change = { kind: 'unknown' }) => {
    onChanged?.(change);
    close();
  };

  const retagCapture = async (imageType) => {
    if (!captureId || !userId || !apiBaseUrl) return;
    await fetch(`${apiBaseUrl}/api/background-analysis/captures`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: captureId, userId, imageType }),
    });
  };

  /**
   * Run the AI analysis on the stored image.
   * IMPORTANT: we do NOT pass captureId to analyzeImage here so the
   * backend idempotency guard doesn't return the cached "other" result
   * from the original failed classification.
   *
   * @param {{ silent?: boolean }} opts  When silent=true, errors are swallowed
   *   (used for the background auto-retry on modal open).
   */
  const runAiRetry = async ({ silent = false } = {}) => {
    if (!imageBase64 || !userId) return;
    if (!silent) { setRetrying(true); setError(null); }
    try {
      const file = base64ToImageFile(imageBase64);
      // Do NOT pass captureId — avoids idempotency guard returning cached "other"
      const detectedType = await analyzeImage(file, { userId });

      if (detectedType.type === 'food') {
        const analysis = detectedType.details;
        if (!hasRecognizedFood(analysis)) {
          if (!silent) { setRetrying(false); setError("Still couldn't recognise it — choose a category below."); }
          return;
        }
        const analysisResult = buildAnalysisFromGeminiAnalysis(analysis);
        await promoteUnknownToFood({ captureId, viewerUserId: userId, analysisResult });
        setRetrying(false);
        finish({ kind: 'food', captureId });

      } else if (detectedType.type === 'weight' && detectedType.details?.weightValue) {
        await saveWeight({
          userId,
          weightValue: detectedType.details.weightValue,
          unit: detectedType.details.unit || 'kg',
          captureId,
          imageBase64ToSave: imageBase64,
        });
        await retagCapture('weight');
        setRetrying(false);
        finish({ kind: 'weight', captureId });

      } else if (detectedType.type === 'education') {
        await saveLog({
          userId,
          platform: detectedType.details.platform || 'Online Meeting',
          topic: 'Education Meeting',
          captureId,
          imageBase64,
        });
        await retagCapture('education');
        setRetrying(false);
        finish({ kind: 'education', captureId });

      } else if (detectedType.type === 'smartwatch') {
        await saveLog({
          userId,
          platform: detectedType.details.source || 'Smartwatch',
          topic: `Calories Burned: ${detectedType.details.caloriesBurned || 0} kcal`,
          captureId,
          imageBase64,
        });
        await retagCapture('smartwatch');
        setRetrying(false);
        finish({ kind: 'smartwatch', captureId });

      } else {
        // AI returned "other" — show the category picker so user can manually classify
        if (!silent) {
          setRetrying(false);
          setError("Still couldn't identify it. Please choose a category:");
          setStage('view'); // Stay on view so category buttons are visible
        }
      }
    } catch {
      if (!silent) {
        setRetrying(false);
        setError("Analysis failed — please choose a category manually:");
      }
    }
  };

  const handleRetry = () => runAiRetry({ silent: false });

  const handleDelete = async () => {
    if (!captureId || !userId) return;

    // 2026-06-09: If onDeleteWithUndo is provided, use the undo pattern (show banner).
    // Otherwise, fall back to immediate delete (legacy behavior).
    if (onDeleteWithUndo) {
      setDeleting(true);
      setError(null);
      try {
        await deleteCapture({ captureId, userId });
        setDeleting(false);
        // Close modal and trigger undo banner
        onDeleteWithUndo({ captureId, imageBase64 });
      } catch {
        setDeleting(false);
        setError("Couldn't delete — please try again.");
      }
    } else {
      // Legacy immediate delete (for share-link viewer, etc.)
      setDeleting(true);
      setError(null);
      try {
        await deleteCapture({ captureId, userId });
        setDeleting(false);
        finish();
      } catch {
        setDeleting(false);
        setError("Couldn't delete — please try again.");
      }
    }
  };

  const handleFoodSave = async (manualData) => {
    try {
      const analysisResult = buildAnalysisFromManualFood(manualData);
      await promoteUnknownToFood({ captureId, viewerUserId: userId, analysisResult });
      finish({ kind: 'food', captureId });
    } catch {
      setError("Couldn't save — please try again.");
      setStage('view');
    }
  };

  const handleWeightSave = async ({ weightValue, unit, bmr }) => {
    try {
      await saveWeight({
        userId,
        weightValue,  // Backend expects 'weightValue', not 'weight'
        unit,
        bmr,
        captureId,
        imageBase64ToSave: imageBase64,
      });
      finish({ kind: 'weight', captureId });
    } catch {
      setError("Couldn't save — please try again.");
      setStage('view');
    }
  };

  const handleEducationSave = async ({ platform, topic }) => {
    try {
      await saveLog({
        userId,
        platform,
        topic,
        captureId,
        imageBase64,
      });
      finish({ kind: 'education', captureId });
    } catch {
      setError("Couldn't save — please try again.");
      setStage('view');
    }
  };

  return (
    <>
      {/* ── View stage: image + AI retry indicator + inline category picks ── */}
      {stage === 'view' && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70"
          onClick={close}
        >
          <div
            className="w-full max-w-sm rounded-t-3xl bg-white shadow-xl overflow-y-auto max-h-[90vh] pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-2">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Unrecognised photo</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {retrying ? 'AI is re-analysing…' : 'Help us classify this capture.'}
                </p>
              </div>
              <button type="button" onClick={close} aria-label="Close"
                className="rounded-full p-1 text-gray-400 hover:bg-gray-100">✕</button>
            </div>

            {/* Image */}
            <div className="px-5 pb-3">
              {imageBase64 ? (
                <img
                  src={imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`}
                  alt="Captured photo"
                  className="w-full rounded-xl object-cover max-h-56"
                />
              ) : (
                <div className="flex h-40 items-center justify-center rounded-xl bg-gray-100 text-sm text-gray-400">
                  Image unavailable
                </div>
              )}
            </div>

            {/* AI status strip */}
            {retrying && (
              <div className="mx-5 mb-3 flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />
                <span className="text-sm text-blue-700 font-medium">AI is re-analysing — you can also pick below…</span>
              </div>
            )}

            {/* Error / hint */}
            {error && !retrying && (
              <div className="mx-5 mb-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            {/* ── Inline category quick-picks (always visible) ── */}
            {canMutate && (
              <div className="px-5 space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  What is this photo?
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { type: 'food',      icon: '🍽️', label: 'Food / Drink',    sub: 'Meal, shake, tea, etc.' },
                    { type: 'weight',    icon: '⚖️',  label: 'Weight Scale',   sub: 'Scale with reading' },
                    { type: 'education', icon: '🎓',  label: 'Education',      sub: 'Meeting screenshot' },
                    { type: 'smartwatch',icon: '⌚',  label: 'Smartwatch',     sub: 'Steps / calories' },
                  ].map(({ type, icon, label, sub }) => (
                    <button
                      key={type}
                      type="button"
                      disabled={retrying || deleting}
                      onClick={() => { setError(null); setStage(type); }}
                      className="flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 border-gray-200 hover:border-emerald-400 hover:bg-emerald-50 active:bg-emerald-100 disabled:opacity-50 transition-colors"
                    >
                      <span className="text-2xl">{icon}</span>
                      <span className="text-sm font-semibold text-gray-900 text-center">{label}</span>
                      <span className="text-xs text-gray-500 text-center leading-tight">{sub}</span>
                    </button>
                  ))}
                </div>

                {/* Retry AI button — secondary action */}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    disabled={retrying || deleting}
                    onClick={handleRetry}
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {retrying ? 'Analysing…' : '🔄 Retry AI'}
                  </button>
                  <button
                    type="button"
                    disabled={retrying || deleting}
                    onClick={handleDelete}
                    className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    {deleting ? 'Deleting…' : '🗑️ Delete'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Category modals ── */}
      <SmartFoodSearchModal
        isOpen={stage === 'food'}
        onClose={() => setStage('view')}
        onSave={handleFoodSave}
        apiBaseUrl={apiBaseUrl}
        userId={userId}
        timeLabel="What food was in this photo?"
        skipTypeSelect={true}
        altSwitchButtons={[
          { label: 'Weight', icon: '⚖️', sub: "It's a scale photo", onClick: () => setStage('weight') },
          { label: 'Education', icon: '🎓', sub: "It's a meeting screen", onClick: () => setStage('education') },
        ]}
      />

      <ManualWeightEntryModal
        isOpen={stage === 'weight'}
        onClose={() => setStage('view')}
        onBack={() => setStage('view')}
        onSave={handleWeightSave}
        imagePreview={imageBase64}
      />

      <ManualEducationEntryModal
        isOpen={stage === 'education'}
        onClose={() => setStage('view')}
        onBack={() => setStage('view')}
        onSave={handleEducationSave}
      />
    </>
  );
}
