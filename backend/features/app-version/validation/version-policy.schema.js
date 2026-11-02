import { ValidationError } from '../../../shared/lib/ValidationError.js';

export function validateVersionPolicyQuery(query = {}) {
  const clientVersion = String(
    query.version ?? query.clientVersion ?? query.appVersion ?? '',
  ).trim();
  if (!clientVersion) {
    throw new ValidationError(400, 'version is required');
  }

  const platformRaw = query.platform ?? query.os ?? null;
  const platform = platformRaw != null ? String(platformRaw).trim().toLowerCase() : 'android';

  const codeRaw = query.versionCode ?? query.version_code ?? query.buildNumber ?? null;
  let versionCode = null;
  if (codeRaw != null && String(codeRaw).trim() !== '') {
    const n = Number.parseInt(String(codeRaw), 10);
    if (!Number.isFinite(n) || n < 0) {
      throw new ValidationError(400, 'versionCode must be a non-negative integer');
    }
    versionCode = n;
  }

  return { clientVersion, platform, versionCode };
}
