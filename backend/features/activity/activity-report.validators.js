/**
 * Activity Report Validators
 */
import { ValidationError } from '../../shared/lib/ValidationError.js';

const VALID_ACTIVITY_TYPES = new Set(['summary', 'weight', 'education', 'breakfast', 'lunch', 'dinner', 'water', 'calories']);
const VALID_DATE_RANGES = new Set(['today', 'yesterday', 'last7days', 'last30days', 'custom']);
const VALID_ROLES = new Set(['admin', 'coach', 'member', 'developer']);

/**
 * Validate activity report request parameters
 */
export function validateActivityReport(query) {
  if (!query?.userId) {
    throw new ValidationError(400, 'userId is required');
  }
  
  const userId = parseInt(query.userId, 10);
  if (Number.isNaN(userId)) {
    throw new ValidationError(400, 'userId must be a valid number');
  }
  
  if (!query.activityType) {
    throw new ValidationError(400, 'activityType is required');
  }
  
  const activityType = String(query.activityType).toLowerCase();
  if (!VALID_ACTIVITY_TYPES.has(activityType)) {
    throw new ValidationError(400, `activityType must be one of: ${Array.from(VALID_ACTIVITY_TYPES).join(', ')}`);
  }
  
  if (!query.dateRange) {
    throw new ValidationError(400, 'dateRange is required');
  }
  
  const dateRange = String(query.dateRange).toLowerCase();
  if (!VALID_DATE_RANGES.has(dateRange)) {
    throw new ValidationError(400, `dateRange must be one of: ${Array.from(VALID_DATE_RANGES).join(', ')}`);
  }
  
  if (dateRange === 'custom') {
    if (!query.startDate || !query.endDate) {
      throw new ValidationError(400, 'startDate and endDate are required when dateRange is "custom"');
    }
    
    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(query.startDate) || !dateRegex.test(query.endDate)) {
      throw new ValidationError(400, 'startDate and endDate must be in YYYY-MM-DD format');
    }
  }
  
  const role = query.role ? String(query.role).toLowerCase() : 'member';
  if (!VALID_ROLES.has(role)) {
    throw new ValidationError(400, `role must be one of: ${Array.from(VALID_ROLES).join(', ')}`);
  }
  
  return {
    userId,
    activityType,
    dateRange,
    startDate: query.startDate,
    endDate: query.endDate,
    role,
  };
}
