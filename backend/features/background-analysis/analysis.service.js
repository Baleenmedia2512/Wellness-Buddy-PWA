import { randomUUID } from 'crypto';
import * as repo from './analysis.repository.js';
import { cache, cacheKeys } from '../../utils/cache.js';
// PR 2 dual-write: every pending-capture create + image-type update is
// mirrored into `captures_table` via the new captures slice. The legacy
// `food_nutrition_data_table` remains canonical until PR 4. Shadow-write
// failures are swallowed (logged via the shared logger) so they cannot
// break user-facing requests during the rollout.
import * as captures from '../captures/captures.service.js';
import logger from '../../shared/lib/logger.js';

const { getISTTimestamp, convertToIST } = repo;

const convertConfidenceToNumeric = (confidence) => {
  if (typeof confidence === 'number') return confidence;
  if (typeof confidence === 'string') {
    switch (confidence.toLowerCase()) {
      case 'high': return 0.9;
      case 'medium': return 0.7;
      case 'low': return 0.5;
      case 'very_high': return 0.95;
      case 'very_low': return 0.3;
      default: return 0.7;
    }
  }
  return null;
};

function extractNutrition(analysisResult, deviceInfo) {
  let totalCalories = null, totalProtein = null, totalCarbs = null,
      totalFat = null, totalFiber = null, confidenceScore = null;
  let processedBy = 'manual_app';

  try {
    const analysis = typeof analysisResult === 'string'
      ? JSON.parse(analysisResult) : analysisResult;

    if (analysis.foods && analysis.foods.length > 0 && analysis.total) {
      totalCalories = analysis.total.calories || null;
      totalProtein = analysis.total.protein || null;
      totalCarbs = analysis.total.carbs || null;
      totalFat = analysis.total.fat || null;
      totalFiber = analysis.total.fiber || null;
      confidenceScore = convertConfidenceToNumeric(analysis.confidence);
      processedBy = deviceInfo && deviceInfo.includes('Android Background Service')
        ? 'background_service' : 'manual_app';
    } else if (analysis.nutrition) {
      totalCalories = analysis.nutrition.calories || null;
      totalProtein = analysis.nutrition.protein || null;
      totalCarbs = analysis.nutrition.carbs || null;
      totalFat = analysis.nutrition.fat || null;
      totalFiber = analysis.nutrition.fiber || null;
      confidenceScore = convertConfidenceToNumeric(analysis.confidence);
      processedBy = 'manual_app';
    } else if (analysis.foods && analysis.foods.length > 0) {
      const firstFood = analysis.foods[0];
      if (firstFood.nutrition) {
        totalCalories = firstFood.nutrition.calories || null;
        totalProtein = firstFood.nutrition.protein || null;
        totalCarbs = firstFood.nutrition.carbs || null;
        totalFat = firstFood.nutrition.fat || null;
        totalFiber = firstFood.nutrition.fiber || null;
      }
      confidenceScore = convertConfidenceToNumeric(firstFood.confidence || analysis.confidence);
      processedBy = 'background_service';
    }
  } catch (_) { /* ignore parse */ }

  return { totalCalories, totalProtein, totalCarbs, totalFat, totalFiber, confidenceScore, processedBy };
}

// ─── save ────────────────────────────────────────────────────────────────────
export async function save(input) {
  const {
    userId, imagePath, analysisResult, deviceInfo, ImageBase64, clientTimestamp,    captureId,  } = input;

  const nutrition = extractNutrition(analysisResult, deviceInfo);
  const { totalCalories, totalProtein, totalCarbs, totalFat, totalFiber, confidenceScore, processedBy } = nutrition;

  const imageBase64ToSave = ImageBase64 && ImageBase64.trim() !== '' ? ImageBase64 : null;
  const analysisDataJson = typeof analysisResult === 'string'
    ? analysisResult : JSON.stringify(analysisResult);
  const currentTime = getISTTimestamp();

  let createdAtIST;
  if (clientTimestamp) {
    createdAtIST = convertToIST(clientTimestamp).istTimestamp;
  } else {
    createdAtIST = currentTime;
  }

  const analysisPayload = {
    ImagePath: imagePath,
    AnalysisData: analysisDataJson,
    ConfidenceScore: confidenceScore,
    TotalCalories: totalCalories,
    TotalProtein: totalProtein,
    TotalCarbs: totalCarbs,
    TotalFat: totalFat,
    TotalFiber: totalFiber,
    // Stamp the row as 'food' now that nutrition analysis has confirmed it.
    // New pending captures start as ImageType='pending' to avoid a race
    // condition where the row would match the listAnalyses ImageType='food'
    // filter before the type is resolved.
    ImageType: 'food',
    ProcessedBy: processedBy,
    DeviceInfo: deviceInfo
      || (processedBy === 'background_service' ? 'Android Background Service' : 'Wellness Valley Web App'),
    ImageBase64: imageBase64ToSave,
  };

  let data;
  try {
    if (captureId) {
      // Update the pre-created pending capture row (instant-share flow).
      data = await repo.updateWithAnalysisResult(captureId, userId.toString(), analysisPayload);
    } else {
      data = await repo.insertAnalysis({
        UserID: userId.toString(),
        ...analysisPayload,
        CreatedAt: createdAtIST,
        UpdatedAt: currentTime,
      });
    }
  } catch (error) {
    let errorMessage = 'Failed to save analysis';
    if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
      errorMessage = 'Database connection timeout. Please try again.';
    } else if (error.message?.includes('Connection terminated')) {
      errorMessage = 'Database connection was terminated. Retrying...';
    } else if (error.code === 'ECONNREFUSED') {
      errorMessage = 'Database connection refused. Please check if database is accessible.';
    } else if (error.code === '23505') {
      errorMessage = 'Duplicate key error: The database sequence needs to be reset. Please contact support.';
    }
    return {
      httpStatus: 500,
      body: {
        success: false,
        message: errorMessage,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
    };
  }

  await repo.touchLastActive(userId);
  cache.delete(cacheKeys.nutritionMeals(userId));

  return {
    httpStatus: 200,
    body: {
      success: true,
      id: data?.ID || data?.id,
      message: 'Analysis saved successfully',
      data: {
        userId,
        imagePath: imagePath.substring(imagePath.lastIndexOf('/') + 1),
        nutrition: {
          calories: totalCalories,
          protein: totalProtein,
          carbs: totalCarbs,
          fat: totalFat,
          fiber: totalFiber,
        },
        confidence: confidenceScore,
        timestamp: new Date().toISOString(),
      },
    },
  };
}

// ─── list ────────────────────────────────────────────────────────────────────
export async function list(input) {
  const { userId, limit, offset } = input;
  const { rows, count } = await repo.listAnalyses({ userId, limit, offset });
  return {
    httpStatus: 200,
    body: {
      success: true,
      data: rows,
      pagination: {
        total: count,
        limit,
        offset,
        hasMore: (offset + limit) < count,
      },
    },
  };
}

// ─── delete ──────────────────────────────────────────────────────────────────
export async function deleteAnalysis({ id, userId }) {
  const data = await repo.softDeleteAnalysis(id, userId);
  if (data.length === 0) {
    return {
      httpStatus: 403,
      body: { success: false, message: 'Unauthorized or analysis not found' },
    };
  }
  cache.delete(cacheKeys.nutritionMeals(userId));
  return {
    httpStatus: 200,
    body: { success: true, message: 'Analysis deleted successfully', deletedId: id },
  };
}

// ─── undo ────────────────────────────────────────────────────────────────────
export async function undoDelete({ id, userId }) {
  if (userId) {
    const owns = await repo.checkOwnership(id, userId);
    if (!owns) {
      return {
        httpStatus: 403,
        body: { success: false, message: 'You do not have permission to restore this item.' },
      };
    }
  }
  const data = await repo.restoreAnalysis(id);
  if (data.length === 0) {
    return {
      httpStatus: 404,
      body: { success: false, message: 'Analysis not found or already active' },
    };
  }
  if (userId) cache.delete(cacheKeys.nutritionMeals(userId));
  return {
    httpStatus: 200,
    body: { success: true, message: 'Analysis restored successfully', restoredId: id },
  };
}
// ─── updateCaptureType ───────────────────────────────────────────────────────
// Called by the frontend after AI determines the image is weight/education/
// smartwatch. PR 5 — captures_table is now canonical for the image-type
// discriminator (the legacy ImageType column on food_nutrition_data_table was
// dropped). The whole update happens in the captures slice; we look up the
// linked CaptureID from the food row and delegate to captures.updateTypeById,
// which enforces the state machine in features/captures/domain/image-types.js.
export async function updateCaptureType({ id, userId, imageType }) {
  const captureId = await repo.findCaptureIdForOwner(id, userId);
  if (!captureId) {
    // Either the food row doesn't exist, isn't owned by this user, or is a
    // pre-PR-2 legacy row with no captures_table twin. The first two are real
    // 404s; the third is the historical-row breakage already documented in
    // migrations/drop_legacy_share_columns_from_food.sql. We can't tell them
    // apart cheaply, so we return a 404-shaped response — the frontend
    // already treats this branch as "share link expired/unavailable".
    logger.warn('updateCaptureType: no captureId for legacy id', { id, userId });
    return { httpStatus: 404, body: { ok: false, error: { code: 'CAPTURE_NOT_FOUND' } } };
  }

  const result = await captures.updateTypeById({
    captureId,
    userId,
    toType: imageType,
  });

  return { httpStatus: 200, body: { ok: true, data: result } };
}

// ─── createPendingCapture ─────────────────────────────────────────────────────

/**
 * Pre-create a "pending" capture row so the user can share a link
 * immediately after food detection, before Gemini analysis completes.
 * Returns { id, token } — the caller constructs the full viewUrl.
 */
export async function createPendingCapture({ userId, imageBase64 }) {
  const token = randomUUID();
  const shareExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  // PR 5 — captures_table is canonical. Insert it FIRST so we can
  // pin the resulting CaptureID onto the food row in the same request.
  // If this throws, no food row is created (the legacy table is no longer
  // a fallback after PR 5 — see migrations/drop_legacy_share_columns_from_food.sql).
  const capture = await captures.recordPending({
    userId: userId.toString(),
    publicShareToken: token,
    shareExpiresAt,
    imageBase64: imageBase64 || null,
    imagePath: 'instant-share',
    deviceInfo: 'Wellness Valley Web App',
    processedBy: 'manual_app',
  });

  // The food row is still inserted speculatively so save() has a stable id
  // to UPDATE when AI analysis completes (preserves the existing instant-
  // share flow). It carries CaptureID = the row we just created so the
  // share-resolve path can join the two without legacy columns.
  //
  // If the user re-tags the capture as weight / education / smartwatch via
  // the unknown picker (PR 3), this food row becomes an orphan with
  // AnalysisData=NULL forever. listAnalyses (PR 5) excludes such orphans
  // via `AnalysisData IS NOT NULL`, so they are invisible to the user.
  // A periodic cleanup job can prune them — tracked as a follow-up.
  const row = await repo.insertPendingCapture({
    userId: userId.toString(),
    imageBase64: imageBase64 || null,
    captureId: capture.id,
  });

  return {
    httpStatus: 201,
    body: {
      ok: true,
      data: {
        id: row.ID || row.id,
        token,
      },
    },
  };
}

// ─── resolvePublicCapture (deep-link target lookup) ─────────────────────────

/**
 * Look up the OWNER + meal date for a shared token. Used by the in-app
 * deep-link handler: the app opens Dashboard for that user/date and
 * automatically expands the specific meal card. Enforces permission — viewer
 * must be the owner OR appear in the owner's upline coach chain.
 *
 * Returns:
 *   { ok: true,  data: { mealId, ownerUserId, ownerUserName, mealDate, isSelf } }
 *   { ok: false, error: { code: 'NOT_FOUND' | 'EXPIRED' | 'FORBIDDEN', message } }
 */
export async function resolvePublicCapture({ token, viewerUserId }) {
  const row = await repo.findOwnerByToken(token);
  if (!row) {
    return { httpStatus: 404, body: { ok: false, error: { code: 'NOT_FOUND', message: 'Share link not found' } } };
  }
  if (row.ShareExpiresAt && new Date(row.ShareExpiresAt) < new Date()) {
    return { httpStatus: 410, body: { ok: false, error: { code: 'EXPIRED', message: 'This share link has expired' } } };
  }
  const mealId = row.ID ? row.ID.toString() : null;
  const ownerUserId = row.UserID ? row.UserID.toString() : null;
  if (!ownerUserId) {
    return { httpStatus: 404, body: { ok: false, error: { code: 'NOT_FOUND', message: 'Share link has no owner' } } };
  }

  const viewer = viewerUserId.toString();
  const isSelf = viewer === ownerUserId;
  if (!isSelf) {
    // Permission: viewer must appear in the owner's upline coach chain.
    // Co-coach partners are NOT granted access — they are peers of the owner's
    // coach and have no supervisory relationship with the owner.
    const chain = await repo.getCoachChain(ownerUserId);
    if (!chain.includes(viewer)) {
      return { httpStatus: 403, body: { ok: false, error: { code: 'FORBIDDEN', message: "You don't have access to this meal" } } };
    }
  }

  const ownerUserName = isSelf ? null : await repo.findUserName(ownerUserId);
  // Slice the IST-stored CreatedAt to YYYY-MM-DD so the Dashboard opens the
  // correct local date. Using toISOString() would shift a late-evening IST
  // timestamp to the next UTC day, showing the wrong nutrition entries.
  const mealDate = row.CreatedAt ? row.CreatedAt.toString().slice(0, 10) : null;

  return {
    httpStatus: 200,
    body: {
      ok: true,
      data: {
        mealId,
        ownerUserId,
        ownerUserName,
        mealDate,
        isSelf,
        // imageType drives in-app deep-link tab routing.
        // Falls back to 'food' for legacy rows that pre-date this column.
        imageType: row.ImageType || 'food',
      },
    },
  };
}

// ─── getPublicCapture ─────────────────────────────────────────────────────

/**
 * Fetch publicly shareable nutrition data by token.
 * Returns { pending: true } when analysis is not yet complete.
 */
export async function getPublicCapture({ token }) {
  const row = await repo.findPublicByToken(token);
  if (!row) {
    return { httpStatus: 404, body: { ok: false, error: { code: 'NOT_FOUND', message: 'Share link not found or expired' } } };
  }
  if (row.ShareExpiresAt && new Date(row.ShareExpiresAt) < new Date()) {
    return { httpStatus: 410, body: { ok: false, error: { code: 'EXPIRED', message: 'This share link has expired' } } };
  }
  if (!row.AnalysisData) {
    return { httpStatus: 200, body: { ok: true, data: { pending: true, imageBase64: row.ImageBase64 || null } } };
  }
  let analysisData;
  try {
    analysisData = typeof row.AnalysisData === 'string' ? JSON.parse(row.AnalysisData) : row.AnalysisData;
  } catch (_) {
    analysisData = null;
  }
  return {
    httpStatus: 200,
    body: {
      ok: true,
      data: {
        pending: false,
        analysis: analysisData,
        nutrition: {
          calories: row.TotalCalories,
          protein: row.TotalProtein,
          carbs: row.TotalCarbs,
          fat: row.TotalFat,
          fiber: row.TotalFiber,
        },
        createdAt: row.CreatedAt,
        imageBase64: row.ImageBase64 || null,
      },
    },
  };
}