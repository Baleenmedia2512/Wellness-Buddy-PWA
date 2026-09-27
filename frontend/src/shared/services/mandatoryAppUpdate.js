/**
 * Mandatory app update orchestration.
 *
 * Server policy (/api/app/version-policy) is the single authority for
 * mandatory updates (update_required → blocking flow via this module).
 * update_recommended is ignored on the client — no optional update UI.
 *
 * Platform behaviour when blocked:
 *   - Android: Google Play IMMEDIATE in-app update via InAppUpdatePlugin
 *   - iOS: blocking screen + App Store deep link (no native in-app update API)
 */
import { Capacitor } from '@capacitor/core';
import { getClientPlatform } from './appVersionPolicy.api.js';

/** @typedef {'idle'|'starting'|'play_flow'|'play_unavailable'|'awaiting_retry'|'installed'|'ios_store_only'} MandatoryUpdatePhase */

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
 * Whether returning to foreground should auto-start Play IMMEDIATE again.
 * After cancel/fail we wait for an explicit "Update Now" tap to avoid loops.
 *
 * @param {{
 *   status?: string,
 *   phase?: MandatoryUpdatePhase,
 * }} input
 * @returns {boolean}
 */
export function shouldAutoStartPlayOnForeground({ status, phase } = {}) {
  if (status !== 'update_required') return false;
  if (
    phase === 'awaiting_retry'
    || phase === 'play_unavailable'
    || phase === 'play_flow'
    || phase === 'starting'
    || phase === 'installed'
  ) {
    return false;
  }
  return true;
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
      return 'play_unavailable';
    case 'updateCanceled':
      // Stay hard-blocked in UI; do not keep Play open in a loop.
      return 'awaiting_retry';
    default:
      return currentPhase;
  }
}
