import React, { useMemo } from 'react';
import { ChevronRight, Percent, Settings, Target, Trophy } from 'lucide-react';
import CircularProgress from '../../nutrition/components/dashboard/carousel/CircularProgress';
import { useWellnessScore } from '../hooks/useWellnessScore';

function statusBadge(pct) {
  if (pct >= 75) return { label: 'Great', className: 'bg-emerald-100 text-emerald-700' };
  if (pct >= 50) return { label: 'On Track', className: 'bg-amber-100 text-amber-700' };
  return { label: 'Keep Going', className: 'bg-orange-100 text-orange-700' };
}

/**
 * First card in the home nutrition carousel — matches CaloriesCard footprint.
 * Admins/developers get a settings control (onOpenSetup) instead of chevron.
 */
export default function WellnessScoreCarouselCard({ user, apiBaseUrl, onOpen, onOpenSetup }) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const { loading, data } = useWellnessScore({ user, apiBaseUrl, date: today });

  const overallScore = data?.percentage ?? 0;
  const earned = Math.round(data?.totalEarned ?? 0);
  const possible = Math.round(data?.totalPossible ?? 0);
  const badge = statusBadge(overallScore);
  const displayScore = loading && !data ? '—' : Math.round(overallScore);

  if (!user) return null;

  const handleCardKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpen?.();
    }
  };

  return (
    <div className="h-full flex items-center justify-center py-2">
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={handleCardKeyDown}
        className="w-full rounded-xl bg-white p-3 text-left shadow-lg transition-all active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 cursor-pointer"
        data-testid="wellness-score-home-tile"
        aria-label={`Wellness score ${displayScore === '—' ? 0 : displayScore} out of 100. Tap for details.`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-md">
              <Trophy className="h-3.5 w-3.5 text-white" aria-hidden />
            </div>
            <span className="text-base font-bold text-gray-900">Wellness Score</span>
          </div>
          <div className="flex items-center gap-1">
            {!loading || data ? (
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badge.className}`}>
                {badge.label}
              </span>
            ) : null}
            {onOpenSetup ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenSetup();
                }}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-emerald-50 hover:text-emerald-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                data-testid="wellness-score-setup-button"
                aria-label="Configure wellness score"
              >
                <Settings className="h-4 w-4" aria-hidden />
              </button>
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
            )}
          </div>
        </div>

        <p className="text-[9px] text-gray-500 text-center mb-1.5">
          {data ? `${earned} of ${possible} points earned today` : 'Loading score…'}
        </p>

        <div className="flex items-center justify-between mb-2">
          <CircularProgress
            percentage={loading && !data ? 0 : Math.round(overallScore)}
            size={70}
            strokeWidth={7}
            targetLabel="100"
          />
          <div className="flex-1 text-center">
            <p className="text-3xl font-extrabold leading-none mb-0.5 text-gray-900 tabular-nums">
              {displayScore}
              <span className="text-base font-semibold text-gray-400">/100</span>
            </p>
            <p className="text-xs font-semibold text-gray-600">Daily score</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 border-t border-gray-100 pt-2">
          <div className="text-center">
            <div className="mx-auto mb-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50">
              <Trophy className="h-3.5 w-3.5 text-emerald-500" aria-hidden />
            </div>
            <p className="text-[10px] text-gray-500">Earned</p>
            <p className="text-xs font-bold text-gray-900 tabular-nums">
              {loading && !data ? '—' : earned.toLocaleString()}
            </p>
          </div>
          <div className="text-center">
            <div className="mx-auto mb-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-blue-50">
              <Target className="h-3.5 w-3.5 text-blue-500" aria-hidden />
            </div>
            <p className="text-[10px] text-gray-500">Possible</p>
            <p className="text-xs font-bold text-gray-900 tabular-nums">
              {loading && !data ? '—' : possible.toLocaleString()}
            </p>
          </div>
          <div className="text-center">
            <div className="mx-auto mb-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-violet-50">
              <Percent className="h-3.5 w-3.5 text-violet-500" aria-hidden />
            </div>
            <p className="text-[10px] text-gray-500">Progress</p>
            <p className="text-xs font-bold text-gray-900 tabular-nums">
              {loading && !data ? '—' : `${Math.round(overallScore)}%`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
