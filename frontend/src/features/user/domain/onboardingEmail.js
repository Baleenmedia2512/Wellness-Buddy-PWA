/**
 * Client copy/rules for onboarding email OTP (mirrors backend onboardingEmail.rules).
 */
export const ONBOARDING_EMAIL_OTP_SECONDS = 5 * 60;
export const EMAIL_TAKEN_ADOPT_MESSAGE =
  'This email already has an account. Do you want to use it?';

export function looksLikeEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

export function formatOtpCountdown(totalSeconds) {
  const sec = Math.max(0, Number(totalSeconds) || 0);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
