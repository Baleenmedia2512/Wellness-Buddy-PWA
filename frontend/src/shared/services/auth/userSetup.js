/**
 * shared/services/auth/userSetup.js
 * ---------------------------------------------------------------------------
 * Pure HTTP helpers for the user-status (active / inactive / not-found)
 * lookup and the setup-status (skipped / complete / pending OTP / incomplete)
 * fetch. Extracted from App.js's `checkUserStatus` and the duplicate
 * setup-status fetch trees in the auth-state listener and the standalone
 * setup effect.
 *
 * Design rules (Phase 3b):
 *   - No React imports. No setState. Helpers return discriminated unions.
 *   - Behaviour preserved byte-for-byte:
 *       • POST /api/user/lookup with { email } for status lookup
 *       • GET  /api/user/status?email=… for setup status
 *       • Fail-open semantics: a network error from /lookup returns
 *         `{ result: 'active' }` so the caller continues exactly as today.
 *       • A network error from /status returns `{ result: 'error' }` so the
 *         caller can warn-and-continue exactly as today.
 *   - Concurrency control (the `statusCheckInProgress` ref and the
 *     `freshGoogleSignIn` short-circuit) lives in the React layer; this
 *     helper does the network call only.
 *   - iOS captive-portal Promise.race timeout (5 s) used by
 *     `handleOtpVerified` is a per-call-site decision and lives one layer up.
 * ---------------------------------------------------------------------------
 */

/**
 * POST /api/user/lookup → user-status discriminated union.
 *
 * @param {{ apiBaseUrl: string, email: string }} params
 * @returns {Promise<{
 *   result: 'active' | 'inactive' | 'userNotFound' | 'newUser',
 *   role?: string,
 * }>}
 *
 * Mapping rules (preserved from legacy `checkUserStatus`):
 *   - !data.success || data.userNotFound      → 'userNotFound'
 *   - data.isNewUser                          → 'newUser'  (carries role if present)
 *   - data.success && !data.isActive          → 'inactive'
 *   - data.success && data.isActive           → 'active'   (carries role if present)
 *   - HTTP non-OK or thrown error             → 'active'   (FAIL-OPEN)
 */
export async function fetchUserStatus({ apiBaseUrl, email }) {
  if (!email) return { result: "active" };

  try {
    const response = await fetch(`${apiBaseUrl}/api/user/lookup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      // Legacy threw and caught → fail-open. Preserve.
      return { result: "active" };
    }

    const data = await response.json();

    if (!data.success || data.userNotFound) {
      return { result: "userNotFound" };
    }
    if (data.isNewUser) {
      return { result: "newUser", role: data.role };
    }
    if (data.success && !data.isActive) {
      return { result: "inactive" };
    }
    return { result: "active", role: data.role };
  } catch (err) {
    // Fail-open: caller treats unknown network state as "let user in".
    return { result: "active", error: err };
  }
}

/**
 * GET /api/user/status → setup-status discriminated union.
 *
 * @param {{ apiBaseUrl: string, email: string }} params
 * @returns {Promise<{
 *   result: 'skipped' | 'complete' | 'pendingOtp' | 'incomplete' | 'error',
 *   raw?: object,
 *   error?: any,
 * }>}
 *
 * Mapping rules (preserved from legacy auth-state-listener tree):
 *   - statusData.setupSkipped===true                            → 'skipped'
 *   - statusData.setupComplete===false && statusData.pendingRequest → 'pendingOtp'
 *   - statusData.setupComplete===false                          → 'incomplete'
 *   - statusData.setupComplete===true                           → 'complete'
 *   - HTTP non-OK or thrown error                               → 'error'
 */
export async function fetchSetupStatus({ apiBaseUrl, email }) {
  if (!email) return { result: "error" };

  try {
    const statusResponse = await fetch(
      `${apiBaseUrl}/api/user/status?email=${encodeURIComponent(email)}`,
    );

    if (!statusResponse.ok) {
      return { result: "error" };
    }

    const statusData = await statusResponse.json();

    if (statusData.setupSkipped) {
      return { result: "skipped", raw: statusData };
    }
    if (!statusData.setupComplete) {
      if (statusData.pendingRequest) {
        return { result: "pendingOtp", raw: statusData };
      }
      return { result: "incomplete", raw: statusData };
    }
    return { result: "complete", raw: statusData };
  } catch (err) {
    return { result: "error", error: err };
  }
}
