/**
 * backend/features/nutrition-knowledge/validation/resolve.schema.js
 */
import { ValidationError } from '../../../shared/lib/ValidationError.js';

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
  if (searchTerm.length < 2) {
    throw new ValidationError(400, 'query must be at least 2 characters');
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
