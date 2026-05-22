/**
 * shared/services/auth/demoSetup.js
 * ---------------------------------------------------------------------------
 * Demo-account silent coach-OTP setup. Extracted from App.js's inline
 * `silentlyCompleteDemoSetup` so the React layer can call a single, testable
 * orchestration helper.
 *
 * Behaviour preserved byte-for-byte:
 *   - DEMO_EMAIL constant identical to App.js value.
 *   - Same three sequential backend calls in the same order:
 *       1. GET  /api/users/search?q=Yasheer+J&email=…
 *       2. POST /api/upline/request          { coachId, email }
 *       3. POST /api/upline/validate-otp     { otp: '000000', email }
 *   - Same coach-name match: case-insensitive `.includes('yasheer')` on the
 *     userName, scanning `searchData.coaches`.
 *   - Same fixed OTP: '000000' (backend hashes server-side).
 *   - Same Session.markCoachOtpVerified() write on success.
 *   - Same fail-soft semantics: any throw is logged and `false` is returned;
 *     no exception propagates to the caller.
 *   - Same env-fallback for the API base URL: process.env.REACT_APP_API_BASE_URL
 *     OR 'http://localhost:3000'. Caller may override via the optional
 *     `apiBaseUrl` parameter (App.js currently passes nothing — preserved).
 * ---------------------------------------------------------------------------
 */

import * as Session from "../sessionStorage";
import { debugLog } from '../../utils/logger.js';

export const DEMO_EMAIL = "testereasywork@gmail.com";

/**
 * Run the demo-account silent setup.
 *
 * @param {string} userEmail — caller's email (case-insensitive match against DEMO_EMAIL)
 * @param {object} [opts]
 * @param {string} [opts.apiBaseUrl] — overrides env-fallback if provided
 * @returns {Promise<boolean>} — true when all three calls succeeded and the
 *   Session.markCoachOtpVerified() flag was written; false otherwise (no throw).
 */
export const silentlyCompleteDemoSetup = async (userEmail, opts = {}) => {
  if ((userEmail || "").toLowerCase().trim() !== DEMO_EMAIL) return false;

  const API_BASE =
    opts.apiBaseUrl ||
    process.env.REACT_APP_API_BASE_URL ||
    "http://localhost:3000";

  try {
    // 1. Search for Yasheer J
    const searchRes = await fetch(
      `${API_BASE}/api/users/search?q=Yasheer+J&email=${encodeURIComponent(
        userEmail,
      )}`,
    );
    const searchData = await searchRes.json();
    const yasheer = (searchData.coaches || []).find((c) =>
      c.userName.toLowerCase().includes("yasheer"),
    );
    if (!yasheer) {
      console.warn("[Demo] Yasheer J not found");
      return false;
    }

    // 2. Send upline request (backend auto-hashes OTP 000000)
    await fetch(`${API_BASE}/api/upline/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coachId: yasheer.userId, email: userEmail }),
    });

    // 3. Validate with fixed OTP 000000
    await fetch(`${API_BASE}/api/upline/validate-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ otp: "000000", email: userEmail }),
    });

    Session.markCoachOtpVerified();
    debugLog("✅ [Demo] Coach setup completed silently");
    return true;
  } catch (err) {
    console.error("[Demo] Silent setup failed:", err);
    return false;
  }
};
