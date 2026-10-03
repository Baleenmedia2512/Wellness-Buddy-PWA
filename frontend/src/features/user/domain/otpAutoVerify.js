/**
 * Guards login OTP auto-verify so a failed code is not re-submitted when
 * loading flips false (useEffect would otherwise retry the same digits).
 *
 * Clearing lastTried when the code is incomplete lets the user edit a digit
 * (or delete and retype the same last digit) and verify again.
 */

export function shouldSubmitOtp({ isComplete, verified, loading, value, lastTried }) {
  if (!isComplete || verified || loading) return false;
  const code = String(value || '');
  if (!code) return false;
  return code !== lastTried;
}

export function nextOtpLastTried({ isComplete, value, lastTried, didSubmit }) {
  if (!isComplete) return '';
  if (didSubmit) return String(value || '');
  return lastTried;
}
