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
import { imageTypeDetector } from '../../shared/services/imageTypeDetector';
// VSA-compliant barrel imports (helpers exported via features/captures/index.js)
import {
  UnknownShareViewer,
  UnknownCaptureModal,
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

  const handleRetry = async () => {
    if (!captureId || !imageBase64 || !userId) return;
    setRetrying(true);
    setError(null);
    try {
      const file = base64ToImageFile(imageBase64);

      // Use full image type detection so weight, education, and smartwatch
      // captures are also correctly re-classified — not just food.
      const detectedType = await imageTypeDetector.detectImageType(file);

      if (detectedType.type === 'food') {
        const analysis = detectedType.details;
        if (!hasRecognizedFood(analysis)) {
          setRetrying(false);
          setError("Still couldn't recognise it — try Edit instead.");
          return;
        }
        const analysisResult = buildAnalysisFromGeminiAnalysis(analysis);
        await promoteUnknownToFood({ captureId, viewerUserId: userId, analysisResult });
        setRetrying(false);
        finish({ kind: 'food', captureId });

      } else if (detectedType.type === 'weight' && detectedType.details?.weightValue) {
        // Save weight entry to DB, then retag capture
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
        // Save education log to DB, then retag capture
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
        // Save watch activity via education log (same table), then retag capture
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
        setRetrying(false);
        setError("Still couldn't recognise it — try Edit instead.");
      }
    } catch {
      setRetrying(false);
      setError("Couldn't analyse the photo — try Edit instead.");
    }
  };

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
      <UnknownShareViewer
        isOpen={stage === 'view'}
        imageBase64={imageBase64}
        canMutate={canMutate}
        retrying={retrying || deleting}
        error={error}
        onRetry={handleRetry}
        onEdit={() => { setError(null); setStage('pick'); }}
        onDelete={handleDelete}
        onClose={close}
      />

      <UnknownCaptureModal
        isOpen={stage === 'pick'}
        onClose={() => setStage('view')}
        onPick={(type) => setStage(type)}
      />

      <SmartFoodSearchModal
        isOpen={stage === 'food'}
        onClose={() => setStage('view')}
        onSave={handleFoodSave}
        apiBaseUrl={apiBaseUrl}
        userId={userId}
        timeLabel="What food was in this photo?"
      />

      <ManualWeightEntryModal
        isOpen={stage === 'weight'}
        onClose={() => setStage('view')}
        onBack={() => setStage('pick')}
        onSave={handleWeightSave}
        imagePreview={imageBase64}
      />

      <ManualEducationEntryModal
        isOpen={stage === 'education'}
        onClose={() => setStage('view')}
        onBack={() => setStage('pick')}
        onSave={handleEducationSave}
      />
    </>
  );
}
