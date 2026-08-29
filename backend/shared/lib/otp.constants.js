/** Canonical OTP length for all auth, onboarding, upline, and testimonial flows. */
export const OTP_LENGTH = 4;

export const OTP_REGEX = /^\d{4}$/;

/** Returns a random numeric OTP string of exactly {@link OTP_LENGTH} digits. */
export function generateOtp() {
  const min = 10 ** (OTP_LENGTH - 1);
  const max = 10 ** OTP_LENGTH - 1;
  return String(Math.floor(min + Math.random() * (max - min + 1)));
}
