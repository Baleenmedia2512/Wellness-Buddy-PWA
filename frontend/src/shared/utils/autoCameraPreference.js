/**
 * Auto Camera on app-resume preference.
 *
 * Default: OFF for new and existing users.
 * One-time migration (`wv.autoCameraDefaultOff.v1`) resets any prior ON
 * default so all existing installs start on Manual until the user opts in.
 */
import storage from '../lib/storage';

const PREF_KEY = 'wv.autoCameraOnResume';
const MIGRATION_KEY = 'wv.autoCameraDefaultOff.v1';

/** Force default OFF once per install (covers all existing users). */
export function ensureAutoCameraDefaultOff() {
  if (storage.get(MIGRATION_KEY) === '1') return;
  storage.set(PREF_KEY, 'false');
  storage.set(MIGRATION_KEY, '1');
}

/** @returns {boolean} */
export function isAutoCameraOnResumeEnabled() {
  ensureAutoCameraDefaultOff();
  return storage.get(PREF_KEY) === 'true';
}

/** @param {boolean} enabled */
export function setAutoCameraOnResumeEnabled(enabled) {
  ensureAutoCameraDefaultOff();
  storage.set(PREF_KEY, enabled ? 'true' : 'false');
}
