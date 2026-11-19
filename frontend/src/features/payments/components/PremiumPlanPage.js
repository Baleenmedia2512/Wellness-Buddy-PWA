import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Check, Crown } from 'lucide-react';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';
import {
  PREMIUM_PLAN_AMOUNT,
  PREMIUM_PLAN_NAME,
  formatPremiumPlanAmount,
} from '../domain/premiumPlan';

const PLAN_POINTS = [
  'Premium access for your Wellness Valley account',
  'Pay with UPI, card, or net banking',
  'Secure checkout',
];

/**
 * Plan page shown after Go Premium. Pay Now opens existing Cashfree checkout.
 */
export default function PremiumPlanPage({
  busy,
  message,
  onClose,
  onPayNow,
}) {
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape' && !busy) onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const amountLabel = formatPremiumPlanAmount(PREMIUM_PLAN_AMOUNT);
  const page = (
    <div
      className="fixed inset-0 z-[70] bg-gray-50 flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-labelledby="premium-plan-title"
    >
      <div className="bg-gradient-to-r from-green-600 to-green-700 px-4 pt-4 pb-16">
        <div className="flex items-center gap-3">
          <TouchFeedbackButton
            onClick={onClose}
            disabled={busy}
            ariaLabel="Close plan"
            className="p-2 -ml-2 rounded-full text-white hover:bg-green-700"
          >
            <ArrowLeft className="w-5 h-5" aria-hidden />
          </TouchFeedbackButton>
          <h1 id="premium-plan-title" className="text-lg font-bold text-white">
            Premium plan
          </h1>
        </div>
        <p className="mt-3 ml-1 text-green-50 text-sm">
          Choose Premium and continue to payment.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 -mt-10 pb-4">
        <div className="bg-white rounded-2xl shadow-md border border-green-100 overflow-hidden">
          <div className="px-5 pt-5 pb-4 border-b border-gray-100">
            <div className="flex items-start justify-between gap-3">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-sm">
                <Crown className="w-6 h-6 text-white" aria-hidden />
              </div>
              <span className="text-[11px] font-semibold tracking-wide uppercase text-green-700 bg-green-50 px-2.5 py-1 rounded-full">
                Best value
              </span>
            </div>
            <p className="mt-4 text-sm font-semibold text-gray-500">{PREMIUM_PLAN_NAME}</p>
            <p className="mt-1 flex items-baseline gap-1">
              <span className="text-4xl font-bold text-gray-900">₹{amountLabel}</span>
              <span className="text-sm text-gray-400">one-time</span>
            </p>
          </div>

          <ul className="px-5 py-4 space-y-3">
            {PLAN_POINTS.map((point) => (
              <li key={point} className="flex items-start gap-3">
                <span className="mt-0.5 h-5 w-5 rounded-full bg-green-50 text-green-600 flex items-center justify-center flex-shrink-0">
                  <Check className="w-3.5 h-3.5" aria-hidden />
                </span>
                <span className="text-sm text-gray-700">{point}</span>
              </li>
            ))}
          </ul>
        </div>

        {message ? (
          <p className="text-xs text-red-600 mt-4 px-1" role="alert">{message}</p>
        ) : (
          <p className="text-xs text-gray-400 mt-4 px-1">
            Pay Now opens a secure payment page.
          </p>
        )}
      </div>

      <div className="p-4 bg-white border-t border-gray-100">
        <TouchFeedbackButton
          onClick={onPayNow}
          disabled={busy}
          ariaLabel="Pay Now"
          className="w-full rounded-xl bg-gradient-to-r from-green-600 to-green-700 text-white py-3.5 text-sm font-semibold shadow-md disabled:opacity-60"
        >
          {busy ? 'Opening payment...' : `Pay Now · ₹${amountLabel}`}
        </TouchFeedbackButton>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return page;
  return createPortal(page, document.body);
}
