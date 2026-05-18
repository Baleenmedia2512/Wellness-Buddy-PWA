/**
 * shared/services/auth/fsm/index.js
 * ---------------------------------------------------------------------------
 * Public API for the shadow-mode auth FSM (Phase 3d-a).
 *
 * Usage from App.js:
 *
 *   import * as authFsm from "./shared/services/auth/fsm";
 *
 *   // Once at mount:
 *   authFsm.startShadow({ apiBaseUrl, platform, getLegacySnapshot });
 *
 *   // After each interesting auth-related event:
 *   authFsm.send({ type: authFsm.E.AUTH_CHANGED, user });
 *
 * Behaviour:
 *   - If kill switch is active OR shadow flag is off, `startShadow` returns
 *     null and `send` is a no-op. Zero overhead.
 *   - When active, `send` advances the FSM and (if `getLegacySnapshot` was
 *     provided) compares legacy-vs-FSM state and records drift.
 *   - The FSM never mutates React state, never triggers fetches, never
 *     interferes with App.js behaviour.
 * ---------------------------------------------------------------------------
 */

import { createRuntime } from "./runtime";
import { isShadowEnabled, isKillSwitchActive, getFlags } from "./featureFlags";
import { compareDrift } from "./shadowBridge";
import { exposeOnWindow } from "./devUtils";
import { E } from "./events";

let runtime = null;
let getLegacySnapshot = null;
let started = false;

/**
 * Start the shadow FSM. Idempotent (subsequent calls return the same runtime).
 * Returns null when shadow mode is disabled.
 */
export function startShadow({ apiBaseUrl, platform, getLegacySnapshot: gls } = {}) {
  if (started) return runtime;
  if (isKillSwitchActive()) return null;
  if (!isShadowEnabled()) return null;
  runtime = createRuntime();
  getLegacySnapshot = typeof gls === "function" ? gls : null;
  exposeOnWindow(runtime);
  runtime.send({ type: E.BOOT, apiBaseUrl, platform });
  started = true;
  // eslint-disable-next-line no-console // FSM / lifecycle code — must reach crash reporters before logger is ready // FSM/lifecycle code must reach crash reporters before logger is ready
  console.info("[AuthFSM] shadow mode started", getFlags());
  return runtime;
}

/**
 * Send an event into the FSM. Safe to call before `startShadow` (no-op).
 * Never throws.
 */
export function send(event) {
  if (!runtime) return;
  try {
    runtime.send(event);
    if (getLegacySnapshot) {
      const legacy = getLegacySnapshot();
      compareDrift(legacy, runtime.getSnapshot(), { eventType: event && event.type });
    }
  } catch (err) {
    // eslint-disable-next-line no-console // FSM / lifecycle code — must reach crash reporters before logger is ready // FSM/lifecycle code must reach crash reporters before logger is ready
    console.error("[AuthFSM] send error", err);
  }
}

export function getSnapshot() {
  return runtime ? runtime.getSnapshot() : null;
}

export function isRunning() {
  return !!runtime;
}

export function stop() {
  if (runtime) {
    runtime.dispose();
    runtime = null;
    started = false;
  }
}

export { E } from "./events";
export { S } from "./states";
export {
  getTimeline,
  printTimeline,
  summarize,
  getAggregates,
  exportSession,
} from "./devUtils";
export {
  getFlags,
  isShadowEnabled,
  isKillSwitchActive,
  isStagingEnvironment,
} from "./featureFlags";
