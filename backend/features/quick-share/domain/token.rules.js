/**
 * backend/features/quick-share/domain/token.rules.js
 * ---------------------------------------------------------------------------
 * Pure rules for the public-share token and its expiry. No I/O.
 * ---------------------------------------------------------------------------
 */
import { randomUUID } from 'node:crypto';

/** 30 days, in milliseconds. */
export const DEFAULT_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Generates an RFC-4122 v4 UUID. Wrapped so tests can mock it without
 * touching node:crypto globally.
 * @returns {string}
 */
export function generateToken() {
  return randomUUID();
}

/**
 * Returns an ISO timestamp for `expiryMs` after `nowMs`.
 * @param {number} [nowMs]   defaults to Date.now()
 * @param {number} [expiryMs] defaults to 30 days
 * @returns {string}
 */
export function computeExpiry(nowMs = Date.now(), expiryMs = DEFAULT_EXPIRY_MS) {
  return new Date(nowMs + expiryMs).toISOString();
}

/**
 * True if `expiresAt` is in the past relative to `nowMs`.
 * Treats null/undefined/invalid expiry as "expired" — fail-closed.
 * @param {string|Date|null|undefined} expiresAt
 * @param {number} [nowMs]
 * @returns {boolean}
 */
export function isExpired(expiresAt, nowMs = Date.now()) {
  if (expiresAt == null) return true;
  const ts = expiresAt instanceof Date ? expiresAt.getTime() : Date.parse(String(expiresAt));
  if (Number.isNaN(ts)) return true;
  return ts <= nowMs;
}
