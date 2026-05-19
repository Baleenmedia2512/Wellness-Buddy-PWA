/**
 * token.rules.js — pure domain rules for quick-share token generation.
 * No I/O. No imports of pg, axios, fetch, or process.env.
 */

/** Length in characters of the URL-safe token (base-62, ~36 bits of entropy). */
const TOKEN_LENGTH = 10;

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/**
 * Generate a URL-safe random token of TOKEN_LENGTH characters.
 * Uses Math.random — sufficient for non-security share tokens.
 * @returns {string}
 */
export function generateShareToken() {
  let token = '';
  for (let i = 0; i < TOKEN_LENGTH; i++) {
    token += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return token;
}

/** Number of hours a share link remains valid. */
export const SHARE_LINK_TTL_HOURS = 24;

/**
 * Compute share expiry timestamp from a reference date.
 * @param {Date} [now=new Date()] — injectable for testing
 * @returns {Date}
 */
export function computeShareExpiry(now = new Date()) {
  return new Date(now.getTime() + SHARE_LINK_TTL_HOURS * 60 * 60 * 1000);
}

/**
 * Build the public view URL for a given token.
 * @param {string} baseUrl — from process.env.NEXT_PUBLIC_APP_URL or similar; injected by caller
 * @param {string} token
 * @returns {string}
 */
export function buildPublicUrl(baseUrl, token) {
  return `${baseUrl}/s/${token}`;
}
