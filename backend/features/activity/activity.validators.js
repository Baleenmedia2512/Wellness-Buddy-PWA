import { ValidationError } from '../../shared/lib/ValidationError.js';

const ALLOWED_ACTIVITY_TYPES = new Set(['walking']);

function toDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function validateGetDaily(query) {
  if (!query?.userId) throw new ValidationError(400, 'userId is required');
  const activityType = query.activityType ? String(query.activityType).toLowerCase() : null;
  if (activityType && !ALLOWED_ACTIVITY_TYPES.has(activityType)) {
    throw new ValidationError(400, 'Invalid activityType. Only walking is supported.');
  }
  const trendDays = Math.min(30, Math.max(1, parseInt(query.days, 10) || 7));
  const targetDate = query.targetDate && /^\d{4}-\d{2}-\d{2}$/.test(query.targetDate)
    ? query.targetDate : toDateKey();
  return { userId: query.userId, trendDays, activityType, targetDate };
}

export function validateSaveDaily(body) {
  if (!body) throw new ValidationError(400, 'Request body is missing');
  const { userId, steps } = body;
  if (!userId || steps === undefined || steps === null) {
    throw new ValidationError(400, 'Missing required fields: userId, steps');
  }
  const activityType = String(body.activityType || 'walking').toLowerCase();
  if (!ALLOWED_ACTIVITY_TYPES.has(activityType)) {
    throw new ValidationError(400, 'Invalid activityType. Only walking is supported.');
  }
  return {
    userId,
    activityDate: body.activityDate || toDateKey(),
    steps,
    activityType,
    caloriesBurned: body.caloriesBurned,
    currentSensorTotal: body.currentSensorTotal ?? null,
  };
}

export function validateWatchCalories(query) {
  if (!query?.userId) throw new ValidationError(400, 'userId is required');
  const targetDate = query.date || new Date().toISOString().slice(0, 10);
  return { userId: query.userId, targetDate };
}

export { toDateKey };
