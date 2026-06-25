/**
 * shared/utils/logger.js
 * ---------------------------------------------------------------------------
 * Lightweight gated logger for high-frequency / low-value debug output.
 *
 * Why this exists:
 *   - App.js had 219 console.* calls. On iOS WKWebView, console.log with
 *     object args can hold references and prevent GC, hurting memory on
 *     long sessions.
 *   - Production users do not benefit from these logs.
 *   - Errors and warnings should still surface via console.warn / .error
 *     so Crashlytics-style aggregators capture them.
 *
 * Usage:
 *   import { debugLog } from "shared/utils/logger";
 *   debugLog("[Foreground] App resumed", { user: user?.id });
 *
 * Behavior:
 *   - In production builds (NODE_ENV === "production") debugLog is a no-op.
 *   - In development it forwards to console.log.
 *   - Use console.warn / console.error directly for things you always want
 *     to see — DO NOT route those through this helper.
 * ---------------------------------------------------------------------------
 */

const IS_DEV =
  typeof process !== "undefined" &&
  process.env &&
  process.env.NODE_ENV !== "production";

export const debugLog = IS_DEV
  ? (...args) => console.log(...args)
  : () => {};

export const debugInfo = IS_DEV
  ? (...args) => console.info(...args)
  : () => {};
