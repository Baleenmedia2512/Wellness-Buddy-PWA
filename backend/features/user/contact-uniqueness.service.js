/**
 * Contact uniqueness checks for team_table Email and PhoneNumber.
 */
import * as repo from './user.repository.js';
import { normalizeEmail } from './user.validators.js';

const PHONE_CONFLICT_MESSAGE = 'This phone number is already registered to another account.';
const EMAIL_CONFLICT_MESSAGE = 'This email address is already registered to another account.';

export async function findEmailConflict(email, excludeUserId = null) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  return repo.findConflictingEmail(normalized, excludeUserId);
}

export async function findPhoneConflict(phone, excludeUserId = null) {
  if (!phone || !String(phone).trim()) return null;
  return repo.findConflictingPhone(phone, excludeUserId);
}

export async function assertEmailAvailable(email, excludeUserId = null) {
  const conflict = await findEmailConflict(email, excludeUserId);
  if (conflict) {
    return {
      ok: false,
      httpStatus: 409,
      body: { success: false, message: EMAIL_CONFLICT_MESSAGE },
    };
  }
  return { ok: true };
}

export async function assertPhoneAvailable(phone, excludeUserId = null) {
  const conflict = await findPhoneConflict(phone, excludeUserId);
  if (conflict) {
    return {
      ok: false,
      httpStatus: 409,
      body: { success: false, message: PHONE_CONFLICT_MESSAGE },
    };
  }
  return { ok: true };
}

export function isUniqueViolationError(error) {
  return error?.code === '23505';
}

export function uniqueViolationResponse(error) {
  const detail = String(error?.message || error?.details || '').toLowerCase();
  if (detail.includes('email')) {
    return { httpStatus: 409, body: { success: false, message: EMAIL_CONFLICT_MESSAGE } };
  }
  if (detail.includes('phone')) {
    return { httpStatus: 409, body: { success: false, message: PHONE_CONFLICT_MESSAGE } };
  }
  return {
    httpStatus: 409,
    body: { success: false, message: 'This contact detail is already registered to another account.' },
  };
}
