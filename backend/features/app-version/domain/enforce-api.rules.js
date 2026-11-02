/**
 * Pure rules for server-side API version enforcement (no I/O).
 *
 * When ENFORCE_API is on:
 * - missing / invalid client version → update_required (old store apps)
 * - client below effective min → update_required
 * - otherwise → allow
 */
import {
  isAtLeastVersion,
  resolveEffectiveMinVersion,
} from './version.rules.js';

/**
 * @param {{
 *   enforceApi: boolean,
 *   policyEnabled?: boolean,
 *   clientVersion: string|null|undefined,
 *   minRequiredVersion: string,
 *   graceMinVersion?: string|null,
 *   graceUntil?: string|null,
 *   minAndroidVersionCode?: number|null,
 *   clientVersionCode?: number|null,
 *   now?: Date,
 * }} input
 * @returns {{ blocked: boolean, reason?: 'missing_version'|'below_min'|'below_android_code', effectiveMinVersion: string }}
 */
export function evaluateApiVersionEnforcement({
  enforceApi,
  policyEnabled = true,
  clientVersion,
  minRequiredVersion,
  graceMinVersion = null,
  graceUntil = null,
  minAndroidVersionCode = null,
  clientVersionCode = null,
  now = new Date(),
}) {
  const effectiveMinVersion = resolveEffectiveMinVersion({
    minRequiredVersion,
    graceMinVersion,
    graceUntil,
    now,
  });

  if (!enforceApi || policyEnabled === false) {
    return { blocked: false, effectiveMinVersion };
  }

  if (clientVersion == null || String(clientVersion).trim() === '') {
    return { blocked: true, reason: 'missing_version', effectiveMinVersion };
  }

  const meetsMin = isAtLeastVersion(clientVersion, effectiveMinVersion);
  if (meetsMin === false) {
    return { blocked: true, reason: 'below_min', effectiveMinVersion };
  }
  // Invalid semver while enforce is on → treat as old / unknown.
  if (meetsMin === null) {
    return { blocked: true, reason: 'missing_version', effectiveMinVersion };
  }

  if (
    minAndroidVersionCode != null
    && clientVersionCode != null
    && Number(clientVersionCode) < Number(minAndroidVersionCode)
  ) {
    return { blocked: true, reason: 'below_android_code', effectiveMinVersion };
  }

  return { blocked: false, effectiveMinVersion };
}
