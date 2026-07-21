/**
 * shared/services/sessionStorage.js
 * ---------------------------------------------------------------------------
 * Centralized accessors for App.js's user-session persistence keys.
 *
 * IMPORTANT: Despite the filename, this wraps `window.localStorage`, NOT
 * `window.sessionStorage`. The values must survive app relaunch on iOS /
 * Android, which is what localStorage provides. The filename refers to the
 * domain concept ("session state of the user / app") — not the Web Storage
 * API name.
 *
 * Purpose:
 *   - Single source of truth for the 8 session keys owned by App.js.
 *   - Documents what each key means and who reads/writes it.
 *   - Guards every access in try/catch so SSR, private-mode Safari, and
 *     storage-quota-exceeded errors cannot crash the app.
 *
 * Hygiene-phase rules:
 *   - Keys MUST stay byte-identical to the legacy strings — they exist on
 *     real users' devices and are read by other modules and native code.
 *   - Behavior MUST stay byte-identical: reads still return strings,
 *     writes still happen synchronously, "true"/"false" semantics preserved.
 *   - Do NOT add caching, batching, or async wrappers in this phase.
 * ---------------------------------------------------------------------------
 */

const safeGet = (key) => {
  try {
    return typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
  } catch {
    return null;
  }
};

const safeSet = (key, value) => {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(key, value);
  } catch {
    /* private-mode Safari, quota exceeded — silently ignore (legacy behavior) */
  }
};

const safeRemove = (key) => {
  try {
    if (typeof window !== "undefined") window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
};

// ─── currentPage ───────────────────────────────────────────────────────────
// Active top-level view tag. Restored on cold start so the user lands on the
// last sub-page they visited (Dashboard / Discipline / Activity / etc).
// Known values: "main" | "dashboard" | "nutrition-dashboard" |
//   "weight-tracking" | "weight-insights" |
//   "activity-time-report" | "step-counter"
// Read by:  App.js (cold-start restore + back-button handler)
// Written by: showDashboardPage, showMainPage, sign-in/out handlers, JSX taps
export const getCurrentPage = () => safeGet("currentPage");
export const setCurrentPage = (page) => safeSet("currentPage", page);
export const clearCurrentPage = () => safeRemove("currentPage");

// ─── setupSkipped ──────────────────────────────────────────────────────────
// "true" when user dismissed the setup wizard. Mirrored to DB by /api/user/status.
// Local copy lets us bypass the wizard before the API responds (faster cold start).
export const isSetupSkipped = () => safeGet("setupSkipped") === "true";
export const markSetupSkipped = () => safeSet("setupSkipped", "true");

// ─── coachOtpVerified ──────────────────────────────────────────────────────
// "true" once the coach-upline OTP modal completed in this install.
// Suppresses re-prompting on subsequent setup-status checks within the session.
export const isCoachOtpVerified = () => safeGet("coachOtpVerified") === "true";
export const markCoachOtpVerified = () => safeSet("coachOtpVerified", "true");

// ─── userSignedOut ─────────────────────────────────────────────────────────
// CRITICAL iOS GATE — DO NOT REMOVE.
// "true" while the user has explicitly signed out. Blocks Firebase from
// auto-restoring the session from iOS Keychain on next launch.
// MUST be read SYNCHRONOUSLY at App.js component init (before Firebase auth
// state subscription fires). Moving this into a useEffect or async hook will
// reintroduce the iOS auto-relogin regression.
export const isUserSignedOut = () => safeGet("userSignedOut") === "true";
export const markUserSignedOut = () => safeSet("userSignedOut", "true");
export const clearUserSignedOut = () => safeRemove("userSignedOut");

// ─── isOtpVerified ─────────────────────────────────────────────────────────
// "true" while user authenticated via OTP path (non-Google). Used to gate
// OTP-user restore on cold start.
export const isOtpVerified = () => safeGet("isOtpVerified") === "true";
export const markOtpVerified = () => safeSet("isOtpVerified", "true");
export const clearOtpVerified = () => safeRemove("isOtpVerified");

// ─── otpUser ───────────────────────────────────────────────────────────────
// JSON-serialized user object for OTP-auth users. Restored on cold start
// when isOtpVerified() is true and React state hasn't hydrated yet.
export const getOtpUserRaw = () => safeGet("otpUser");
export const getOtpUser = () => {
  const raw = safeGet("otpUser");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};
export const setOtpUser = (user) => {
  try {
    safeSet("otpUser", JSON.stringify(user));
  } catch {
    /* circular ref — should never happen, ignore */
  }
};
export const clearOtpUser = () => safeRemove("otpUser");

// ─── dbUserId ──────────────────────────────────────────────────────────────
// Numeric Users.UserId resolved from email. Cached so feature components
// can avoid waiting on getUserId() on every render.
// Stored as string (localStorage only stores strings); callers should
// pass it directly to APIs as the string form.
export const getDbUserId = () => safeGet("dbUserId");
export const setDbUserId = (id) => safeSet("dbUserId", String(id));
export const clearDbUserId = () => safeRemove("dbUserId");

// ─── userEmail ─────────────────────────────────────────────────────────────
// Authenticated user's email. Used by APIs that key on email and as a
// fallback identifier when React `user` state hasn't loaded yet (e.g.,
// OTP cold-start, lazy route mounts before App.js auth effect runs).
export const getUserEmail = () => safeGet("userEmail");
export const setUserEmail = (email) => safeSet("userEmail", email);
export const clearUserEmail = () => safeRemove("userEmail");

// ─── accountDeleted ────────────────────────────────────────────────────────
// CRITICAL re-auth gate. "true" once the user has permanently deleted their
// account. Read by App.js auth-state listener to block Firebase silent re-auth
// after deletion. Written by features/user/services/authService.js
// (`purgeLocalAfterDelete`) BEFORE Firebase signOut so onAuthStateChanged
// cannot re-hydrate the deleted account.
//
// Cleared on every successful sign-in / OTP completion (intentional — a new
// sign-in on the same device legitimately re-onboards the user).
//
// Phase 3a note: key name preserved byte-identical because authService.js
// writes it as a raw key and the auth-listener guard reads it as a raw key
// today; both routes now go through this helper.
export const isAccountDeleted = () => safeGet("accountDeleted") === "true";
export const markAccountDeleted = () => safeSet("accountDeleted", "true");
export const clearAccountDeleted = () => safeRemove("accountDeleted");

// ─── profileComplete_v2_<email> ────────────────────────────────────────────
// Per-email "true" flag set after `checkProfileCompletion` confirms all
// mandatory profile fields are present. Used as a fast-path so the
// CompleteProfile gate does not flash on subsequent cold starts before the
// /api/user/profile fetch returns.
//
// Suffix MUST stay byte-identical (`profileComplete_v2_` + email) — there
// are flags on real users' devices.
//
// Owners (post Phase 3a): App.js boot init, checkProfileCompletion success
// branch, CompleteProfilePage onComplete handler, handleSignOut clear.
export const isProfileComplete = (email) => {
  if (!email) return false;
  return safeGet("profileComplete_v2_" + email) === "true";
};
export const markProfileComplete = (email) => {
  if (!email) return;
  safeSet("profileComplete_v2_" + email, "true");
};
export const clearProfileComplete = (email) => {
  if (!email) return;
  safeRemove("profileComplete_v2_" + email);
};

// ─── profilePictureUploaded_<email> ────────────────────────────────────────
// Per-email "true" flag set when a valid profile picture (custom upload OR
// Google photo URL) is detected by `checkProfilePicture`, AND when the
// MandatoryProfilePictureModal completes a successful upload.
//
// Suffix MUST stay byte-identical (`profilePictureUploaded_` + email).
// The flag is intentionally NOT cleared on sign-out today — preserving
// legacy behavior so users who already proved a valid picture do not get
// re-prompted on next sign-in. Do not add a sign-out clear without an
// explicit product decision.
export const isProfilePictureUploaded = (email) => {
  if (!email) return false;
  return safeGet("profilePictureUploaded_" + email) === "true";
};
export const markProfilePictureUploaded = (email) => {
  if (!email) return;
  safeSet("profilePictureUploaded_" + email, "true");
};
export const clearProfilePictureUploaded = (email) => {
  if (!email) return;
  safeRemove("profilePictureUploaded_" + email);
};

// ─── demo_meals ────────────────────────────────────────────────────────────
// JSON-serialized array of demo-account meal records. Demo accounts skip the
// real DB write and instead persist their meal history here so the dashboard
// has something to render. Key name preserved byte-identical
// (`demo_meals`) because both `shared/services/nutritionPersistence/
// demoMealStore.js` and `features/nutrition/{hooks,services}` read/write it
// directly today.
//
// Helpers expose the raw string so existing JSON.parse / JSON.stringify
// call sites do not change shape; this matches the `getOtpUserRaw` pattern
// already in this module.
//
// Cleared on sign-out (handleSignOut) — owner is App.js until Phase 3c
// extracts it into the auth state machine's `signingOut` exit action.
export const getDemoMealsRaw = () => safeGet("demo_meals");
export const setDemoMealsRaw = (json) => safeSet("demo_meals", json);
export const clearDemoMeals = () => safeRemove("demo_meals");
