/**
 * Extract the client app version from an HTTP request.
 *
 * Preferred: header `X-App-Version` (or `x-app-version`).
 * Fallback: query/body `appVersion` / `clientVersion`.
 *
 * Handlers that gate behaviour with `isEnabledForAppVersion` MUST pass
 * the value returned here into that helper.
 *
 * @param {{ headers?: object, query?: object, body?: object }} req
 * @returns {string|null}
 */
export function getClientAppVersion(req) {
  if (!req || typeof req !== 'object') return null;

  const headers = req.headers || {};
  const headerRaw =
    headers['x-app-version']
    ?? headers['X-App-Version']
    ?? headers['X-APP-VERSION'];
  if (headerRaw != null && String(headerRaw).trim() !== '') {
    return String(headerRaw).trim();
  }

  const query = req.query || {};
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const fallback =
    query.appVersion
    ?? query.clientVersion
    ?? body.appVersion
    ?? body.clientVersion
    ?? null;

  if (fallback == null || String(fallback).trim() === '') return null;
  return String(fallback).trim();
}
