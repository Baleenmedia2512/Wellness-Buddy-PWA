// 2-step delete-account state machine (warning → confirm).
// Email OTP removed — delete is keyed by userId + typed DELETE.
import { useEffect, useState } from 'react';

export default function useDeleteAccountFlow({ isOpen }) {
  const [step, setStep] = useState(1);

  useEffect(() => {
    if (!isOpen) setStep(1);
  }, [isOpen]);

  const reset = () => {
    setStep(1);
  };

  return { step, setStep, reset };
}
