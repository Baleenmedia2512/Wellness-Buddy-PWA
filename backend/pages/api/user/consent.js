import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { validateRecordConsent } from '../../../features/user/user.validators.js';
import {
  recordConsent,
  getConsentStatus,
  discardUnconsentedUser,
} from '../../../features/user/user.service.js';
import { buildConsentDeviceInfo, extractClientIp } from '../../../shared/lib/clientMeta.js';
import { ValidationError } from '../../../shared/lib/ValidationError.js';

function validateConsentIdentity(input = {}) {
  const emailRaw = input.email != null ? String(input.email).trim().toLowerCase() : '';
  const userIdRaw = input.userId;
  const userId = userIdRaw != null && String(userIdRaw).trim() !== ''
    ? Number(userIdRaw)
    : null;
  if ((!userId || !Number.isFinite(userId)) && !emailRaw) {
    throw new ValidationError(400, 'userId or email is required');
  }
  return {
    userId: userId && Number.isFinite(userId) ? userId : null,
    email: emailRaw || null,
  };
}

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, POST, DELETE, OPTIONS')) return;

  if (req.method === 'GET') {
    return runService(res, () => getConsentStatus(validateConsentIdentity(req.query)));
  }

  if (req.method === 'DELETE') {
    // Decline after identify: remove account that never accepted consent.
    const identity = validateConsentIdentity({ ...(req.body || {}), ...(req.query || {}) });
    return runService(res, () => discardUnconsentedUser(identity));
  }

  if (req.method !== 'POST') return methodNotAllowed(res);

  const body = {
    ...(req.body || {}),
    ipAddress: extractClientIp(req),
    deviceInfo: buildConsentDeviceInfo(req, req.body?.deviceInfo),
  };

  return runService(res, () => recordConsent(validateRecordConsent(body)));
}
