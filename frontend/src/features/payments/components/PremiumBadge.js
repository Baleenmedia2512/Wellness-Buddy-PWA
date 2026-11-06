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

/**
 * Blue-to-purple ring around a paid member's profile photo.
 * Pass enabled={false} to render the photo with no ring.
 */
export function PremiumAvatarRing({ enabled = true, children }) {
  if (!enabled) return children;
  return (
    <span
      className="inline-flex aspect-square shrink-0 items-center justify-center rounded-full bg-[conic-gradient(from_210deg,#2563eb,#38bdf8,#c084fc,#7c3aed,#2563eb)] p-[3px] leading-none"
      data-testid="premium-avatar-ring"
    >
      <span className="flex aspect-square h-full w-full items-center justify-center overflow-hidden rounded-full bg-white p-[2px] leading-none">
        {children}
      </span>
    </span>
  );
}

/** Gold crown on the bottom-right of a Premium member's profile photo. */
export function PremiumCrownMark({ size = 'sm' }) {
  const box = size === 'lg' ? 'h-7 w-7' : 'h-5 w-5';
  const icon = size === 'lg' ? 'h-4 w-4' : 'h-3 w-3';
  return (
    <span
      className={`absolute -bottom-0.5 -right-0.5 flex ${box} items-center justify-center rounded-full bg-amber-400 border-2 border-white shadow-sm pointer-events-none`}
      data-testid="premium-crown"
      aria-hidden
    >
      <Crown className={`${icon} text-amber-950`} aria-hidden />
    </span>
  );
}
