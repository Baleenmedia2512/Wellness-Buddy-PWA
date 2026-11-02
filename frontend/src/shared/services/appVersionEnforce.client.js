/**
 * Client-side bridge when a critical API returns APP_UPDATE_REQUIRED (426).
 * New apps show the hard-block screen; old apps never run this code.
 */
export const APP_UPDATE_REQUIRED_CODE = 'APP_UPDATE_REQUIRED';
export const APP_UPDATE_EVENT = 'wellness:app-update-required';
const STORAGE_KEY = 'appUpdateRequiredPolicy';

/**
 * @param {unknown} body
 * @param {number} [httpStatus]
 * @returns {boolean}
 */
export function isAppUpdateRequiredResponse(body, httpStatus) {
  if (httpStatus === 426) return true;
  if (!body || typeof body !== 'object') return false;
  return body.code === APP_UPDATE_REQUIRED_CODE
    || body.data?.status === 'update_required';
}

/**
 * @param {object} [body]
 * @returns {object}
 */
export function policyFromUpdateRequiredBody(body) {
  const data = body?.data && typeof body.data === 'object' ? body.data : {};
  return {
    status: 'update_required',
    clientVersion: data.clientVersion ?? null,
    minRequiredVersion: data.minRequiredVersion ?? null,
    effectiveMinVersion: data.effectiveMinVersion ?? data.minRequiredVersion ?? null,
    storeUrl: data.storeUrl ?? null,
    messages: {
      required:
        data.messages?.required
        || body?.message
        || 'Please update Wellness Valley to the latest version to continue.',
    },
    ...data,
  };
}

/**
 * Persist + broadcast so useAppVersionPolicy can hard-block immediately.
 * @param {object} [body]
 */
export function notifyAppUpdateRequired(body) {
  const policy = policyFromUpdateRequiredBody(body || {});
  try {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(policy));
      window.dispatchEvent(new CustomEvent(APP_UPDATE_EVENT, { detail: policy }));
    }
  } catch {
    /* ignore */
  }
  return policy;
}

/**
 * @returns {object|null}
 */
export function readForcedUpdatePolicy() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Clear persisted forced-update state after the client meets minimum version.
 */
export function clearForcedUpdatePolicy() {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Inspect a fetch Response; if update-required, notify and return true.
 * @param {Response} res
 * @param {object} [body]
 * @returns {boolean}
 */
export function handlePossibleAppUpdateRequired(res, body) {
  if (!isAppUpdateRequiredResponse(body, res?.status)) return false;
  notifyAppUpdateRequired(body);
  return true;
}
