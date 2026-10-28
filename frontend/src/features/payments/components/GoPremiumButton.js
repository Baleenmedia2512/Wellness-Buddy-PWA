import React, { useState } from 'react';
import { Crown } from 'lucide-react';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';
import { isFlagEnabled } from '../../../config/featureFlags';
import { openPremiumCheckout } from '../openPremiumCheckout';

/**
 * Profile row that opens Cashfree payment options for Premium.
 */
export default function GoPremiumButton({ userId }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  if (!isFlagEnabled('ff.go-premium')) return null;

  const onPay = async () => {
    if (busy) return;
    if (userId == null || String(userId).trim() === '') {
      setMessage('Sign in again before paying');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      await openPremiumCheckout({ userId });
    } catch (error) {
      setMessage(error?.message || 'Payment could not start');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <TouchFeedbackButton
        onClick={onPay}
        disabled={busy}
        ariaLabel="Go Premium"
        className="w-full px-4 py-3.5 flex items-center gap-3 hover:bg-amber-50 transition-colors disabled:opacity-60"
      >
        <div className="p-2 rounded-full bg-amber-50">
          <Crown className="w-4 h-4 text-amber-600" aria-hidden />
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-medium text-gray-900">{busy ? 'Opening payment...' : 'Go Premium'}</p>
          <p className="text-xs text-gray-400">Pay with UPI, card, or net banking</p>
        </div>
      </TouchFeedbackButton>
      {message ? (
        <p className="px-4 pb-3 text-xs text-red-600" role="alert">{message}</p>
      ) : null}
    </div>
  );
}
