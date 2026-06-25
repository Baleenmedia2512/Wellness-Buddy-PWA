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
export { skipSetup } from './setup.service.js';
export { getStatus } from './status.service.js';
export { getContext } from './context.service.js';
