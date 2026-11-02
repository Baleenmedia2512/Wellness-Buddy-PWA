/**
 * HTTP helper: reject critical API requests when the client app is too old.
 *
 * Does NOT apply to /api/app/version-policy (clients must still be able to
 * ask for policy). Wire into auth / session / profile entry points.
 *
 * Returns true when a 426 response was already sent.
 */
import { getClientAppVersion } from '../../../shared/lib/client-app-version.js';
import { loadVersionPolicyConfig } from '../domain/version-policy.config.js';
import { evaluateApiVersionEnforcement } from '../domain/enforce-api.rules.js';

export const APP_UPDATE_REQUIRED_CODE = 'APP_UPDATE_REQUIRED';
export const APP_UPDATE_HTTP_STATUS = 426;

function storeUrlForRequest(req, config) {
  const headers = req?.headers || {};
  const platformRaw =
    headers['x-app-platform']
    ?? headers['X-App-Platform']
    ?? req?.query?.platform
    ?? req?.body?.platform
    ?? '';
  const platform = String(platformRaw || '').trim().toLowerCase();
  if (platform === 'ios') return config.storeUrlIos;
  return config.storeUrlAndroid;
}

function readVersionCode(req) {
  const headers = req?.headers || {};
  const raw =
    headers['x-app-version-code']
    ?? headers['X-App-Version-Code']
    ?? req?.query?.versionCode
    ?? req?.body?.versionCode
    ?? null;
  if (raw == null || String(raw).trim() === '') return null;
  const n = Number.parseInt(String(raw), 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @returns {boolean} true if request was rejected
 */
export function rejectIfAppVersionTooOld(req, res) {
  const config = loadVersionPolicyConfig();
  const clientVersion = getClientAppVersion(req);
  const clientVersionCode = readVersionCode(req);

  const verdict = evaluateApiVersionEnforcement({
    enforceApi: config.enforceApi,
    policyEnabled: config.enabled,
    clientVersion,
    minRequiredVersion: config.minRequiredVersion,
    graceMinVersion: config.graceMinVersion,
    graceUntil: config.graceUntil,
    minAndroidVersionCode: config.minAndroidVersionCode,
    clientVersionCode,
  });

  if (!verdict.blocked) return false;

  const storeUrl = storeUrlForRequest(req, config);
  res.status(APP_UPDATE_HTTP_STATUS).json({
    success: false,
    code: APP_UPDATE_REQUIRED_CODE,
    message: config.forceUpdateMessage,
    data: {
      status: 'update_required',
      clientVersion: clientVersion || null,
      minRequiredVersion: config.minRequiredVersion,
      effectiveMinVersion: verdict.effectiveMinVersion,
      reason: verdict.reason,
      storeUrl,
      messages: {
        required: config.forceUpdateMessage,
      },
    },
  });
  return true;
}
