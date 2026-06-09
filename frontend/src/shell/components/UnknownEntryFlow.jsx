/**
 * UnknownEntryFlow.jsx — shell-hosted flow for an "Other" (unknown) diary row.
 *
 * ADR-0003: tapping an unknown row on the single Diary page opens this flow.
 *   - view:    UnknownShareViewer shows the image with Retry / Edit.
 *   - Retry:   re-run Gemini on the image; if confident, promote unknown→food.
 *   - Edit:    pick a category (Food / Weight / Education) and transfer the
 *              data to that vertical:
 *                · Food      → SmartFoodSearchModal → promote the capture
 *                              unknown→food with the chosen nutrition.
 *                · Weight    → ManualWeightEntryModal → save a weight record.
 *                · Education → ManualEducationEntryModal → save an education log.
 *
 * The shell layer is permitted to compose features/* (see shell/README).
 * On any successful change we call `onChanged()` so the feed re-fetches.
 */
import React, { useState } from 'react';
import { geminiService } from '../../shared/services/geminiService';
import {
  UnknownShareViewer,
  UnknownCaptureModal,
  promoteUnknownToFood,
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
}) {
  const [stage, setStage] = useState('view'); // view | pick | food | weight | education
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState(null);

  if (!open) return null;

  const close = () => {
    setStage('view');
    setRetrying(false);
    setError(null);
    onClose?.();
  };

  const finish = () => {
    onChanged?.();
    close();
  };

  const handleRetry = async () => {
    if (!captureId || !imageBase64 || !userId) return;
    setRetrying(true);
    setError(null);
    try {
      const file = base64ToImageFile(imageBase64);
      const analysis = await geminiService.analyzeImageForNutrition(file);
      const noFood = !analysis?.foods?.length || !(Number(analysis?.total?.calories) > 0);
      if (noFood) {
        setRetrying(false);
        setError("Still couldn't recognise it — try Edit instead.");
        return;
      }
      await promoteUnknownToFood({ captureId, viewerUserId: userId, analysisResult: analysis });
      setRetrying(false);
      finish();
    } catch {
      setRetrying(false);
      setError("Couldn't analyse the photo — try Edit instead.");
    }
  };

  const handleFoodSave = async (manualData) => {
    try {
      const analysisResult = buildAnalysisFromManualFood(manualData);
      await promoteUnknownToFood({ captureId, viewerUserId: userId, analysisResult });
      finish();
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
      finish();
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
      finish();
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
        retrying={retrying}
        error={error}
        onRetry={handleRetry}
        onEdit={() => { setError(null); setStage('pick'); }}
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
