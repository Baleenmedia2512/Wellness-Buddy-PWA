/**
 * Screen feature — input validators.
 */
import { ValidationError } from '../weight/weight.validators.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function todayIST() {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().split('T')[0];
}

export function validateSaveInput(body) {
  const { userId, date, totalScreenTimeSeconds } = body || {};
  if (!userId || totalScreenTimeSeconds === undefined || totalScreenTimeSeconds === null) {
    throw new ValidationError(400, 'Missing required fields: userId, totalScreenTimeSeconds');
  }
  const safeUserId = Number.parseInt(userId, 10);
  if (isNaN(safeUserId) || safeUserId <= 0) throw new ValidationError(400, 'Invalid userId');
  const safeSeconds = Math.max(0, Number.parseInt(totalScreenTimeSeconds, 10) || 0);
  const safeDate = (date && DATE_RE.test(String(date))) ? String(date) : todayIST();
  return { userId: safeUserId, date: safeDate, totalScreenTimeSeconds: safeSeconds };
}

export function validateHistoryInput(query) {
  const { userId, days, targetDate } = query || {};
  if (!userId) throw new ValidationError(400, 'Missing required field: userId');
  const safeUserId = Number.parseInt(userId, 10);
  if (isNaN(safeUserId) || safeUserId <= 0) throw new ValidationError(400, 'Invalid userId');
  const safeDays = Math.min(Math.max(1, Number.parseInt(days, 10) || 7), 90);
  const endDate = (targetDate && DATE_RE.test(targetDate)) ? targetDate : todayIST();
  return { userId: safeUserId, days: safeDays, endDate };
}
