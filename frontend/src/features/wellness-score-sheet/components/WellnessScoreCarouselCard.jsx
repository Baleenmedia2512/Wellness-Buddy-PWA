import React from 'react';
import { ChevronRight, Settings, Trophy } from 'lucide-react';
import CircularProgress from '../../nutrition/components/dashboard/carousel/CircularProgress';
import { useISTToday } from '../hooks/useISTToday';
import { useWellnessScore } from '../hooks/useWellnessScore';

function statusBadge(pct) {
  if (pct >= 75) return { label: 'Great', className: 'bg-emerald-100 text-emerald-700' };
  if (pct >= 50) return { label: 'On Track', className: 'bg-amber-100 text-amber-700' };
  return { label: 'Keep Going', className: 'bg-orange-100 text-orange-700' };
}

/**
 * Home carousel card — bold score hero, circular progress only (no duplicate %).
 */
export default function WellnessScoreCarouselCard({ user, apiBaseUrl, onOpen, onOpenSetup }) {
  const today = useISTToday();
  const { loading, data } = useWellnessScore({ user, apiBaseUrl, date: today });

  const progressPct = data?.percentage ?? 0;
  const earned = Math.round(data?.totalEarned ?? 0);
  const possible = Math.round(data?.totalPossible ?? 0);
  const badge = statusBadge(progressPct);
  const hasData = !loading || !!data;
  const displayPct = hasData ? Math.round(progressPct) : 0;

  if (!user) return null;

  const handleCardKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpen?.();
    }
  };

  return (
    <div className="h-full min-h-[148px] flex">
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={handleCardKeyDown}
        className="group flex h-full w-full flex-col rounded-xl bg-gradient-to-br from-white via-white to-emerald-50/60 p-3 text-left shadow-lg ring-1 ring-emerald-100/80 transition-all hover:shadow-xl hover:ring-emerald-200 active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 cursor-pointer"
        data-testid="wellness-score-home-tile"
        aria-label={
          hasData
            ? `Wellness score ${earned} of ${possible} points, ${displayPct}% progress. Tap for full breakdown.`
            : 'Wellness score loading. Tap for full breakdown.'
        }
      >
        {/* Header */}
        <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-md">
              <Trophy className="h-4 w-4 text-white" aria-hidden />
            </div>
            <span className="truncate text-base font-bold text-gray-900">Wellness Score</span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {hasData && (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${badge.className}`}>
                {badge.label}
              </span>
            )}
            {onOpenSetup ? (
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onOpenSetup();
                }}
                className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-emerald-50 hover:text-emerald-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                data-testid="wellness-score-setup-button"
                aria-label="Configure wellness score"
              >
                <Settings className="h-4 w-4 pointer-events-none" aria-hidden />
              </button>
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0 text-emerald-500 transition-transform group-hover:translate-x-0.5" aria-hidden />
            )}
          </div>
        </div>

        {/* Hero — ring + score fills remaining space */}
        <div className="flex min-h-0 flex-1 items-center justify-between gap-3">
          <div className="flex shrink-0 items-center justify-center">
            <CircularProgress
              percentage={hasData ? displayPct : 0}
              size={92}
              strokeWidth={8}
            />
          </div>

          <div className="flex min-w-0 flex-1 flex-col items-end justify-center text-right">
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">
              Today&apos;s score
            </p>
            <p className="mt-0.5 text-[2.35rem] font-black leading-none tabular-nums tracking-tight text-gray-900">
              {hasData ? earned.toLocaleString() : '—'}
            </p>
            <p className="mt-1 text-sm font-semibold tabular-nums text-gray-500">
              of
              {' '}
              <span className="text-base font-bold text-gray-800">
                {hasData ? possible.toLocaleString() : '—'}
              </span>
              {' '}
              pts
            </p>
          </div>
        </div>

        {/* Tap CTA — uses footer whitespace */}
        <div className="mt-2 flex shrink-0 items-center justify-between gap-2 rounded-lg border border-emerald-200/70 bg-emerald-600/10 px-3 py-2 transition-colors group-hover:bg-emerald-600/15">
          <span className="text-[11px] font-bold text-emerald-800">
            Tap to view full breakdown
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-emerald-600 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </div>
      </div>
    </div>
  );
}
