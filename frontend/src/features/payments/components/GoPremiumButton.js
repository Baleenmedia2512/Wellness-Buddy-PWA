import React, { useState } from 'react';
import { Crown } from 'lucide-react';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';
import { isFlagEnabled } from '../../../config/featureFlags';
import { openPremiumCheckout } from '../openPremiumCheckout';
import { memberCheckoutErrorMessage } from '../domain/nativePremiumCheckout.rules';
import PremiumPlanPage from './PremiumPlanPage';

const CONFIRM_ATTEMPTS_AFTER_PAYMENT = 4;
const CONFIRM_RETRY_DELAY_MS = 2000;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Profile row that opens the Premium plan page, then Cashfree on Pay Now.
 * `onPremiumCheck` asks the server whether the payment went through.
 * Members who already paid do not see this row again.
 */
export default function GoPremiumButton({ userId, isPremium = false, onPremiumCheck }) {
  const [showPlan, setShowPlan] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  if (!isFlagEnabled('ff.go-premium')) return null;
  if (isPremium) return null;

  const checkPremium = async (attempts) => {
    if (typeof onPremiumCheck !== 'function') return false;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        if (await onPremiumCheck()) return true;
      } catch {
        // A failed check is not a failed payment.
      }
      if (attempt < attempts - 1) await wait(CONFIRM_RETRY_DELAY_MS);
    }
    return false;
  };

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
      const { result } = await openPremiumCheckout({ userId });
      const paidInCheckout = Boolean(result?.paymentDetails);
      const confirmed = await checkPremium(paidInCheckout ? CONFIRM_ATTEMPTS_AFTER_PAYMENT : 1);
      if (!confirmed && paidInCheckout) {
        setMessage('Payment received. Premium will show on your profile shortly.');
      }
    } catch (error) {
      // The member may have paid and then closed the window, so check before showing an error.
      const confirmed = await checkPremium(1);
      if (!confirmed) setMessage(memberCheckoutErrorMessage(error));
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
