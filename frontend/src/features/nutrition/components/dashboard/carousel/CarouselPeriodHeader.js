import React from 'react';

/**
 * Shows which date track is active and how to read goal vs achieved on the card.
 */
export default function CarouselPeriodHeader({ periodContext }) {
  if (!periodContext) return null;

  const { title, trackingLabel, progressHint } = periodContext;

  return (
    <div className="mb-2 rounded-lg border border-emerald-100/90 bg-emerald-50/50 px-2 py-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">
          {title}
        </p>
        <p className="text-[9px] font-semibold text-emerald-700">
          {trackingLabel}
        </p>
      </div>
      {progressHint && (
        <p className="mt-0.5 text-[9px] leading-tight text-gray-500">
          {progressHint}
        </p>
      )}
    </div>
  );
}
