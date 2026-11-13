import React, { useState } from 'react';
import { Crown } from 'lucide-react';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';
import { isFlagEnabled } from '../../../config/featureFlags';
import { openPremiumCheckout } from '../openPremiumCheckout';
import { memberCheckoutErrorMessage } from '../domain/nativePremiumCheckout.rules';
import { fetchPremiumQuote } from '../services/premiumApi';
import PremiumPlanPage from './PremiumPlanPage';

const CONFIRM_ATTEMPTS_AFTER_PAYMENT = 4;
const CONFIRM_RETRY_DELAY_MS = 2000;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Header chip that opens the Premium plan page, then Cashfree on Pay Now.
 * `onPremiumCheck` asks the server whether the payment went through.
 * Members who already paid do not see this chip again, unless `renew` (expiry reminder).
 */
export default function GoPremiumButton({
  userId,
  isPremium = false,
  onPremiumCheck,
  renew = false,
}) {
  const [showPlan, setShowPlan] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [quote, setQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  if (!isFlagEnabled('ff.go-premium')) return null;
  if (isPremium && !renew) return null;

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

  const onOpenPlan = async () => {
    if (busy) return;
    if (userId == null || String(userId).trim() === '') {
      setMessage('Sign in again before paying');
      return;
    }
    setMessage('');
    setQuote(null);
    setShowPlan(true);
    setQuoteLoading(true);
    const result = await fetchPremiumQuote(userId);
    setQuote(result.quote);
    if (!result.quote && result.message) setMessage(result.message);
    setQuoteLoading(false);
  };

  const onPayNow = async () => {
    if (busy || !quote) return;
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
    <div className="flex shrink-0 flex-col items-end">
      <TouchFeedbackButton
        onClick={onOpenPlan}
        disabled={busy}
        ariaLabel={renew ? 'Recharge Premium' : 'Go Premium'}
        title="Pay with UPI, card, or net banking"
        className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-amber-900 shadow-sm disabled:opacity-60"
      >
        <Crown className="w-3.5 h-3.5 text-amber-600" aria-hidden />
        <span className="whitespace-nowrap text-xs font-bold">{renew ? 'Recharge' : 'Go Premium'}</span>
      </TouchFeedbackButton>
      {!showPlan && message ? (
        <p className="mt-1 max-w-[11rem] text-right text-[11px] leading-tight text-amber-50" role="alert">{message}</p>
      ) : null}
      {showPlan ? (
        <PremiumPlanPage
          busy={busy}
          message={message}
          quote={quote}
          quoteLoading={quoteLoading}
          onClose={() => {
            if (busy) return;
            setShowPlan(false);
            setMessage('');
            setQuote(null);
            setQuoteLoading(false);
          }}
          onPayNow={onPayNow}
        />
      ) : null}
    </div>
  );
}
