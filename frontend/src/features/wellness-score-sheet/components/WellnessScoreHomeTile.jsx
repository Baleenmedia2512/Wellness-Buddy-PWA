import React, { useMemo, useState } from 'react';
import { ChevronRight, Trophy } from 'lucide-react';
import { buildMockDailyScore } from '../domain/mockScoreData';
import ScoreCircularProgress from './ScoreCircularProgress';
import WellnessScoreSheet from './WellnessScoreSheet';

/**
 * Home screen tile — first wellness score card with tap-to-expand sheet.
 */
export default function WellnessScoreHomeTile({
  onOpenCoachConfig,
  showCoachConfigLink = false,
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const scoreData = useMemo(() => buildMockDailyScore(today), [today]);

  const topParams = useMemo(
    () => [...scoreData.parameters]
      .filter((p) => p.enabled && p.scoringType !== 'deferred')
      .sort((a, b) => (b.earnedMark / b.maxMark) - (a.earnedMark / a.maxMark))
      .slice(0, 3),
    [scoreData.parameters],
  );

  if (sheetOpen) {
    return (
      <WellnessScoreSheet
        onBack={() => setSheetOpen(false)}
        onOpenCoachConfig={onOpenCoachConfig}
        showCoachConfigLink={showCoachConfigLink}
        date={today}
      />
    );
  }

  return (
    <div className="px-2 md:px-3 mb-2">
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="w-full max-w-md mx-auto block text-left bg-white/80 backdrop-blur-xl border-2 border-emerald-200/90 rounded-xl shadow-md p-4 active:scale-[0.99] transition-transform hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        data-testid="wellness-score-home-tile"
        aria-label={`Wellness score ${scoreData.overallScore} out of 100. Tap for full score sheet.`}
      >
        <div className="flex items-center gap-3">
          <ScoreCircularProgress
            percentage={scoreData.overallScore}
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
              {scoreData.overallScore}
              <span className="text-sm font-medium text-gray-400">/100</span>
            </p>
            <p className="text-[11px] text-gray-500">
              {scoreData.totalEarned} pts · 34 parameters
            </p>
            <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full"
                style={{ width: `${scoreData.overallScore}%` }}
              />
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" aria-hidden />
        </div>

        {topParams.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-3 gap-2">
            {topParams.map((p) => (
              <div key={p.key} className="text-center min-w-0">
                <p className="text-[10px] text-gray-500 truncate">{p.label}</p>
                <p className="text-xs font-bold text-gray-800">
                  {p.earnedMark}
                  <span className="text-gray-400 font-normal">/{p.maxMark}</span>
                </p>
              </div>
            ))}
          </div>
        )}
      </button>
    </div>
  );
}
