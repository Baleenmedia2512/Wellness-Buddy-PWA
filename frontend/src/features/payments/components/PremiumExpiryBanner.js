import React from 'react';
import GoPremiumButton from './GoPremiumButton';

/**
 * Home reminder when Premium has 2 or fewer days left.
 */
export default function PremiumExpiryBanner({
  daysLeft = null,
  userId,
  onPremiumCheck,
}) {
  const days = Number(daysLeft);
  const label = !Number.isFinite(days) || days < 1
    ? 'Your plan analysis expires today. Please recharge.'
    : days === 1
      ? 'Your plan analysis expires in 1 day. Please recharge.'
      : `Your plan analysis expires in ${days} days. Please recharge.`;

  return (
    <div
      className="mx-3 mt-2 mb-1 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2"
      role="status"
      data-testid="premium-expiry-banner"
    >
      <p className="text-sm font-semibold text-amber-950">{label}</p>
      <GoPremiumButton
        userId={userId}
        isPremium={false}
        renew
        onPremiumCheck={onPremiumCheck}
      />
    </div>
  );
}
