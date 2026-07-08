import React, { useMemo } from 'react';
import { ChevronRight, Trophy } from 'lucide-react';
import { useWellnessScore } from '../hooks/useWellnessScore';
import ScoreCircularProgress from './ScoreCircularProgress';

/**
 * Home screen tile — tap opens full Wellness Score page via onOpen.
 */
export default function WellnessScoreHomeTile({ user, apiBaseUrl, onOpen }) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const { loading, data } = useWellnessScore({ user, apiBaseUrl, date: today });

  const overallScore = data?.percentage ?? 0;
  const topParameters = useMemo(() => {
    if (!data?.parameters) return [];
    return [...data.parameters]
      .filter((p) => (p.maxPoints ?? 0) > 0)
      .sort((a, b) => (b.percentage ?? 0) - (a.percentage ?? 0))
      .slice(0, 3);
  }, [data?.parameters]);

  if (!user) return null;

  return (
    <div className="px-2 md:px-3 mb-2">
      <button
        type="button"
        onClick={onOpen}
        disabled={loading && !data}
        className="w-full max-w-md mx-auto block text-left bg-white/80 backdrop-blur-xl border-2 border-emerald-200/90 rounded-xl shadow-md p-4 active:scale-[0.99] transition-transform hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-70"
        data-testid="wellness-score-home-tile"
        aria-label={`Wellness score ${Math.round(overallScore)} out of 100. Tap for details.`}
      >
        <div className="flex items-center gap-3">
          <ScoreCircularProgress
            percentage={loading && !data ? 0 : overallScore}
            size={80}
            subtitle="Score"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden />
              <span className="text-xs font-bold text-emerald-700 uppercase tracking-wide">
                Wellness Score
              </span>
            </div>
            <p className="text-lg font-bold text-gray-900 mt-0.5">
              {loading && !data ? '—' : Math.round(overallScore)}
              <span className="text-sm font-medium text-gray-400">/100</span>
            </p>
            <p className="text-[11px] text-gray-500">
              {data
                ? `${Math.round(data.totalEarned)} / ${data.totalPossible} pts`
                : 'Loading score…'}
            </p>
            <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all"
                style={{ width: `${Math.min(100, overallScore)}%` }}
              />
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" aria-hidden />
        </div>

        {topParameters.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-3 gap-2">
            {topParameters.map((p) => (
              <div key={p.key} className="text-center min-w-0">
                <p className="text-[10px] text-gray-500 truncate">{p.label}</p>
                <p className="text-xs font-bold text-gray-800">
                  {Math.round(p.earnedPoints)}
                  <span className="text-gray-400 font-normal">/{p.maxPoints}</span>
                </p>
              </div>
            ))}
          </div>
        )}
      </button>
    </div>
  );
}
