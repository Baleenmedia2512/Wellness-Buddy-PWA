// 4-step delete-account state machine.
// Owns step + persistence flag; exposes step transitions only.
// OTP/text/delete logic lives in component callbacks (kept thin).
import { useEffect, useState } from 'react';

const PENDING_KEY = 'deleteAccountOtpPending';

export default function useDeleteAccountFlow({ isOpen, userEmail }) {
  const [step, setStep] = useState(1);
  const [restoredCountdown, setRestoredCountdown] = useState(60);

  // Restore pending OTP step across app close/reopen.
  useEffect(() => {
    if (!isOpen) return;
    try {
      const saved = localStorage.getItem(PENDING_KEY);
      if (!saved) return;
      const { email, sentAt } = JSON.parse(saved);
      const age = Date.now() - sentAt;
      if (email === userEmail && age < 10 * 60 * 1000) {
        const elapsed = Math.floor(age / 1000);
        setStep(2);
        setRestoredCountdown(Math.max(0, 60 - elapsed));
      } else {
        localStorage.removeItem(PENDING_KEY);
      }
    } catch {
      localStorage.removeItem(PENDING_KEY);
    }
  }, [isOpen, userEmail]);

  const markOtpSent = () => {
    localStorage.setItem(PENDING_KEY, JSON.stringify({ email: userEmail, sentAt: Date.now() }));
  };
  const markOtpVerified = () => {
    localStorage.removeItem(PENDING_KEY);
  };
  const reset = () => {
    setStep(1);
    setRestoredCountdown(60);
    localStorage.removeItem(PENDING_KEY);
  };

  return { step, setStep, restoredCountdown, markOtpSent, markOtpVerified, reset };
}
