/**
 * shared/services/auth/fsm/featureFlags.js
 * ---------------------------------------------------------------------------
 * Phase 3d-a: only two flags exist. driveCore / driveLifecycle do NOT exist
 * yet — they will be added in Phase 3d-b.
 *
 * Resolution order for `isShadowEnabled` (first match wins):
 *   1. Kill switch (always wins; forces shadow OFF when active).
 *   2. localStorage override `authFsm.shadow` ("true" | "false").
 *   3. process.env `REACT_APP_AUTH_FSM_SHADOW` ("true").
 *   4. STAGING auto-enable: when `isStagingEnvironment()` returns true,
 *      shadow is enabled by default. Production hosts are NEVER auto-enabled.
 *   5. Default OFF.
 *
 * Kill switch resolution:
 *   1. localStorage `authFsm.killSwitch` ("true" | "false").
 *   2. process.env `REACT_APP_AUTH_FSM_KILL_SWITCH` ("true").
 *   3. Default OFF (kill switch inactive).
 * ---------------------------------------------------------------------------
 */

function readLocalStorage(key) {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function readHostname() {
  try {
    if (typeof window === "undefined" || !window.location) return "";
    return String(window.location.hostname || "").toLowerCase();
  } catch {
    return "";
  }
}

/**
 * Returns true when the app is running in a non-production environment that
 * should automatically opt into shadow telemetry.
 *
 * Heuristics (any match → staging):
 *   - REACT_APP_ENV === "staging" | "development" | "preview"
 *   - REACT_APP_AUTH_FSM_SHADOW_STAGING === "true" (explicit opt-in)
 *   - NODE_ENV !== "production" (CRA dev server)
 *   - hostname is localhost / 127.0.0.1 / *.local
 *   - hostname contains "staging", "preview", "dev", "test", "qa"
 *   - hostname is a Vercel preview URL (*.vercel.app that is NOT the
 *     production alias — we treat all *.vercel.app as non-prod unless
 *     REACT_APP_PRODUCTION_HOSTS lists it).
 *
 * Production hosts (explicit allowlist override):
 *   When REACT_APP_PRODUCTION_HOSTS is set (comma-separated), any matching
 *   hostname is treated as production regardless of the heuristics above.
 */
export function isStagingEnvironment() {
  // Explicit production allowlist short-circuits everything.
  const prodList = (process.env.REACT_APP_PRODUCTION_HOSTS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const host = readHostname();
  if (host && prodList.includes(host)) return false;

  if (process.env.REACT_APP_AUTH_FSM_SHADOW_STAGING === "true") return true;

  const envName = (process.env.REACT_APP_ENV || "").toLowerCase();
  if (envName === "staging" || envName === "development" || envName === "preview") {
    return true;
  }

  if (process.env.NODE_ENV !== "production") return true;

  if (!host) return false;
  if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".local")) {
    return true;
  }
  if (
    host.includes("staging") ||
    host.includes("preview") ||
    host.includes("-dev") ||
    host.startsWith("dev.") ||
    host.includes(".test.") ||
    host.endsWith(".test") ||
    host.includes(".qa.")
  ) {
    return true;
  }
  // Vercel preview deployments end in `.vercel.app`. Production aliases
  // should be added to REACT_APP_PRODUCTION_HOSTS to opt out.
  if (host.endsWith(".vercel.app")) return true;

  return false;
}

export function isKillSwitchActive() {
  const ls = readLocalStorage("authFsm.killSwitch");
  if (ls === "true") return true;
  if (ls === "false") return false;
  return process.env.REACT_APP_AUTH_FSM_KILL_SWITCH === "true";
}

export function isShadowEnabled() {
  if (isKillSwitchActive()) return false;
  const ls = readLocalStorage("authFsm.shadow");
  if (ls === "true") return true;
  if (ls === "false") return false;
  if (process.env.REACT_APP_AUTH_FSM_SHADOW === "true") return true;
  // Phase 3d-a burn-in: auto-enable in non-production environments.
  if (isStagingEnvironment()) return true;
  return false;
}

/**
 * Convenience for tests / dev tools.
 */
export function getFlags() {
  return {
    killSwitch: isKillSwitchActive(),
    shadow: isShadowEnabled(),
    staging: isStagingEnvironment(),
    driveCore: false, // not implemented in 3d-a
    driveLifecycle: false, // not implemented in 3d-a
  };
}

