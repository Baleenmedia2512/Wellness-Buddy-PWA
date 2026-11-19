import React from 'react';
import { Crown } from 'lucide-react';

/** Small "Premium" pill shown next to the profile avatar for paid members. */
export default function PremiumBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300"
      aria-label="Premium member"
    >
      <Crown className="w-3 h-3" aria-hidden />
      Premium
    </span>
  );
}

/** Crown + "Premium" in the free space beside the Home header avatar. Hidden on very narrow phones. */
export function PremiumHeaderTag() {
  return (
    <span
      className="hidden min-[340px]:inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-amber-100 border border-amber-300 px-2 py-1 text-xs font-bold leading-none text-amber-900"
      data-testid="premium-header-tag"
    >
      <Crown className="w-3 h-3" aria-hidden />
      Premium
    </span>
  );
}

/** Small crown on the avatar corner. Only for very narrow phones with no room for the tag. */
export function PremiumCrownMark() {
  return (
    <span
      className="min-[340px]:hidden absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 border border-white shadow-sm pointer-events-none"
      data-testid="premium-crown"
      aria-hidden
    >
      <Crown className="w-2.5 h-2.5 text-amber-900" aria-hidden />
    </span>
  );
}
