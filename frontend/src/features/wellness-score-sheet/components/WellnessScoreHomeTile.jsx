import React from 'react';
import { ChevronRight, Trophy } from 'lucide-react';
import { useISTToday } from '../hooks/useISTToday';
import { useWellnessScore } from '../hooks/useWellnessScore';

function scoreTone(pct) {
  if (pct >= 75) return 'from-emerald-500 to-emerald-600';
  if (pct >= 50) return 'from-amber-400 to-amber-500';
  return 'from-orange-400 to-red-500';
}

/**
 * Home screen tile — configured score + progress (matches carousel card).
 */
export default function WellnessScoreHomeTile({ user, apiBaseUrl, onOpen }) {
  const today = useISTToday();
  const { loading, data } = useWellnessScore({ user, apiBaseUrl, date: today });

  const progressPct = data?.percentage ?? 0;
  const earned = Math.round(data?.totalEarned ?? 0);
  const possible = Math.round(data?.totalPossible ?? 0);
  const hasData = !loading || !!data;
  const displayPct = hasData ? Math.round(progressPct) : 0;

  if (!user) return null;

  return (
    <div className="mb-2 px-2 md:px-3">
      <button
        type="button"
        onClick={onOpen}
        disabled={loading && !data}
        className="group mx-auto block w-full max-w-md rounded-2xl border border-emerald-200/90 bg-white p-4 text-left shadow-sm transition-all hover:shadow-md hover:ring-1 hover:ring-emerald-200 active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-70"
        data-testid="wellness-score-home-tile"
        aria-label={
          hasData
            ? `Wellness score ${earned} of ${possible} points, ${displayPct}% progress. Tap for full breakdown.`
            : 'Wellness score loading. Tap for full breakdown.'
        }
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <Trophy className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
              <span className="text-xs font-bold uppercase tracking-wide text-emerald-700">
                Wellness Score
              </span>
            </div>
            <p className="mt-1 text-3xl font-bold tabular-nums leading-none text-gray-900">
              {hasData ? earned.toLocaleString() : '—'}
              <span className="text-base font-semibold text-gray-400">
                {' '}
                /
                {' '}
                {hasData ? possible.toLocaleString() : '—'}
              </span>
            </p>
            <p className="mt-1 text-xs font-semibold text-gray-600">
              {hasData ? `${displayPct}% progress · Today` : 'Loading score…'}
            </p>
            <p className="mt-1 flex items-center gap-1 text-[10px] font-medium text-emerald-700">
              Tap for full breakdown
              <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </p>
          </div>
          <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-emerald-500 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </div>

        <div className="mt-3">
          <div className="mb-1 flex justify-between text-[10px] font-medium text-gray-500">
            <span>Progress</span>
            <span className="tabular-nums">{hasData ? `${displayPct}%` : '—'}</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className={`h-full rounded-full bg-gradient-to-r transition-all duration-500 ${scoreTone(displayPct)}`}
              style={{ width: `${Math.min(100, hasData ? displayPct : 0)}%` }}
              role="progressbar"
              aria-valuenow={displayPct}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>
      </button>
    </div>
  );
}
