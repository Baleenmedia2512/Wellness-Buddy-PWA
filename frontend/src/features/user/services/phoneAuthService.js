// Phone-OTP authentication via Firebase + backend token exchange.
//
// Flow (web AND native, since the Firebase Web SDK works in both):
//   1. sendPhoneOtp(e164)         → triggers SMS, returns confirmationResult
//   2. confirmPhoneOtp(result, otp) → returns Firebase user + idToken
//   3. exchangeFirebaseIdToken(idToken) → POSTs to backend, returns our
//      session payload (same shape as /api/auth/verify-otp).
//
// The single LoginOtpEntry UI handles step 2 — for both email and phone.
//
// Auto-fill: input is `autoComplete="one-time-code"` (already set). Android's
// SMS Retriever API works when the SMS payload contains the app hash, which
// Firebase appends automatically once the Android SHA-256 fingerprint is
// registered in Firebase Console → Project Settings → Your apps.
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { auth } from '../../../shared/services/firebase.js';
import { getApiBaseUrl } from '../../../config/api.config.js';
import { debugLog } from '../../../shared/utils/logger.js';

const RECAPTCHA_CONTAINER_ID = 'firebase-recaptcha-container';

let recaptchaVerifier = null;

function ensureRecaptchaContainer() {
  // The verifier needs a real DOM node. Create an invisible one on demand;
  // re-used across send attempts.
  let el = document.getElementById(RECAPTCHA_CONTAINER_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = RECAPTCHA_CONTAINER_ID;
    el.style.position = 'fixed';
    el.style.bottom = '0';
    el.style.right = '0';
    el.style.zIndex = '-1';
    document.body.appendChild(el);
  }
  return el;
}

function getRecaptchaVerifier() {
  if (recaptchaVerifier) return recaptchaVerifier;
  ensureRecaptchaContainer();
  recaptchaVerifier = new RecaptchaVerifier(auth, RECAPTCHA_CONTAINER_ID, {
    size: 'invisible',
    callback: () => debugLog('🔒 reCAPTCHA solved'),
    'expired-callback': () => {
      debugLog('⚠️ reCAPTCHA expired — will rebuild on next send');
      try { recaptchaVerifier.clear(); } catch { /* no-op */ }
      recaptchaVerifier = null;
    },
  });
  return recaptchaVerifier;
}

/**
 * Trigger an SMS OTP to the given E.164 phone number.
 * Returns the Firebase `confirmationResult` which the OTP-entry UI must keep
 * to call `confirmPhoneOtp` later.
 */
export async function sendPhoneOtp(e164) {
  const verifier = getRecaptchaVerifier();
  debugLog('📱 sendPhoneOtp →', e164);
  try {
    return await signInWithPhoneNumber(auth, e164, verifier);
  } catch (err) {
    debugLog('❌ sendPhoneOtp failed', {
      code: err?.code,
      message: err?.message,
      serverResponse: err?.customData?._tokenResponse || err?.customData,
    });
    // Force a fresh reCAPTCHA on the next attempt — stale tokens cause repeat 400s.
    resetPhoneAuth();
    throw err;
  }
}

/**
 * Verify the SMS OTP the user typed. Returns { user, idToken } on success.
 * Throws the underlying Firebase error on failure (caller should map
 * 'auth/invalid-verification-code' → "Invalid OTP").
 */
export async function confirmPhoneOtp(confirmationResult, otp) {
  const userCred = await confirmationResult.confirm(otp);
  const idToken = await userCred.user.getIdToken(/* forceRefresh */ true);
  return { user: userCred.user, idToken };
}

/**
 * Exchange a verified Firebase ID token for our app session. Returns the
 * parsed JSON body — same shape as /api/auth/verify-otp.
 */
export async function exchangeFirebaseIdToken(idToken, name) {
  const res = await fetch(`${getApiBaseUrl()}/api/auth/firebase-phone-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken, name }),
  });
  return res.json();
}

/**
 * Reset the verifier — call on screen unmount or after a failed flow so the
 * next attempt starts with a fresh reCAPTCHA widget.
 */
export function resetPhoneAuth() {
  if (recaptchaVerifier) {
    try { recaptchaVerifier.clear(); } catch { /* no-op */ }
    recaptchaVerifier = null;
  }
}
