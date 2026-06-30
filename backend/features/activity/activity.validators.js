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

const VALID_TIME_REPORT_DATE_RANGES = new Set(['today', 'yesterday', 'last7days', 'last30days', 'custom']);
const VALID_TIME_REPORT_ROLES = new Set(['admin', 'coach', 'member', 'developer']);

export function validateTimeReport(query) {
  if (!query?.userId) throw new ValidationError(400, 'userId is required');
  const userId = parseInt(query.userId, 10);
  if (Number.isNaN(userId)) throw new ValidationError(400, 'userId must be a valid number');

  const dateRange = String(query.dateRange || '').toLowerCase();
  if (!VALID_TIME_REPORT_DATE_RANGES.has(dateRange)) {
    throw new ValidationError(400, `dateRange must be one of: ${Array.from(VALID_TIME_REPORT_DATE_RANGES).join(', ')}`);
  }

  if (dateRange === 'custom') {
    if (!query.startDate || !query.endDate) {
      throw new ValidationError(400, 'startDate and endDate are required when dateRange is "custom"');
    }
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(query.startDate) || !dateRegex.test(query.endDate)) {
      throw new ValidationError(400, 'startDate and endDate must be in YYYY-MM-DD format');
    }
  }

  const role = query.role ? String(query.role).toLowerCase() : 'member';
  if (!VALID_TIME_REPORT_ROLES.has(role)) {
    throw new ValidationError(400, `role must be one of: ${Array.from(VALID_TIME_REPORT_ROLES).join(', ')}`);
  }

  const tzOffset = query.userTimezoneOffset !== undefined ? parseInt(query.userTimezoneOffset, 10) : 0;

  return {
    userId,
    role,
    dateRange,
    startDate: query.startDate,
    endDate: query.endDate,
    tzOffset: Number.isNaN(tzOffset) ? 0 : tzOffset,
  };
}

export { toDateKey };
