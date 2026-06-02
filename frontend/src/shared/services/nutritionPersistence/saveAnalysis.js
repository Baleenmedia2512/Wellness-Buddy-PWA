// POST /api/background-analysis — saves analysis to DB.
// Handles demo accounts, userId resolution, format normalization, and
// non-JSON error responses (HTML error pages, payload-too-large, etc.).
import { transformToBackgroundServiceFormat } from './transformAnalysisFormat';
import { resolveTeamUserId } from './userIdLookup';
import { isDemoUser, saveDemoMeal } from './demoMealStore';
import { debugLog } from '../../utils/logger.js';

const parseSaveResponse = async (res) => {
  const ct = res.headers.get('content-type');
  if (ct && ct.includes('application/json')) return res.json();

  const text = await res.text();
  console.error('Non-JSON response:', text);
  if (text.includes('Body exceeded') || text.includes('Request entity too large')) {
    throw new Error('Image file is too large. Please try with a smaller image (max 10MB).');
  }
  if (res.status === 500) throw new Error('Internal Server Error');
  if (res.status === 503) throw new Error('Server is currently overloaded');
  throw new Error('Server returned an unexpected response format');
};

export async function saveNutritionAnalysis({
  userId, imagePath, imageBase64, analysisResult, deviceInfo, userEmail, captureTimestamp = null, captureId = null,
}) {
  const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;
  try {
    if (isDemoUser(userId, userEmail)) {
      debugLog('ℹ️ [saveNutritionAnalysis] Demo account — saving to localStorage');
      return saveDemoMeal({ imageBase64, analysisResult, captureTimestamp });
    }

    const actualUserId = await resolveTeamUserId(userId);
    const transformed = transformToBackgroundServiceFormat(analysisResult);

    // 🔍 DEBUG: Log what's being sent to backend
    console.log('🚀 [saveAnalysis] Data being sent to backend:', {
      hasFoods: !!transformed.foods,
      foodCount: transformed.foods?.length || 0,
      total: transformed.total,
      firstFood: transformed.foods?.[0],
      allFoods: transformed.foods,
    });

    const res = await fetch(`${apiBaseUrl}/api/background-analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: actualUserId,
        imagePath,
        ImageBase64: imageBase64,
        analysisResult: transformed,
        deviceInfo,
        userEmail,
        // EXIF capture time so the meal is categorised by WHEN it was eaten,
        // not when it was uploaded. Falls back to upload time if absent.
        clientTimestamp: captureTimestamp || new Date().toISOString(),
        clientTimezoneOffset: new Date().getTimezoneOffset(),
        // If a pending capture row was pre-created (instant-share flow), update
        // it instead of inserting a new row so there is exactly one DB record.
        ...(captureId ? { captureId } : {}),
      }),
    });

    const data = await parseSaveResponse(res);
    if (!res.ok) throw new Error(data.message || 'Failed to save analysis');
    return data;
  } catch (err) {
    console.error('[saveNutritionAnalysis] Error:', err);
    throw err;
  }
}
