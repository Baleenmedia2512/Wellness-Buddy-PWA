/**
 * shared/services/auth/userProfile.js
 * ---------------------------------------------------------------------------
 * Pure HTTP/orchestration helpers for the user-profile completeness gate
 * and the profile-picture gate. Extracted from App.js's `checkProfileCompletion`
 * and `checkProfilePicture` so the React layer can stay UI-only.
 *
 * Design rules (Phase 3b):
 *   - No React imports. No setState. Helpers return structured results.
 *   - Uses shared getProfile() cache + in-flight dedup so Home boot does not
 *     storm /api/user/profile (Header, nutrition hooks, and these gates share
 *     one network call within the TTL).
 *   - afterSave still force-busts the cache and retries with 450 ms gaps.
 *   - same fail-open semantics (network errors do NOT throw to the caller)
 *   - same Session-cache writes for the per-email "complete" / "uploaded"
 *     flags (these are deterministic on the HTTP response and live in
 *     this layer to avoid scattering cache logic across App.js)
 *   - iOS-specific timing protections (no AbortController, no captive-portal
 *     timeouts) intentionally NOT added in this phase. The 5 s race used by
 *     `handleOtpVerified` lives one layer up and is unaffected.
 * ---------------------------------------------------------------------------
 */

import * as Session from "../sessionStorage";
import { getProfile } from "../../../features/user/services/user.api.js";
import { isOnboardingIdentityComplete } from "../../../features/user/domain/profileCompleteness";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetch profile-completion status. Mirrors the legacy
 * `checkProfileCompletion` retry loop from App.js.
 *
 * @param {object} params
 * @param {string} params.apiBaseUrl — retained for call-site compatibility
 * @param {string} params.email
 * @param {boolean} [params.afterSave=false] — when true, retries up to 3×
 *   with 450 ms gaps (data can be briefly stale right after a profile save).
 * @returns {Promise<{
 *   status: 'complete' | 'incomplete' | 'error',
 *   identityComplete?: boolean,
 *   data?: object | null,
 *   snooze?: object | null,
 *   missingFields?: object,
 *   error?: any,
 * }>}
 */
export async function fetchProfileCompletion({ apiBaseUrl, email, userId, afterSave = false }) {
  if (!email && (userId == null || userId === '')) {
    return { status: "error", data: null, identityComplete: false };
  }
  void apiBaseUrl; // getProfile uses config base URL

  const maxAttempts = afterSave ? 3 : 1;
  let latestData = null;

  const identityFrom = (data) => {
    if (data?.needsName === true) return false;
    if (data?.needsName === false) return true;
    return isOnboardingIdentityComplete({
      userName: data?.userName,
      email: data?.email || email,
      phoneNumber: data?.phoneNumber,
    });
  };

  try {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const payload = await getProfile(
        email
          ? { email, cacheBust: afterSave || attempt > 0 }
          : { userId, cacheBust: afterSave || attempt > 0 },
      );
      if (!payload?.success || !payload?.data) {
        if (attempt < maxAttempts - 1) await sleep(450);
        continue;
      }
      latestData = payload.data;

      if (latestData.profileComplete) {
        // Cache the per-email fast-path flag so subsequent boots can skip
        // the gate before the network responds.
        if (email) Session.markProfileComplete(email);
        return {
          status: "complete",
          identityComplete: true,
          data: latestData,
          snooze: latestData.profilePicSnooze || null,
        };
      }

      if (attempt < maxAttempts - 1) {
        await sleep(450);
      }
    }

    return {
      status: "incomplete",
      identityComplete: identityFrom(latestData),
      data: latestData,
      snooze: latestData?.profilePicSnooze || null,
      missingFields: {
        userName: latestData?.userName ?? null,
        email: latestData?.email ?? null,
        height: latestData?.height ?? null,
        dietType: latestData?.dietType ?? null,
        gender: latestData?.gender ?? latestData?.bodyMetrics?.gender ?? null,
        profileImage: latestData?.profileImage ?? null,
      },
    };
  } catch (err) {
    // Fail-open: caller handles spinner/state cleanup. No throw.
    return {
      status: "error",
      identityComplete: identityFrom(latestData),
      data: latestData,
      error: err,
    };
  }
}

/**
 * Fetch profile-picture status. Mirrors the legacy `checkProfilePicture`
 * branching from App.js.
 *
 * @param {object} params
 * @param {string} params.apiBaseUrl — retained for call-site compatibility
 * @param {string} params.email
 * @returns {Promise<{
 *   status: 'valid' | 'snoozed' | 'missing' | 'error',
 *   source?: 'custom' | 'google',
 *   snooze?: object | null,
 *   profileImage?: string | null,
 *   error?: any,
 * }>}
 *
 * Side effects on success:
 *   - Writes `Session.markProfilePictureUploaded(email)` when a valid image
 *     is detected (custom data-URL OR https URL).
 *   - Writes `Session.clearProfilePictureUploaded(email)` when the gate
 *     should be shown (no valid image, no active snooze).
 */
export async function fetchProfilePicture({ apiBaseUrl, email }) {
  if (!email) return { status: "error" };
  void apiBaseUrl;

  try {
    // Shares in-flight / TTL cache with fetchProfileCompletion + Header.
    const payload = await getProfile(email);
    if (!payload?.success || !payload?.data) return { status: "error" };

    const profile = payload.data;

    if (profile.profileImage) {
      if (profile.profileImage.startsWith("data:image/")) {
        Session.markProfilePictureUploaded(email);
        return {
          status: "valid",
          source: "custom",
          profileImage: profile.profileImage,
        };
      }
      if (profile.profileImage.startsWith("https://")) {
        Session.markProfilePictureUploaded(email);
        return {
          status: "valid",
          source: "google",
          profileImage: profile.profileImage,
        };
      }
    }

    // No valid picture — check DB-side snooze before deciding to show gate.
    const snooze = profile.profilePicSnooze;
    if (snooze) {
      const snoozeUntil = new Date(snooze.until).getTime();
      const snoozeCount = snooze.count ?? 0;
      const snoozeMax = snooze.max ?? 5;
      if (
        snoozeCount > 0 &&
        snoozeCount < snoozeMax &&
        Date.now() < snoozeUntil
      ) {
        return { status: "snoozed", snooze };
      }
    }

    // Show gate: clear cache flag in case it was set incorrectly.
    Session.clearProfilePictureUploaded(email);
    return { status: "missing", snooze: snooze || null };
  } catch (err) {
    return { status: "error", error: err };
  }
}
