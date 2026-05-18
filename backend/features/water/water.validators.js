import { ValidationError } from '../../shared/lib/ValidationError.js';

function todayIST() {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().split('T')[0];
}

export function validateGetIntake(query) {
  if (!query?.userId) throw new ValidationError(400, 'userId is required');
  return { userId: query.userId, date: query.date || todayIST() };
}
