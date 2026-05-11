import * as repo from './analysis.repository.js';
import { cache, cacheKeys } from '../../utils/cache.js';

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
    userId, imagePath, analysisResult, deviceInfo, ImageBase64, clientTimestamp,
  } = input;

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

  let data;
  try {
    data = await repo.insertAnalysis({
      UserID: userId.toString(),
      ImagePath: imagePath,
      AnalysisData: analysisDataJson,
      ConfidenceScore: confidenceScore,
      TotalCalories: totalCalories,
      TotalProtein: totalProtein,
      TotalCarbs: totalCarbs,
      TotalFat: totalFat,
      TotalFiber: totalFiber,
      ProcessedBy: processedBy,
      DeviceInfo: deviceInfo
        || (processedBy === 'background_service' ? 'Android Background Service' : 'Wellness Valley Web App'),
      ImageBase64: imageBase64ToSave,
      CreatedAt: createdAtIST,
      UpdatedAt: currentTime,
    });
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
