/**
 * frontend/src/features/quick-share/domain/entry-route.rules.js
 * ---------------------------------------------------------------------------
 * PURE client-side rules governing when the camera-first flow should activate.
 *
 * Per claude.md §3.1 — no I/O, no axios, no localStorage.
 * All external state is injected as parameters.
 * ---------------------------------------------------------------------------
 */

/** Roles eligible for camera-first launch. Members only. */
const ELIGIBLE_ROLES = new Set(['member', 'user']);

/**
 * Returns true when the device camera should be shown as the first screen.
 *
 * Rules:
 *   1. Feature flag ff.quick-share.camera-first must be ON.
 *   2. User role must be 'member' (coaches/admins keep their normal Home).
 *   3. appState must be 'cold-start' or 'resume-from-lock' (not in-app nav).
 *
 * @param {{
 *   cameraFirstEnabled: boolean,
 *   userRole: string,
 *   appState: 'cold-start'|'resume-from-lock'|'in-app'|'unknown',
 * }} opts
 * @returns {boolean}
 */
export function shouldShowCamera({ cameraFirstEnabled, userRole, appState }) {
  if (!cameraFirstEnabled) return false;
  if (!isEligibleRole(userRole)) return false;
  return appState === 'cold-start' || appState === 'resume-from-lock';
}

/**
 * Returns true when the user's role is eligible for camera-first launch.
 * @param {string} role
 * @returns {boolean}
 */
export function isEligibleRole(role) {
  return ELIGIBLE_ROLES.has(String(role).toLowerCase());
}

/**
 * Determine the AppState value from a Capacitor `appStateChange` event.
 *
 * Capacitor fires { isActive: true } when the app comes to foreground.
 * We distinguish a true resume-from-lock from an in-app navigation by checking
 * whether the app was backgrounded for > LOCK_THRESHOLD_MS.
 *
 * @param {{
 *   isActive: boolean,
 *   wasInBackground: boolean,
 *   backgroundedForMs: number,
 * }} capacitorEvent
 * @returns {'resume-from-lock'|'in-app'|'background'}
 */
const LOCK_THRESHOLD_MS = 2000; // 2 s — shorter gaps are in-app transitions

export function resolveAppStateFromEvent({ isActive, wasInBackground, backgroundedForMs }) {
  if (!isActive) return 'background';
  if (wasInBackground && backgroundedForMs > LOCK_THRESHOLD_MS) return 'resume-from-lock';
  return 'in-app';
}
