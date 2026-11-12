/**
 * Which requests may proceed while mandatory profile fields are blocking.
 * Pure. No I/O.
 *
 * The actor is the member id the request already sends (viewer, requester, or
 * userId), never the diary owner being viewed.
 *
 * verify-session only checks that a team_table row exists for the id, email,
 * or phone the client sends. There is no signed token. When a userId cookie
 * is present, that cookie is the actor and a different query or body id is
 * rejected. A request with no cookie still uses the client-supplied id, the
 * same way the rest of the API does.
 */
import { timingSafeEqual } from 'node:crypto';

const RECOVERY_PREFIXES = Object.freeze([
  '/api/auth/',
  '/api/app/version-policy',
  '/api/user/profile',
  '/api/user/mandatory-fields',
  '/api/user/consent',
  '/api/user/verify-session',
  '/api/user/google',
  '/api/user/lookup',
  '/api/user/status',
  '/api/user/context',
  '/api/user/save-email',
  '/api/user/check-onboarding-email',
  '/api/user/verify-onboarding-email',
  '/api/user/community-id/',
  '/api/user/community-position/',
  '/api/user/community-positions',
  '/api/user/height/',
  '/api/user/skip-setup',
  '/api/admin/mandatory-fields',
  '/api/upline/request',
  '/api/upline/validate-otp',
  '/api/upline/cancel-request',
  '/api/users/search',
  '/api/cron/',
  '/api/share/',
  '/api/media/',
  '/api/background-analysis/public/',
  '/api/body-parameters-card/public/',
  '/api/misc/server-time',
  '/api/ai/worker',
]);

/**
 * @param {import('http').IncomingMessage|undefined} req
 * @returns {string}
 */
export function requestPathname(req) {
  const raw = String(req?.url || '');
  const withoutQuery = raw.split('?')[0];
  if (/^https?:\/\//i.test(withoutQuery)) {
    try {
      return new URL(withoutQuery).pathname;
    } catch {
      return withoutQuery;
    }
  }
  return withoutQuery;
}

/**
 * Admin and developer only. Member, coach, and upline cannot change rules.
 * @param {unknown} role
 * @returns {boolean}
 */
export function isMandatorySettingsAdmin(role) {
  const normalized = String(role || '').trim().toLowerCase();
  return normalized === 'admin' || normalized === 'developer';
}

/**
 * @param {string} pathname
 * @returns {boolean}
 */
export function isMandatoryRecoveryRoute(pathname) {
  const path = String(pathname || '');
  if (!path) return false;
  return RECOVERY_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix));
}

/**
 * @param {object} source
 * @param {{ allowBody?: boolean }} [options]
 * @returns {{ userId: number|null, email: string|null }}
 */
export function resolveRequestIdentity(source, { allowBody = true } = {}) {
  const query = source?.query && typeof source.query === 'object' ? source.query : {};
  const body = allowBody && source?.body && typeof source.body === 'object' ? source.body : {};

  const userRaw = first(
    query.viewerUserId,
    query.requesterUserId,
    query.userId,
    query.UserId,
    body.viewerUserId,
    body.requesterUserId,
    body.userId,
    body.UserId,
  );
  const emailRaw = first(
    query.requesterEmail,
    query.email,
    query.Email,
    body.requesterEmail,
    body.email,
    body.Email,
  );

  const userNum = Number.parseInt(String(userRaw ?? ''), 10);
  const userId = Number.isFinite(userNum) && userNum > 0 ? userNum : null;
  const email = String(emailRaw || '').trim().toLowerCase();
  return {
    userId,
    email: email && email.includes('@') ? email : null,
  };
}

function cookieUserId(source) {
  const raw = source?.cookies?.userId ?? source?.cookies?.UserId;
  const parsed = Number.parseInt(String(raw ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Prefer a userId cookie over a different client-supplied id.
 * A mismatch is a conflict. The caller must not load the other member.
 *
 * @param {object} source
 * @param {{ allowBody?: boolean }} [options]
 */
export function resolveMandatoryRequestIdentity(source, options) {
  const client = resolveRequestIdentity(source, options);
  const authenticatedUserId = cookieUserId(source);
  if (!authenticatedUserId) {
    return { ...client, authenticatedUserId: null, conflict: false };
  }
  if (client.userId && client.userId !== authenticatedUserId) {
    return {
      userId: null,
      email: null,
      authenticatedUserId,
      conflict: true,
    };
  }
  return {
    userId: authenticatedUserId,
    email: client.email,
    authenticatedUserId,
    conflict: false,
  };
}

/**
 * A supplied user id and email must name the same row.
 * A user id that is not found does not fall through to the email.
 *
 * @param {{ userId?: number|null, email?: string|null, rowById?: object|null, rowByEmail?: object|null }} input
 * @returns {{ ok: true, row: object } | { ok: false, status: number, message: string, mismatch?: boolean }}
 */
export function mandatoryActorLookup({ userId = null, email = null, rowById = null, rowByEmail = null } = {}) {
  if (userId) {
    if (!rowById) {
      return { ok: false, status: 404, message: 'Requester not found' };
    }
    if (email) {
      const rowEmail = String(rowById.Email || '').trim().toLowerCase();
      if (!rowEmail || rowEmail !== email) {
        return {
          ok: false,
          status: 403,
          message: 'This profile does not match the signed-in account.',
          mismatch: true,
        };
      }
    }
    return { ok: true, row: rowById };
  }
  if (email) {
    if (!rowByEmail) return { ok: false, status: 404, message: 'Requester not found' };
    return { ok: true, row: rowByEmail };
  }
  return { ok: false, status: 401, message: 'Sign in before loading mandatory profile fields.' };
}

function safeBearerEqual(authorization, secret) {
  const actual = Buffer.from(String(authorization || ''));
  const expected = Buffer.from(`Bearer ${secret}`);
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

/**
 * Cron auth, then method. Missing secret and a bad bearer never run the job.
 * @param {{ method?: string, authorization?: string, secret?: string }} input
 */
export function authorizeMandatoryCron({ method, authorization, secret } = {}) {
  if (!secret) return { ok: false, status: 500, code: 'MISCONFIGURED' };
  if (!safeBearerEqual(authorization, secret)) {
    return { ok: false, status: 401, code: 'UNAUTHORIZED' };
  }
  const verb = String(method || '').toUpperCase();
  if (verb !== 'GET' && verb !== 'POST') {
    return { ok: false, status: 405, code: 'METHOD_NOT_ALLOWED' };
  }
  return { ok: true, status: 200 };
}

function first(...values) {
  for (const value of values) {
    if (value != null && String(value).trim() !== '') return value;
  }
  return null;
}

/**
 * What the product gate should do before it reads a profile.
 * Missing tables are the initial rollout. A failed read after the tables are
 * expected, or any required rule, must not be treated as allowed.
 *
 * @param {{ deployed?: boolean, failed?: boolean, activated?: boolean }} state
 * @returns {'allow'|'enforce'|'unavailable'}
 */
export function mandatoryDeploymentDecision(state = {}) {
  if (state.failed === true) return 'unavailable';
  if (state.deployed !== true || state.activated !== true) return 'allow';
  return 'enforce';
}

/**
 * Map an evaluation result to an HTTP block. Null means the handler may run.
 * Unavailable is never treated as allowed.
 *
 * @param {object|null|undefined} evaluation
 * @returns {{ httpStatus: number, body: object }|null}
 */
export function mandatoryEnforcementResponse(evaluation) {
  if (evaluation?.reason === 'campaign-columns-missing') {
    return {
      httpStatus: 503,
      body: {
        success: false,
        code: 'MANDATORY_SCHEMA_INCOMPLETE',
        message: 'Mandatory campaign columns are missing. Profile enforcement is not operational until they are installed.',
      },
    };
  }

  if (!evaluation || evaluation.enforcement === 'unavailable' || evaluation.status === 'profile-unavailable') {
    return {
      httpStatus: 503,
      body: {
        success: false,
        code: 'PROFILE_UNAVAILABLE',
        message: 'Profile could not be loaded. Please try again.',
      },
    };
  }

  if (evaluation.blocked) {
    const fields = (evaluation.fields || []).map((field) => ({
      fieldKey: field.fieldKey,
      label: field.label,
      blocking: field.blocking === true,
      graceType: field.graceType,
      remaining: field.remaining,
    }));
    return {
      httpStatus: 403,
      body: {
        success: false,
        code: 'MANDATORY_PROFILE',
        message: 'Complete the required profile fields to continue.',
        fields,
      },
    };
  }

  return null;
}
