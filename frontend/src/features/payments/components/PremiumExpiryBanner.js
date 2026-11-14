import React from 'react';
import GoPremiumButton from './GoPremiumButton';
import { buildPremiumExpiryBannerLabel } from '../domain/premiumExpiryBanner.rules';

/**
 * Home reminder when Premium has 2 or fewer days left.
 */
export default function PremiumExpiryBanner({
  daysLeft = null,
  expiresAtDisplay = null,
  userId,
  onPremiumCheck,
  allowedPages = null,
}) {
  const label = buildPremiumExpiryBannerLabel({ daysLeft, expiresAtDisplay });

  return (
    <div
      className="mx-3 mt-2 mb-1 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2"
      role="status"
      data-testid="premium-expiry-banner"
    >
      <p className="text-sm font-semibold text-amber-950 leading-snug">{label}</p>
      <GoPremiumButton
        userId={userId}
        isPremium={false}
        renew
        onPremiumCheck={onPremiumCheck}
        allowedPages={allowedPages}
      />
    </div>
  );
}
