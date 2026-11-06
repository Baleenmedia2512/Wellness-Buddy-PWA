import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';

/**
 * One-time popup after Cashfree payment is confirmed.
 * Closes only when the member taps Okay.
 */
export default function PremiumSuccessPopup({ onOkay }) {
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onOkay?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onOkay]);

  const popup = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="premium-success-title"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white px-6 py-8 text-center shadow-xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-500">
          <Check className="h-8 w-8 text-white" strokeWidth={3} aria-hidden />
        </div>
        <h2 id="premium-success-title" className="mt-5 text-xl font-bold text-gray-900">
          Payment Successful
        </h2>
        <p className="mt-2 text-sm text-gray-500">
          You are now a Premium Member
        </p>
        <TouchFeedbackButton
          onClick={onOkay}
          ariaLabel="Okay"
          className="mt-6 w-full rounded-xl bg-green-600 py-3 text-sm font-semibold text-white"
        >
          Okay
        </TouchFeedbackButton>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return popup;
  return createPortal(popup, document.body);
}
