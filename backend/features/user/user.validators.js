/**
 * User feature — input validators.
 */
import { ValidationError } from '../../shared/lib/ValidationError.js';

const VALID_DIETS = ['Vegetarian', 'Non-Vegetarian', 'Vegan', 'Pescatarian'];

export function normalizeEmail(raw) {
  return raw ? String(raw).toLowerCase().trim() : raw;
}

export function validateGetProfile(query) {
  const email = normalizeEmail(query?.email);
  if (!email) throw new ValidationError(400, 'Missing required query parameter: email');
  return { email };
}

export function validateUpdateProfile(body) {
  if (!body) throw new ValidationError(400, 'Request body is missing');
  const email = body.email;
  if (!email) throw new ValidationError(400, 'Missing required field: email');
  return {
    email,
    name: body.name,
    height: body.height,
    bmr: body.bmr,
    dietType: body.dietType,
    profileImage: body.profileImage,
    phoneNumber: body.phoneNumber,
  };
}

export function validateUserId(query) {
  const userId = query?.userId;
  if (!userId) throw new ValidationError(400, 'Missing required parameter: userId');
  return { userId };
}

export function validateLookup(req) {
  const raw = req.method === 'GET' ? req.query?.email : req.body?.email;
  const email = normalizeEmail(raw);
  if (!email) throw new ValidationError(400, 'Email is required');
  return { email };
}

export function validateGoogleUser(body) {
  const email = normalizeEmail(body?.email);
  const displayName = body?.displayName;
  if (!email || !displayName) {
    throw new ValidationError(400, 'Email and Display Name are required');
  }
  return { email, displayName, photoURL: body?.photoURL || null };
}

export function validateSnooze(body) {
  const { userId } = body || {};
  if (!userId) throw new ValidationError(400, 'Missing required field: userId');
  return { userId };
}

export function validateDeleteAccount(body) {
  const email = normalizeEmail(body?.email);
  if (!email) throw new ValidationError(400, 'Missing required field: email');
  return { email };
}

export function validateSkipSetup(body) {
  const { email, coachId, coachName } = body || {};
  if (!email) throw new ValidationError(400, 'Email is required');
  return { email, coachId: coachId || null, coachName: coachName || null };
}

export function validateStatus(query) {
  const email = normalizeEmail(query?.email);
  if (!email) throw new ValidationError(400, 'Email is required');
  return { email };
}

export { VALID_DIETS };
