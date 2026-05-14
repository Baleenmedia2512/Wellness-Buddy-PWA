/**
 * shared/services/auth/fsm/shadowBridge.js
 * ---------------------------------------------------------------------------
 * Compares legacy App.js auth state against the shadow FSM's derived state
 * after each event, and records drift via telemetry.
 *
 * Legacy snapshot shape (passed in from App.js):
 *   {
 *     user: boolean,                     // !!user
 *     isUserActive: boolean,
 *     showInactiveModal: boolean,
 *     showUserNotFoundModal: boolean,
 *     showSetupWizard: boolean,
 *     showValidateOTP: boolean,
 *     showCompleteProfile: boolean,
 *     showMandatoryProfilePictureModal: boolean,
 *     forceLoggedOut: boolean,
 *     signOutInProgress: boolean,
 *     accountDeleted: boolean,
 *     signedOut: boolean,
 *   }
 *
 * Drift policy:
 *   - Some transient FSM states (CHECKING_*) match a steady legacy "ready"
 *     because legacy doesn't have intermediate states. We treat the family
 *     of "approaching ready" states as compatible with legacy ready.
 *   - First N events after start are silenced (boot warm-up).
 * ---------------------------------------------------------------------------
 */

import { S } from "./states";
import { recordDrift } from "./telemetry";

const APPROACHING_READY = new Set([
  S.CHECKING_USER_STATUS,
  S.CHECKING_SETUP_STATUS,
  S.CHECKING_PROFILE,
  S.CHECKING_PROFILE_PICTURE,
  S.READY,
  S.DEGRADED_READY,
]);

/**
 * Map a legacy snapshot to the FSM core state it most likely corresponds to.
 * Returns null when no confident mapping is possible (caller should skip).
 */
export function expectedFromLegacy(legacy) {
  if (!legacy) return null;
  if (legacy.accountDeleted) return S.BLOCKED_ACCOUNT_DELETED;
  if (legacy.forceLoggedOut || legacy.signedOut) return S.TERMINAL_LOGGED_OUT;
  if (legacy.signOutInProgress) return S.SIGNING_OUT;
  if (legacy.showInactiveModal) return S.BLOCKED_INACTIVE;
  if (legacy.showUserNotFoundModal) return S.BLOCKED_USER_NOT_FOUND;
  if (legacy.showValidateOTP) return S.OTP_PENDING;
  if (legacy.showSetupWizard) return S.SETUP_WIZARD_REQUIRED;
  if (legacy.showCompleteProfile) return S.PROFILE_GATE_REQUIRED;
  if (legacy.showMandatoryProfilePictureModal) {
    return S.PROFILE_PICTURE_GATE_REQUIRED;
  }
  if (legacy.user && legacy.isUserActive) return S.READY;
  if (!legacy.user) return S.UNAUTHENTICATED;
  return null;
}

/**
 * @returns {object|null} drift descriptor, or null when no drift.
 */
export function compareDrift(legacy, fsmState, opts = {}) {
  if (!fsmState) return null;
  const expected = expectedFromLegacy(legacy);
  if (!expected) return null;
  const actual = fsmState.core;
  if (expected === actual) return null;
  // "approaching ready" family — legacy collapses these into one ready state.
  if (expected === S.READY && APPROACHING_READY.has(actual)) return null;
  if (actual === S.READY && APPROACHING_READY.has(expected)) return null;

  const diff = {
    expected,
    actual,
    legacy: { ...legacy },
    epoch: fsmState.ctx?.epoch,
    eventType: opts.eventType || null,
    ts: Date.now(),
  };
  recordDrift(diff);
  return diff;
}
