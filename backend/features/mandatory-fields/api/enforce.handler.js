/**
 * Shared product-API gate.
 *
 * Recovery routes (profile save, OTP, consent, auth, version policy) are not
 * blocked. A missing profile after a rule is required is HTTP 503. A database
 * error while reading the rules is also HTTP 503, because the server cannot
 * prove that every rule is still off. Tables that are not installed yet are
 * not a failure. A blocking field is HTTP 403 MANDATORY_PROFILE. The product
 * handler does not run.
 *
 * APP_VERSION_ENFORCE_API is not changed here. Routes that already call
 * rejectIfAppVersionTooOld keep that check. See the phase report for the
 * env vars to set at deploy time.
 */
import { getClientAppVersion } from '../../../shared/lib/client-app-version.js';
import logger from '../../../shared/lib/logger.js';
import {
  isMandatoryRecoveryRoute,
  mandatoryEnforcementResponse,
  requestPathname,
  resolveMandatoryRequestIdentity,
} from '../domain/access.rules.js';
import { evaluateUserMandatoryFields } from '../mandatoryFields.service.js';

/**
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @param {{ evaluate?: typeof evaluateUserMandatoryFields, actorUserId?: unknown }} [deps]
 * actorUserId overrides the client id when the route's actor is a coach id
 * or the owner stored on a job or file path.
 * @returns {Promise<boolean>} true when a response was already sent
 */
export async function rejectIfMandatoryProfileBlocks(req, res, deps = {}) {
  if (!req || req.method === 'OPTIONS') return false;
  const pathname = requestPathname(req);
  if (isMandatoryRecoveryRoute(pathname)) return false;

  const identitySource = deps.actorUserId != null && String(deps.actorUserId).trim() !== ''
    ? { query: { userId: deps.actorUserId }, body: {} }
    : req;
  const identity = resolveMandatoryRequestIdentity(identitySource, { allowBody: true });
  if (identity.conflict) {
    res.status(403).json({
      success: false,
      code: 'MANDATORY_IDENTITY_MISMATCH',
      message: 'This profile does not match the signed-in account.',
    });
    return true;
  }
  if (!identity.userId && !identity.email) return false;

  const evaluate = deps.evaluate || evaluateUserMandatoryFields;
  let evaluation;
  try {
    evaluation = await evaluate({
      userId: identity.userId,
      email: identity.email,
      appVersion: getClientAppVersion(req),
      conflict: identity.conflict,
    });
  } catch (err) {
    if (err?.status === 403) {
      res.status(403).json({
        success: false,
        code: 'MANDATORY_IDENTITY_MISMATCH',
        message: 'This profile does not match the signed-in account.',
      });
      return true;
    }
    logger.warn('[mandatory-fields] enforcement failed closed', {
      pathname,
      userId: identity.userId,
      message: err?.message || String(err),
    });
    evaluation = { status: 'profile-unavailable', enforcement: 'unavailable', blocked: false, fields: [] };
  }

  const http = mandatoryEnforcementResponse(evaluation);
  if (!http) return false;
  res.status(http.httpStatus).json(http.body);
  return true;
}
