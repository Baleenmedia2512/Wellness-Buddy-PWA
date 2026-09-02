/**
 * Mandatory app update orchestration.
 *
 * Server policy (/api/app/version-policy) is the single authority for
 * mandatory vs optional updates:
 *   - update_required  → blocking flow (this module)
 *   - update_recommended → soft banner only (useAppVersionPolicy)
 *
 * Platform behaviour when blocked:
 *   - Android: Google Play IMMEDIATE in-app update via InAppUpdatePlugin
 *   - iOS: blocking screen + App Store deep link (no native in-app update API)
 */
import { Capacitor } from '@capacitor/core';
import { getClientPlatform } from './appVersionPolicy.api.js';

/** @typedef {'idle'|'starting'|'play_flow'|'play_unavailable'|'installed'} MandatoryUpdatePhase */

/**
 * Whether the native mandatory-update flow should run for this policy state.
 * @param {{ blocked?: boolean, status?: string }} versionPolicy
 * @returns {boolean}
 */
export function shouldRunMandatoryUpdate(versionPolicy) {
  if (!versionPolicy?.blocked) return false;
  if (versionPolicy.status !== 'update_required') return false;
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/**
 * @returns {'android'|'ios'|null}
 */
export function getMandatoryUpdatePlatform() {
  const platform = getClientPlatform();
  if (platform === 'android' || platform === 'ios') return platform;
  return null;
}

/**
 * Start the platform-specific mandatory update flow.
 * @param {{
 *   startMandatoryUpdate?: () => Promise<void>,
 *   platform?: 'android'|'ios'|null,
 * }} deps
 * @returns {Promise<'play_started'|'ios_store_only'|'skipped'>}
 */
export async function startMandatoryUpdateFlow(deps = {}) {
  const platform = deps.platform ?? getMandatoryUpdatePlatform();
  if (!platform) return 'skipped';

  if (platform === 'android') {
    const start = deps.startMandatoryUpdate;
    if (!start) return 'skipped';
    await start();
    return 'play_started';
  }

  // iOS: user taps "Update Now" on the blocking screen (App Store link).
  return 'ios_store_only';
}

/**
 * Map native plugin events to orchestration phase transitions.
 * @param {string} eventName
 * @param {MandatoryUpdatePhase} currentPhase
 * @returns {MandatoryUpdatePhase}
 */
export function nextPhaseFromNativeEvent(eventName, currentPhase) {
  switch (eventName) {
    case 'updateAvailable':
      return 'play_flow';
    case 'updateNotAvailable':
      return 'play_unavailable';
    case 'updateInstalled':
      return 'installed';
    case 'updateFailed':
      return currentPhase === 'play_flow' ? 'play_unavailable' : currentPhase;
    case 'updateCanceled':
      return 'play_flow';
    default:
      return currentPhase;
  }
}
