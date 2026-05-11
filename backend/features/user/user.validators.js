/**
 * User feature — input validators.
 */
import { ValidationError } from '../weight/weight.validators.js';

function normalizeEmail(raw) {
  return raw ? raw.toLowerCase().trim() : raw;
}

export function requireEmail(raw, paramName = 'email') {
  const email = normalizeEmail(raw);
  if (!email) throw new ValidationError(400, `Missing required field: ${paramName}`);
  return email;
}

export function validateLookupInput(req) {
  const raw = req.method === 'GET' ? req.query.email : req.body?.email;
  return { email: requireEmail(raw) };
}

export function validateProfileGet(query) {
  return { email: requireEmail(query?.email, 'email (query)') };
}

export function validateProfileUpdate(body) {
  if (!body) throw new ValidationError(400, 'Request body is missing');
  if (!body.email) throw new ValidationError(400, 'Missing required field: email');
  return { ...body, email: normalizeEmail(body.email) };
}

export function validateUserContext(query) {
  if (!query?.userId) throw new ValidationError(400, 'Missing required parameter: userId');
  return { userId: query.userId };
}

export function validateGoogleUser(body) {
  const { email: rawEmail, displayName, photoURL } = body || {};
  if (!rawEmail || !displayName) {
    throw new ValidationError(400, 'Email and Display Name are required');
  }
  return { email: normalizeEmail(rawEmail), displayName, photoURL };
}

export function validateSnoozeInput(body) {
  const { userId } = body || {};
  if (!userId) throw new ValidationError(400, 'Missing required field: userId');
  return { userId };
}

export function validateDeleteAccount(body) {
  if (!body?.email) throw new ValidationError(400, 'Missing required field: email');
  return { email: normalizeEmail(body.email) };
}

export function validateSkipSetup(body) {
  if (!body?.email) throw new ValidationError(400, 'Email is required');
  return { email: body.email, coachId: body.coachId, coachName: body.coachName };
}

export function validateStatusInput(query) {
  if (!query?.email) throw new ValidationError(400, 'Email is required');
  return { email: normalizeEmail(query.email) };
}
