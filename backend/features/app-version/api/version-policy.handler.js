/**
 * GET /api/app/version-policy — evaluate client version against server policy.
 */
import {
  evaluateVersionGate,
  resolveEffectiveMinVersion,
} from '../domain/version.rules.js';
import { loadVersionPolicyConfig } from '../domain/version-policy.config.js';

function storeUrlForPlatform(platform, config) {
  const p = String(platform || '').trim().toLowerCase();
  if (p === 'ios') return config.storeUrlIos;
  if (p === 'android') return config.storeUrlAndroid;
  return config.storeUrlAndroid;
}

/**
 * @param {{
 *   clientVersion: string,
 *   platform?: string|null,
 *   versionCode?: number|null,
 * }} input
 */
export function getVersionPolicy(input) {
  const config = loadVersionPolicyConfig();

  if (!config.enabled) {
    return {
      httpStatus: 200,
      body: {
        success: true,
        data: {
          enabled: false,
          status: 'ok',
          clientVersion: input.clientVersion,
        },
      },
    };
  }

  const platform = String(input.platform || 'android').trim().toLowerCase();
  const enforceForClient = platform === 'web' ? config.enforceWeb : true;

  const effectiveMinVersion = resolveEffectiveMinVersion({
    minRequiredVersion: config.minRequiredVersion,
    graceMinVersion: config.graceMinVersion,
    graceUntil: config.graceUntil,
  });

  let status = evaluateVersionGate({
    clientVersion: input.clientVersion,
    latestVersion: config.latestVersion,
    recommendedVersion: config.recommendedVersion,
    minRequiredVersion: config.minRequiredVersion,
    graceMinVersion: config.graceMinVersion,
    graceUntil: config.graceUntil,
  });

  if (
    enforceForClient
    && platform === 'android'
    && config.minAndroidVersionCode != null
    && input.versionCode != null
    && input.versionCode < config.minAndroidVersionCode
    && status !== 'update_required'
  ) {
    status = 'update_required';
  }

  if (!enforceForClient) {
    status = 'ok';
  }

  const softMessage =
    'A new version of Wellness Valley is available with improvements and fixes.';

  return {
    httpStatus: 200,
    body: {
      success: true,
      data: {
        enabled: true,
        status,
        clientVersion: input.clientVersion,
        latestVersion: config.latestVersion,
        recommendedVersion: config.recommendedVersion,
        minRequiredVersion: config.minRequiredVersion,
        effectiveMinVersion: effectiveMinVersion,
        graceMinVersion: config.graceMinVersion,
        graceUntil: config.graceUntil,
        enforceWeb: config.enforceWeb,
        platform,
        storeUrl: storeUrlForPlatform(platform, config),
        messages: {
          required: config.forceUpdateMessage,
          recommended: softMessage,
        },
      },
    },
  };
}
