import React from 'react';
import { ArrowLeft, ClipboardList, Loader2 } from 'lucide-react';
import ScoreCircularProgress from './ScoreCircularProgress';
import ScoreCategoryRow from './ScoreCategoryRow';
import { PARAMETER_SECTIONS, parametersBySection } from '../domain/parameterRegistry';

function formatDateLabel(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dt);
  target.setHours(0, 0, 0, 0);
  if (target.getTime() === today.getTime()) return 'Today';
  return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * Full wellness score sheet — 34 individual parameters from backend API.
 */
export default function WellnessScoreSheet({
  onBack,
  scoreData,
  loading = false,
  error = null,
  onRetry,
}) {
  const dateStr = scoreData?.date || new Date().toISOString().slice(0, 10);
  const parameters = scoreData?.parameters || [];
  const grouped = parametersBySection(parameters);
  const overallScore = scoreData?.percentage ?? 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-green-50">
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-gray-200 shadow-sm safe-top">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-2 -ml-2 rounded-xl hover:bg-gray-100 transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-emerald-600 shrink-0" aria-hidden />
              Wellness Score
            </h1>
            <p className="text-xs text-gray-500">{formatDateLabel(dateStr)}</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 pb-28 space-y-4">
        {loading && (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" aria-label="Loading" />
          </div>
        )}

        {error && !loading && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
            <p className="text-sm text-red-700">{error}</p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="mt-2 text-sm font-semibold text-red-800 underline"
              >
                Retry
              </button>
            )}
          </div>
        )}

        {!loading && !error && scoreData && (
          <>
            <div className="bg-white/90 backdrop-blur border border-emerald-200/80 rounded-2xl p-4 shadow-md flex items-center gap-4">
              <ScoreCircularProgress percentage={overallScore} size={96} subtitle="Score" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-emerald-800">Overall wellness score</p>
                <p className="text-2xl font-bold text-gray-900 mt-0.5">
                  {Math.round(overallScore)}
                  <span className="text-base font-medium text-gray-400">/100</span>
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {Math.round(scoreData.totalEarned)} / {scoreData.totalPossible} points earned
                </p>
                <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full"
                    style={{ width: `${Math.min(100, overallScore)}%` }}
                  />
                </div>
              </div>
            </div>

            {PARAMETER_SECTIONS.map((section) => {
              const block = grouped[section.id];
              if (!block?.parameters?.length) return null;
              return (
                <div key={section.id} className="space-y-2">
                  <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500 px-1">
                    {section.label}
                  </h2>
                  {block.parameters.map((param) => (
                    <ScoreCategoryRow key={param.key} category={param} />
                  ))}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
