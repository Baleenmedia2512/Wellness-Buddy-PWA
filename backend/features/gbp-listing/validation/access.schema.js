import { ValidationError } from '../../../shared/lib/ValidationError.js';

export function validateUserId(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
    throw new ValidationError(400, 'A valid userId is required');
  }
  return n;
}

export function validateCenterId(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
    throw new ValidationError(400, 'A valid centerId is required');
  }
  return n;
}

export function validateRequestId(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
    throw new ValidationError(400, 'A valid requestId is required');
  }
  return n;
}
