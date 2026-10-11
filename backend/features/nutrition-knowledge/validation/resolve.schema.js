/**
 * backend/features/nutrition-knowledge/validation/resolve.schema.js
 */
import { ValidationError } from '../../../shared/lib/ValidationError.js';
import { NUTRITION_KEYS, pickNutrition } from '../domain/nutrition.rules.js';

export function validateResolve(query = {}) {
  const name = String(query.name || query.foodName || '').trim();
  if (!name || name.length < 1) {
    throw new ValidationError(400, 'name is required');
  }
  const weightRaw = query.weightG ?? query.weight_g ?? null;
  const weightG = weightRaw == null || weightRaw === ''
    ? null
    : Number(weightRaw);
  if (weightG != null && (!Number.isFinite(weightG) || weightG < 0)) {
    throw new ValidationError(400, 'weightG must be a non-negative number');
  }
  const userId = query.userId != null ? String(query.userId) : null;
  return { name, weightG, userId };
}

export function validateSearch(query = {}) {
  const searchTerm = String(query.query || query.searchTerm || '').trim();
  if (searchTerm.length < 1) {
    throw new ValidationError(400, 'query is required');
  }
  const userId = query.userId != null ? String(query.userId) : null;
  return { searchTerm, userId };
}

export function validateApprove(body = {}) {
  const profileId = Number(body.profileId ?? body.id);
  if (!Number.isFinite(profileId) || profileId <= 0) {
    throw new ValidationError(400, 'profileId is required');
  }
  const reviewedByUserId = body.reviewedByUserId != null
    ? Number(body.reviewedByUserId)
    : null;
  return { profileId, reviewedByUserId };
}

export function validateEnrich(body = {}) {
  const userId = Number(body.userId);
  if (!Number.isFinite(userId) || userId <= 0) {
    throw new ValidationError(400, 'userId is required');
  }
  const name = String(body.name || body.foodName || '').trim();
  if (!name) throw new ValidationError(400, 'name is required');
  const weightG = body.weightG != null ? Number(body.weightG) : 100;
  if (!Number.isFinite(weightG) || weightG <= 0) {
    throw new ValidationError(400, 'weightG must be a positive number');
  }
  const reservationId = body.reservationId ? String(body.reservationId) : null;
  const macros = body.macros && typeof body.macros === 'object' ? body.macros : null;
  return { userId, name, weightG, reservationId, macros };
}

/**
 * Custom food create — name + unit (g|ml) + positive serving size. No macros required.
 * @param {object} body
 */
export function validateCustomFood(body = {}) {
  const name = String(body.name || body.foodName || '').trim();
  if (!name) {
    throw new ValidationError(400, 'Food name is required');
  }
  if (name.length > 120) {
    throw new ValidationError(400, 'Food name is too long');
  }

  const unit = String(body.unit || '').toLowerCase().trim();
  if (unit !== 'g' && unit !== 'ml') {
    throw new ValidationError(400, 'unit must be g or ml');
  }

  const servingSize = Number(body.servingSize ?? body.serving_size ?? body.amount);
  if (!Number.isFinite(servingSize) || servingSize <= 0) {
    throw new ValidationError(400, 'serving size must be a positive number');
  }
  if (servingSize > 100_000) {
    throw new ValidationError(400, 'serving size is too large');
  }

  const userId = body.userId != null ? Number(body.userId) : null;
  return {
    name,
    unit,
    servingSize,
    userId: Number.isFinite(userId) && userId > 0 ? userId : null,
  };
}

/**
 * Developer Excel export of custom-food submissions.
 * @param {object} query
 */
export function validateCustomFoodExport(query = {}) {
  const userId = Number(query.userId);
  if (!Number.isFinite(userId) || userId <= 0) {
    throw new ValidationError(400, 'userId is required');
  }
  const pendingOnly = String(query.pendingOnly ?? query.pendingNutritionOnly ?? 'true') !== 'false';
  const limit = query.limit != null ? Number(query.limit) : 5000;
  return {
    userId,
    pendingOnly,
    limit: Number.isFinite(limit) && limit > 0 ? limit : 5000,
  };
}

/**
 * Developer sets nutrition on a master custom food profile.
 * Nutrition values are for the profile reference_weight_g (or referenceQuantity).
 * @param {object} body
 */
export function validateSetCustomFoodNutrition(body = {}) {
  const userId = Number(body.userId);
  if (!Number.isFinite(userId) || userId <= 0) {
    throw new ValidationError(400, 'userId is required');
  }

  const profileId = Number(body.profileId ?? body.id);
  if (!Number.isFinite(profileId) || profileId <= 0) {
    throw new ValidationError(400, 'profileId is required');
  }

  const nutritionIn = body.nutrition && typeof body.nutrition === 'object'
    ? body.nutrition
    : body;
  for (const key of NUTRITION_KEYS) {
    const v = nutritionIn[key];
    if (v == null || v === '') continue;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) {
      throw new ValidationError(400, `${key} must be a non-negative number`);
    }
  }
  // Macros + vitamins + minerals (ADR-0005 full set).
  const nutrition = pickNutrition(nutritionIn);
  if (nutrition.calories == null) {
    throw new ValidationError(400, 'calories is required');
  }

  const referenceQuantity = body.referenceQuantity ?? body.referenceWeightG ?? body.reference_weight_g;
  const referenceWeightG = referenceQuantity != null ? Number(referenceQuantity) : null;
  if (referenceWeightG != null && (!Number.isFinite(referenceWeightG) || referenceWeightG <= 0)) {
    throw new ValidationError(400, 'referenceQuantity must be a positive number');
  }

  return {
    userId,
    profileId,
    nutrition,
    referenceWeightG,
  };
}
