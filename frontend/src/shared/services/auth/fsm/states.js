/**
 * shared/services/auth/fsm/states.js
 * ---------------------------------------------------------------------------
 * Core machine state constants. Mirrors the §2.1 hierarchy in the Phase 3c
 * design document (flattened for the hand-rolled reducer).
 * ---------------------------------------------------------------------------
 */

export const S = Object.freeze({
  IDLE: "idle",
  BOOTING: "booting",
  UNAUTHENTICATED: "unauthenticated",
  SIGNING_IN: "signingIn",
  CHECKING_USER_STATUS: "checkingUserStatus",
  CHECKING_SETUP_STATUS: "checkingSetupStatus",
  OTP_PENDING: "otpPending",
  SETUP_WIZARD_REQUIRED: "setupWizardRequired",
  DEMO_BOOTSTRAPPING: "demoBootstrapping",
  CHECKING_PROFILE: "checkingProfile",
  CHECKING_PROFILE_PICTURE: "checkingProfilePicture",
  PROFILE_GATE_REQUIRED: "profileGateRequired",
  PROFILE_PICTURE_GATE_REQUIRED: "profilePictureGateRequired",
  READY: "ready",
  DEGRADED_READY: "degradedReady",
  BLOCKED_INACTIVE: "blockedInactive",
  BLOCKED_USER_NOT_FOUND: "blockedUserNotFound",
  BLOCKED_ACCOUNT_DELETED: "blockedAccountDeleted",
  SIGNING_OUT: "signingOut",
  TERMINAL_LOGGED_OUT: "terminalLoggedOut",
});

export const READY_STATES = new Set([S.READY, S.DEGRADED_READY]);
export const BLOCKED_STATES = new Set([
  S.BLOCKED_INACTIVE,
  S.BLOCKED_USER_NOT_FOUND,
  S.BLOCKED_ACCOUNT_DELETED,
]);
export const GATE_STATES = new Set([
  S.OTP_PENDING,
  S.SETUP_WIZARD_REQUIRED,
  S.PROFILE_GATE_REQUIRED,
  S.PROFILE_PICTURE_GATE_REQUIRED,
]);
export const TRANSIENT_CHECK_STATES = new Set([
  S.CHECKING_USER_STATUS,
  S.CHECKING_SETUP_STATUS,
  S.CHECKING_PROFILE,
  S.CHECKING_PROFILE_PICTURE,
]);
