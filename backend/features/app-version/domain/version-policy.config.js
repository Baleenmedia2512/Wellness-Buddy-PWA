/**
 * Server-side app version policy — configure via environment variables.
 *
 * APP_VERSION_POLICY_ENABLED=true|false (default true)
 * APP_VERSION_LATEST=3.4.3
 * APP_VERSION_MIN_REQUIRED=3.4.0
 * APP_VERSION_RECOMMENDED=3.4.3
 * APP_VERSION_GRACE_MIN=3.3.0          (optional — lower floor during grace)
 * APP_VERSION_GRACE_UNTIL=2026-08-31   (optional ISO date; IST-friendly)
 * APP_VERSION_FORCE_MESSAGE=...          (optional)
 * APP_VERSION_STORE_ANDROID=https://...
 * APP_VERSION_STORE_IOS=https://...
 * APP_VERSION_MIN_ANDROID_CODE=62        (optional hard floor by versionCode)
 * APP_VERSION_ENFORCE_WEB=false          (default false — web PWA lenient)
 * APP_VERSION_ENFORCE_API=false          (default false — server lock on critical APIs)
 */

const DEFAULT_STORE_ANDROID =
  'https://play.google.com/store/apps/details?id=com.wellnessvalley.app';

function envStr(key, fallback = '') {
  const v = process.env[key];
  return v != null && String(v).trim() !== '' ? String(v).trim() : fallback;
}

function envBool(key, fallback = false) {
  const v = process.env[key];
  if (v == null || String(v).trim() === '') return fallback;
  return String(v).trim().toLowerCase() === 'true';
}

function envInt(key) {
  const n = Number.parseInt(String(process.env[key] ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * @returns {import('./version.rules.js').VersionPolicyConfig}
 */
export function loadVersionPolicyConfig() {
  const enabled = envBool('APP_VERSION_POLICY_ENABLED', true);
  const latestVersion = envStr('APP_VERSION_LATEST', '0.0.0');
  const minRequiredVersion = envStr('APP_VERSION_MIN_REQUIRED', '0.0.0');
  const recommendedVersion = envStr('APP_VERSION_RECOMMENDED', latestVersion);
  const graceMinVersion = envStr('APP_VERSION_GRACE_MIN', '') || null;
  const graceUntil = envStr('APP_VERSION_GRACE_UNTIL', '') || null;
  const forceUpdateMessage = envStr(
    'APP_VERSION_FORCE_MESSAGE',
    'Please update Wellness Valley to the latest version to continue.',
  );
  const storeUrlAndroid = envStr('APP_VERSION_STORE_ANDROID', DEFAULT_STORE_ANDROID);
  const storeUrlIos = envStr('APP_VERSION_STORE_IOS', storeUrlAndroid);
  const minAndroidVersionCode = envInt('APP_VERSION_MIN_ANDROID_CODE');
  const enforceWeb = envBool('APP_VERSION_ENFORCE_WEB', false);
  // Server-side lock for old APKs that never call /api/app/version-policy.
  // Default OFF so rollout stays safe until Play Store build is live.
  const enforceApi = envBool('APP_VERSION_ENFORCE_API', false);

  return {
    enabled,
    latestVersion,
    minRequiredVersion,
    recommendedVersion,
    graceMinVersion,
    graceUntil,
    forceUpdateMessage,
    storeUrlAndroid,
    storeUrlIos,
    minAndroidVersionCode,
    enforceWeb,
    enforceApi,
  };
}
