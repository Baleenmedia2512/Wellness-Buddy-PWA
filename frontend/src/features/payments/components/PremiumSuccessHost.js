import React, { useCallback, useEffect, useState } from 'react';
import PremiumSuccessPopup from './PremiumSuccessPopup';
import {
  clearPremiumSuccessPending,
  isPremiumSuccessPending,
  subscribePremiumSuccess,
} from '../services/premiumSuccess';

/**
 * Shows the success popup when this member's Premium payment was just confirmed.
 * Stays mounted on Home and My Profile so it appears wherever they land.
 */
export default function PremiumSuccessHost({ userId }) {
  const [open, setOpen] = useState(() => isPremiumSuccessPending(userId));

  useEffect(() => {
    setOpen(isPremiumSuccessPending(userId));
    return subscribePremiumSuccess(() => {
      setOpen(isPremiumSuccessPending(userId));
    });
  }, [userId]);

  const close = useCallback(() => {
    clearPremiumSuccessPending();
    setOpen(false);
  }, []);

  if (!open) return null;

  return <PremiumSuccessPopup onClose={close} />;
}
