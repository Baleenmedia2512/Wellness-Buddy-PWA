import React, { useState } from 'react';
import { Crown } from 'lucide-react';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';
import { isFlagEnabled } from '../../../config/featureFlags';
import { openPremiumCheckout } from '../openPremiumCheckout';
import PremiumPlanPage from './PremiumPlanPage';

/**
 * Profile row that opens the Premium plan page, then Cashfree on Pay Now.
 */
export default function GoPremiumButton({ userId }) {
  const [showPlan, setShowPlan] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  if (!isFlagEnabled('ff.go-premium')) return null;

  const onOpenPlan = () => {
    if (busy) return;
    if (userId == null || String(userId).trim() === '') {
      setMessage('Sign in again before paying');
      return;
    }
    setMessage('');
    setShowPlan(true);
  };

  const onPayNow = async () => {
    if (busy) return;
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
        onClick={onOpenPlan}
        disabled={busy}
        ariaLabel="Go Premium"
        className="w-full px-4 py-3.5 flex items-center gap-3 hover:bg-amber-50 transition-colors disabled:opacity-60"
      >
        <div className="p-2 rounded-full bg-amber-50">
          <Crown className="w-4 h-4 text-amber-600" aria-hidden />
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-medium text-gray-900">Go Premium</p>
          <p className="text-xs text-gray-400">Pay with UPI, card, or net banking</p>
        </div>
      </TouchFeedbackButton>
      {!showPlan && message ? (
        <p className="px-4 pb-3 text-xs text-red-600" role="alert">{message}</p>
      ) : null}
      {showPlan ? (
        <PremiumPlanPage
          busy={busy}
          message={message}
          onClose={() => {
            if (busy) return;
            setShowPlan(false);
            setMessage('');
          }}
          onPayNow={onPayNow}
        />
      ) : null}
    </div>
  );
}
