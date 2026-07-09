import React, { useMemo } from 'react';
import { ChevronRight, Trophy } from 'lucide-react';
import { useWellnessScore } from '../hooks/useWellnessScore';

function scoreTone(pct) {
  if (pct >= 75) return 'from-emerald-500 to-emerald-600';
  if (pct >= 50) return 'from-amber-400 to-amber-500';
  return 'from-orange-400 to-red-500';
}

/**
 * Home screen tile — unified score + progress bar (matches score sheet).
 */
export default function WellnessScoreHomeTile({ user, apiBaseUrl, onOpen }) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const { loading, data } = useWellnessScore({ user, apiBaseUrl, date: today });

  const overallScore = data?.percentage ?? 0;
  const earned = Math.round(data?.totalEarned ?? 0);
  const possible = Math.round(data?.totalPossible ?? 0);

  if (!user) return null;

  return (
    <div className="mb-2 px-2 md:px-3">
      <button
        type="button"
        onClick={onOpen}
        disabled={loading && !data}
        className="mx-auto block w-full max-w-md rounded-2xl border border-emerald-200/90 bg-white p-4 text-left shadow-sm transition-all hover:shadow-md active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-70"
        data-testid="wellness-score-home-tile"
        aria-label={`Wellness score ${Math.round(overallScore)} out of 100. Tap for details.`}
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
              {loading && !data ? '—' : Math.round(overallScore)}
              <span className="text-base font-semibold text-gray-400">/100</span>
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {data
                ? `${earned} of ${possible} points`
                : 'Loading score…'}
            </p>
          </div>
          <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-gray-400" aria-hidden />
        </div>

        <div className="mt-3">
          <div className="mb-1 flex justify-between text-[10px] font-medium text-gray-500">
            <span>Today&apos;s progress</span>
            <span className="tabular-nums">{loading && !data ? '—' : `${Math.round(overallScore)}%`}</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className={`h-full rounded-full bg-gradient-to-r transition-all duration-500 ${scoreTone(overallScore)}`}
              style={{ width: `${Math.min(100, loading && !data ? 0 : overallScore)}%` }}
              role="progressbar"
              aria-valuenow={Math.round(overallScore)}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>
      </button>
    </div>
  );
}
