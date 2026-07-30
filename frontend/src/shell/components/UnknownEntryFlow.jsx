/**
 * UnknownEntryFlow.jsx — shell-hosted flow for an "Other" (unknown) diary row.
 *
 * ADR-0003: tapping an unknown row on the single Diary page opens this flow.
 *   - view:    UnknownShareViewer shows the image with Retry / Edit / Delete.
 *   - Retry:   re-run Gemini on the image; if confident, promote unknown→food.
 *   - Edit:    pick a category (Food / Weight / Education / Smartwatch) and transfer
 *              the data to that vertical:
 *                · Food       → SmartFoodSearchModal → promote the capture
 *                               unknown→food with the chosen nutrition.
 *                · Weight     → ManualWeightEntryModal → save a weight record.
 *                · Education  → ManualEducationEntryModal → save an education log.
 *                · Smartwatch → ManualWatchEntryModal → save calories burned.
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
import { buildAnalysisFromManualFood as buildManualFoodAnalysis } from '../../features/nutrition';
import { ManualWeightEntryModal, saveWeight } from '../../features/weight';
import { ManualEducationEntryModal, saveLog } from '../../features/education';
import { ManualWatchEntryModal } from '../../features/activity';
import { extractCaloriesValue } from '../../features/education/services/educationFormatter';
import { isFlagEnabled } from '../../config/featureFlags';
import {
  reserveAiCredit,
  confirmAiCredit,
  releaseAiCredit,
} from '../../features/ai-credits';

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
  return buildManualFoodAnalysis(m);
}

/**
 * Build an ISO timestamp for noon on the given Date, used to anchor weight /
 * education saves to the diary's selected date instead of the current time.
 * Noon is chosen to land safely within all activity time windows.
 * Returns undefined when no date is provided so callers fall through to
 * their own default (backend getISTTimestamp).
 */
function buildNoonTimestamp(date) {
  if (!date) return undefined;
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

/** Prefer the original upload instant; fall back to diary-date noon only when missing. */
function resolveManualLogTimestamp(originalCapturedAt, diaryDate) {
  if (originalCapturedAt) return originalCapturedAt;
  return buildNoonTimestamp(diaryDate);
}

export default function UnknownEntryFlow({
  open,
  captureId,
  imageBase64,
  /**
   * Result from the pre-flight AI analysis that Dashboard.js ran BEFORE
   * opening this modal (so the user sees a loading state on the card, not
   * an immediately-open modal with silent background AI).
   *
   * Shape:
   *   null                                     → no pre-flight run (e.g. canMutate=false)
   *   { status: 'failed', canRetry: boolean,
   *     error: string }                        → AI could not identify the image.
   *                                              canRetry=true  → transient failure (503/timeout), Retry AI shown.
   *                                              canRetry=false → genuinely out-of-scope, Retry AI hidden.
   *   { status: 'success', type: 'food',
   *     analysisResult: object, raw: object }  → food detected
   *   { status: 'success', type: 'weight',
   *     weightValue: number, unit: string }    → weight detected
   *   { status: 'success', type: 'education'|'smartwatch',
   *     platform: string, topic: string }      → edu / watch detected
   */
  initialAiResult = null,
  /** The diary date selected in Dashboard — saves are anchored to this day. */
  diaryDate = null,
  /** Original upload instant from the diary row (entry.capturedAt). */
  originalCapturedAt = null,
  /** When true: show only a delete button — no category picker, no retry.
   *  Used for out-of-scope captures where re-analysing won't help. */
  deleteOnly = false,
  canMutate = true,
  userId,
  apiBaseUrl,
  onClose,
  onChanged,
  onDeleteWithUndo,
}) {
  // Derive the initial stage from the pre-flight AI result so the modal
  // opens directly at the right step without any further async work.
  function deriveInitialStage(r) {
    if (!r || r.status !== 'success') return 'view';
    if (r.type === 'food') return 'ai-review-food';
    if (r.type === 'weight') return 'weight';
    if (r.type === 'education' || r.type === 'smartwatch') return 'ai-review-education';
    return 'view';
  }

  const [stage, setStage] = useState(() => deriveInitialStage(initialAiResult));
  const [retrying, setRetrying] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Pre-populate error from failed pre-flight result; cleared on user action.
  const [error, setError] = useState(
    initialAiResult?.status === 'failed' ? initialAiResult.error : null,
  );
  // AI-detected food data for the 'ai-review-food' stage.
  const [aiFood, setAiFood] = useState(
    initialAiResult?.status === 'success' && initialAiResult.type === 'food'
      ? { analysisResult: initialAiResult.analysisResult, raw: initialAiResult.raw }
      : null,
  );
  // AI-detected weight data pre-fills ManualWeightEntryModal.
  const [aiWeight, setAiWeight] = useState(
    initialAiResult?.status === 'success' && initialAiResult.type === 'weight'
      ? { weightValue: initialAiResult.weightValue, unit: initialAiResult.unit }
      : null,
  );
  // AI-detected education / smartwatch data for the review screen.
  const [aiEducation, setAiEducation] = useState(
    initialAiResult?.status === 'success'
      && (initialAiResult.type === 'education' || initialAiResult.type === 'smartwatch')
      ? {
          platform: initialAiResult.platform,
          topic: initialAiResult.topic,
          captureKind: initialAiResult.type,
        }
      : null,
  );

  // Reset internal stage/error whenever the modal is re-opened for a different
  // capture (captureId changes while open=true is uncommon but possible).
  const prevCaptureIdRef = React.useRef(captureId);
  React.useEffect(() => {
    if (!open) return;
    if (prevCaptureIdRef.current === captureId) return;
    prevCaptureIdRef.current = captureId;
    setStage(deriveInitialStage(initialAiResult));
    setRetrying(false);
    setDeleting(false);
    setError(initialAiResult?.status === 'failed' ? initialAiResult.error : null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, captureId]);

  if (!open) return null;

  const close = () => {
    setStage('view');
    setRetrying(false);
    setDeleting(false);
    setError(null);
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
   * Run a manual AI retry triggered by the user clicking "Retry AI" inside
   * the modal (AFTER the pre-flight run already ran and failed).
   *
   * We do NOT pass captureId so the backend idempotency guard does not return
   * the cached "other" result from the original failed classification.
   */
  const runAiRetry = async () => {
    if (!imageBase64 || !userId) return;
    setRetrying(true);
    setError(null);
    let reservationId = null;
    const creditsEnabled = isFlagEnabled('ff.ai-credits');
    try {
      if (creditsEnabled) {
        const reserved = await reserveAiCredit({ userId, apiBaseUrl });
        if (!reserved?.allowed || !reserved.reservationId) {
          setRetrying(false);
          setError(
            reserved?.reason === 'limit_reached'
              ? 'Daily AI limit reached'
              : 'AI Mode is unavailable right now',
          );
          setStage('view');
          return;
        }
        reservationId = reserved.reservationId;
      }

      const file = base64ToImageFile(imageBase64);
      // Do NOT pass captureId — avoids idempotency guard returning cached "other"
      const detectedType = await analyzeImage(file, {
        userId,
        reservationId,
        creditGated: Boolean(creditsEnabled && reservationId),
      });

      const creditPayload = {
        imageType: detectedType.type,
        type: detectedType.type,
        confidence: detectedType.confidence,
        defaulted: detectedType.details?.defaulted === true,
        error: detectedType.details?.error || null,
        details: detectedType.details,
        fastNutrition: detectedType.fastNutrition,
      };
      const settleRetryCredit = async () => {
        if (!creditsEnabled || !reservationId) return;
        await confirmAiCredit({
          userId,
          reservationId,
          analysisResult: creditPayload,
          apiBaseUrl,
        }).catch(() => {});
      };

      if (detectedType.type === 'food') {
        const analysis = detectedType.details;
        await settleRetryCredit();
        if (!hasRecognizedFood(analysis)) {
          setRetrying(false);
          setStage('view');
          return;
        }
        // Success: transition to AI review stage so the user can inspect and
        // confirm the detected food before it is saved.
        setRetrying(false);
        setAiFood({
          analysisResult: buildAnalysisFromGeminiAnalysis(analysis),
          raw: analysis,
        });
        setStage('ai-review-food');

      } else if (detectedType.type === 'weight' && detectedType.details?.weightValue) {
        await settleRetryCredit();
        // Transition to weight modal with the detected value pre-filled.
        setRetrying(false);
        setAiWeight({
          weightValue: detectedType.details.weightValue,
          unit: detectedType.details.unit || 'kg',
        });
        setStage('weight');

      } else if (detectedType.type === 'education') {
        await settleRetryCredit();
        setRetrying(false);
        setAiEducation({
          platform: detectedType.details?.platform || 'Online Meeting',
          topic: detectedType.details?.topic || 'Education Meeting',
          captureKind: 'education',
        });
        setStage('ai-review-education');

      } else if (detectedType.type === 'smartwatch') {
        await settleRetryCredit();
        setRetrying(false);
        setAiEducation({
          platform: detectedType.details?.source || 'Smartwatch',
          topic: `Calories Burned: ${detectedType.details?.caloriesBurned || 0} kcal`,
          captureKind: 'smartwatch',
        });
        setStage('ai-review-education');

      } else {
        await settleRetryCredit();
        // AI could not identify after all automatic retries — go to the manual
        // category picker. The Retry AI button will be hidden on next render.
        setRetrying(false);
        setStage('view');
      }
    } catch {
      if (creditsEnabled && reservationId) {
        await releaseAiCredit({ userId, reservationId, apiBaseUrl }).catch(() => {});
      }
      setRetrying(false);
      setStage('view');
    }
  };

  const handleRetry = () => runAiRetry();

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
      await promoteUnknownToFood({
        captureId,
        viewerUserId: userId,
        analysisResult,
        originalCapturedAt,
      });
      finish({ kind: 'food', captureId });
    } catch {
      setError("Couldn't save — please try again.");
      setStage('view');
    }
  };

  /** Saves the AI-detected food result that the user confirmed on the review screen. */
  const handleAiFoodConfirm = async () => {
    if (!aiFood?.analysisResult) return;
    try {
      await promoteUnknownToFood({
        captureId,
        viewerUserId: userId,
        analysisResult: aiFood.analysisResult,
        originalCapturedAt,
      });
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
        clientTimestamp: resolveManualLogTimestamp(originalCapturedAt, diaryDate),
      });
      finish({ kind: 'weight', captureId });
    } catch {
      setError("Couldn't save — please try again.");
      setStage('view');
    }
  };

  const handleEducationSave = async (
    { platform, topic },
    captureKind = 'education',
    { errorStage = 'view' } = {},
  ) => {
    try {
      await saveLog({
        userId,
        platform,
        topic,
        captureId,
        imageBase64,
        imageTimestamp: resolveManualLogTimestamp(originalCapturedAt, diaryDate),
      });
      await retagCapture(captureKind);
      finish({ kind: captureKind === 'smartwatch' ? 'watch' : 'education', captureId });
    } catch {
      setError("Couldn't save — please try again.");
      setStage(errorStage);
    }
  };

  const handleWatchSave = async ({ caloriesBurned, source }) => {
    await saveLog({
      userId,
      platform: source || 'Smartwatch',
      topic: `Calories Burned: ${caloriesBurned} kcal`,
      captureId,
      imageBase64,
      imageTimestamp: resolveManualLogTimestamp(originalCapturedAt, diaryDate),
    });
    await retagCapture('smartwatch');
    finish({ kind: 'watch', captureId });
  };

  const handleAiEducationConfirm = async () => {
    if (!aiEducation?.platform) return;
    await handleEducationSave(
      {
        platform: aiEducation.platform,
        topic: aiEducation.topic || 'Education Meeting',
      },
      aiEducation.captureKind || 'education',
      { errorStage: 'ai-review-education' },
    );
  };

  return (
    <>
      {/* ── ai-review-food stage: review AI-detected food before saving ─────── */}
      {stage === 'ai-review-food' && aiFood && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="ai-review-title"
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
                <div className="flex items-center gap-1.5">
                  <span className="text-emerald-500 text-lg" aria-hidden="true">✓</span>
                  <h2 id="ai-review-title" className="text-lg font-semibold text-gray-900">AI detected food</h2>
                </div>
                <p className="text-sm text-gray-500 mt-0.5">Review and save, or edit manually.</p>
              </div>
              <button type="button" onClick={close} aria-label="Close"
                className="rounded-full p-1 text-gray-400 hover:bg-gray-100">✕</button>
            </div>

            {/* Photo */}
            <div className="px-5 pb-3">
              {imageBase64 && (
                <img
                  src={imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`}
                  alt="Captured photo"
                  className="w-full rounded-xl object-cover max-h-48"
                />
              )}
            </div>

            {/* Detected food summary */}
            <div className="px-5 space-y-2">
              {Array.isArray(aiFood.analysisResult?.foods) && aiFood.analysisResult.foods.length > 0 && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 space-y-1.5">
                  {aiFood.analysisResult.foods.slice(0, 6).map((f, i) => (
                    <div key={i} className="flex justify-between items-center text-sm">
                      <span className="text-gray-800 font-medium">{f.name || 'Item'}</span>
                      <span className="text-gray-500 tabular-nums">
                        {Math.round(f.nutrition?.calories ?? 0)} kcal
                      </span>
                    </div>
                  ))}
                  {aiFood.analysisResult.foods.length > 6 && (
                    <p className="text-xs text-gray-400">
                      +{aiFood.analysisResult.foods.length - 6} more item(s)
                    </p>
                  )}
                  {aiFood.analysisResult.total && (
                    <div className="border-t border-emerald-200 pt-1.5 mt-1.5 flex justify-between text-sm font-semibold">
                      <span className="text-emerald-700">Total</span>
                      <span className="text-emerald-700 tabular-nums">
                        {Math.round(aiFood.analysisResult.total.calories ?? 0)} kcal
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="mx-5 mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="px-5 mt-4 flex gap-2">
              <button
                type="button"
                onClick={handleAiFoodConfirm}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-xl px-4 py-3 text-sm font-semibold shadow-sm transition-colors"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => { setError(null); setStage('food'); }}
                className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Edit Manually
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ai-review-education stage: review AI-detected meeting before saving ── */}
      {stage === 'ai-review-education' && aiEducation && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="ai-review-edu-title"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70"
          onClick={close}
        >
          <div
            className="w-full max-w-sm rounded-t-3xl bg-white shadow-xl overflow-y-auto max-h-[90vh] pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-2">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-emerald-500 text-lg" aria-hidden="true">✓</span>
                  <h2 id="ai-review-edu-title" className="text-lg font-semibold text-gray-900">
                    {aiEducation.captureKind === 'smartwatch' ? 'AI detected activity' : 'AI detected education'}
                  </h2>
                </div>
                <p className="text-sm text-gray-500 mt-0.5">Review and save, or edit manually.</p>
              </div>
              <button type="button" onClick={close} aria-label="Close"
                className="rounded-full p-1 text-gray-400 hover:bg-gray-100">✕</button>
            </div>

            <div className="px-5 pb-3">
              {imageBase64 && (
                <img
                  src={imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`}
                  alt="Captured photo"
                  className="w-full rounded-xl object-cover max-h-48"
                />
              )}
            </div>

            <div className="px-5">
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 space-y-1">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Platform</span>
                  <span className="text-gray-900 font-medium">{aiEducation.platform}</span>
                </div>
                {aiEducation.topic && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Topic</span>
                    <span className="text-gray-900 font-medium text-right max-w-[60%]">{aiEducation.topic}</span>
                  </div>
                )}
              </div>
            </div>

            {error && (
              <div className="mx-5 mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <div className="px-5 mt-4 flex gap-2">
              <button
                type="button"
                onClick={handleAiEducationConfirm}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-xl px-4 py-3 text-sm font-semibold shadow-sm transition-colors"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setStage(aiEducation.captureKind === 'smartwatch' ? 'smartwatch' : 'education');
                }}
                className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Edit Manually
              </button>
            </div>
          </div>
        </div>
      )}

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
                <h2 className="text-lg font-semibold text-gray-900">Manual Log</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  AI analysed 3 times and couldn’t identify this. Choose what you photographed.
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

{/* Category quick-picks */}
                {canMutate && !deleteOnly && (
                  <div className="px-5 space-y-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      What is this photo?
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { type: 'food',       icon: '🍽️', label: 'Food / Drink',   sub: 'Meal, shake, tea, etc.' },
                        { type: 'weight',     icon: '⚖️',  label: 'Weight Scale',  sub: 'Scale with reading' },
                        { type: 'education',  icon: '🎓',  label: 'Education',     sub: 'Meeting screenshot' },
                        { type: 'smartwatch', icon: '⌚',  label: 'Smartwatch',    sub: 'Steps / calories' },
                      ].map(({ type, icon, label, sub }) => (
                        <button
                          key={type}
                          type="button"
                          disabled={deleting}
                          onClick={() => { setError(null); setStage(type); }}
                          className="flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 border-gray-200 hover:border-emerald-400 hover:bg-emerald-50 active:bg-emerald-100 disabled:opacity-50 transition-colors"
                        >
                          <span className="text-2xl">{icon}</span>
                          <span className="text-sm font-semibold text-gray-900 text-center">{label}</span>
                          <span className="text-xs text-gray-500 text-center leading-tight">{sub}</span>
                        </button>
                      ))}
                    </div>
                    {/* Delete */}
                    <button
                      type="button"
                      disabled={deleting}
                      onClick={handleDelete}
                      className="w-full rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      {deleting ? 'Deleting…' : '🗑️ Delete this photo'}
                    </button>
              </div>
            )}

            {/* ── Delete-only view: out-of-scope captures ── */}
            {canMutate && deleteOnly && (
              <div className="px-5 pb-6">
                <p className="text-sm text-gray-500 text-center mb-4">
                  This photo wasn’t recognised as food, weight, education or smartwatch.
                </p>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={handleDelete}
                  className="w-full rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50"
                >
                  {deleting ? 'Deleting…' : '🗑️ Delete this photo'}
                </button>
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
        initialWeightValue={aiWeight?.weightValue ?? null}
        initialWeightUnit={aiWeight?.unit ?? null}
      />

      <ManualEducationEntryModal
        isOpen={stage === 'education'}
        skipTypeSelect={true}
        initialPlatform={aiEducation?.captureKind === 'education' ? aiEducation?.platform : undefined}
        initialTopic={aiEducation?.captureKind === 'education' ? aiEducation?.topic : undefined}
        onClose={() => setStage('view')}
        onBack={() => setStage('view')}
        onSave={(data) => handleEducationSave(data, 'education')}
      />

      <ManualWatchEntryModal
        isOpen={stage === 'smartwatch'}
        onClose={() => setStage('view')}
        onBack={() => setStage('view')}
        initialCaloriesBurned={
          aiEducation?.captureKind === 'smartwatch'
            ? (String(extractCaloriesValue(aiEducation?.topic)).match(/[\d.]+/) || [''])[0]
            : ''
        }
        onSave={handleWatchSave}
      />
    </>
  );
}
