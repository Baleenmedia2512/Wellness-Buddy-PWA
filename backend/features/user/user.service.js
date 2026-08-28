/**
 * user.service.js — Backward-compat barrel.
 *
 * The user feature service was split into focused modules. This file
 * re-exports the public surface so existing API route imports keep working
 * unchanged. New code should import directly from the specific module.
 */
export { getProfile, updateProfile, snoozeProfilePic, deleteAccount } from './profile.service.js';
export { saveGoogleUser } from './google-auth.service.js';
export { lookupUser } from './lookup.service.js';
export { verifyUserSession } from './verify-session.service.js';
export { skipSetup } from './setup.service.js';
export { getStatus } from './status.service.js';
export { getContext } from './context.service.js';
export { syncUserTimezoneIfChanged } from './timezone-sync.service.js';
export {
  recordConsent,
  getConsentStatus,
  discardUnconsentedUser,
} from './consent.service.js';
export { checkOnboardingEmail, verifyOnboardingEmail } from './onboarding-email.service.js';
