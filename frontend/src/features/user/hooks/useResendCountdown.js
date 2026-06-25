// Resend countdown timer — counts from `seconds` down to 0, then enables resend.
import { useEffect, useState } from 'react';

export default function useResendCountdown(seconds = 60, active = false) {
  const [countdown, setCountdown] = useState(seconds);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    if (!active) return undefined;
    if (countdown <= 0) { setCanResend(true); return undefined; }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [active, countdown]);

  const start = (s = seconds) => {
    setCountdown(s);
    setCanResend(s === 0);
  };

  return { countdown, canResend, start };
}
