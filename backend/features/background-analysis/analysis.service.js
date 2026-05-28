import { randomUUID } from 'crypto';
import * as repo from './analysis.repository.js';
import { cache, cacheKeys } from '../../utils/cache.js';
// PR 6 — captures_table is the ONLY at-capture-time write. The per-vertical
// tables (food / weight / education / smartwatch) insert their own rows when
// AI classification completes and promote the capture via
// captures.updateTypeById (pending → terminal). The old speculative food row
// at createPendingCapture time was removed: it left orphan "Unknown Food /
// 0 kcal" rows whenever the capture turned out to be non-food.
import * as captures from '../captures/captures.service.js';
import {
  IMAGE_TYPE_FOOD,
} from '../captures/domain/image-types.js';
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

  // PR 6 — idempotent upsert keyed by CaptureID. The speculative pre-insert
  // is gone, so the first save for a capture INSERTs (carrying CaptureID as
  // FK); a retry or background-service replay finds the existing row and
  // UPDATEs in place. Without this guard, retries would duplicate meal rows.
  let data;
  try {
    if (captureId) {
      const existing = await repo.findFoodByCaptureId(captureId, userId.toString());
      if (existing) {
        data = await repo.updateWithAnalysisResult(existing.ID, userId.toString(), analysisPayload);
      } else {
        data = await repo.insertAnalysis({
          UserID: userId.toString(),
          CaptureID: captureId,
          ...analysisPayload,
          CreatedAt: createdAtIST,
          UpdatedAt: currentTime,
        });
      }
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

  // Promote the capture pending → food. Best-effort: the food row is
  // already persisted, and the state machine is idempotent (re-classifying
  // an already-food capture is a no-op). Only logged on failure so a
  // captures-side transient does not fail the user save.
  if (captureId) {
    try {
      await captures.updateTypeById({
        captureId,
        userId: userId.toString(),
        toType: IMAGE_TYPE_FOOD,
      });
    } catch (err) {
      logger.warn('analysis.save: failed to promote capture to food', {
        captureId, userId: userId.toString(), err: err.message,
      });
    }
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
// smartwatch/unknown. PR 6 — `id` is now the CaptureID directly.
// createPendingCapture returns captures.id as `id` in its response, the FE
// round-trips it on the PATCH, and we delegate straight to
// captures.updateTypeById. The previous food-table indirection
// (findCaptureIdForOwner) is gone now that no speculative food row exists.
export async function updateCaptureType({ id, userId, imageType }) {
  const result = await captures.updateTypeById({
    captureId: id,
    userId,
    toType: imageType,
  });

  if (!result.changed && result.reason === 'NOT_FOUND_OR_NOT_OWNER') {
    return {
      httpStatus: 404,
      body: { ok: false, error: { code: 'CAPTURE_NOT_FOUND' } },
    };
  }
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

  // PR 6 — captures_table is the ONLY at-capture-time write. No speculative
  // food row: that previously polluted the nutrition feed with "Unknown Food
  // / 0 kcal" cards whenever the capture turned out to be weight / education
  // / smartwatch. The vertical that owns the final classification (food via
  // analysis.save, weight via weight.saveWeight, etc.) is responsible for
  // inserting its own row with CaptureID = id and promoting the capture via
  // captures.updateTypeById.
  const capture = await captures.recordPending({
    userId: userId.toString(),
    publicShareToken: token,
    shareExpiresAt,
    imageBase64: imageBase64 || null,
    imagePath: 'instant-share',
    deviceInfo: 'Wellness Valley Web App',
    processedBy: 'manual_app',
  });

  // The `id` returned here is the captures_table primary key. The FE round-
  // trips it as both the `captureId` payload field on the save endpoints and
  // the `id` field on the PATCH /api/background-analysis/captures route.
  return {
    httpStatus: 201,
    body: {
      ok: true,
      data: {
        id: capture.id,
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