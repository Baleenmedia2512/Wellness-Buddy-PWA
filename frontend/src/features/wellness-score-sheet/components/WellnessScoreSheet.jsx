import React from 'react';
import { ArrowLeft, ClipboardList, Loader2, Trophy } from 'lucide-react';
import ScoreCategoryRow from './ScoreCategoryRow';
import { PARAMETER_SECTIONS, parametersBySection } from '../domain/parameterRegistry';
import { getSectionIcon } from '../domain/parameterIcons';

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

function scoreTone(pct) {
  if (pct >= 75) return 'from-emerald-500 to-emerald-600';
  if (pct >= 50) return 'from-amber-400 to-amber-500';
  return 'from-orange-400 to-red-500';
}

/**
 * Full wellness score sheet — unified progress card + parameter breakdown.
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
  const earned = Math.round(scoreData?.totalEarned ?? 0);
  const possible = Math.round(scoreData?.totalPossible ?? 0);

  return (
    <div className="min-h-screen bg-[#f4f7f5]">
      <header className="sticky top-0 z-20 border-b border-gray-200/80 bg-white/95 backdrop-blur safe-top">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="-ml-2 rounded-lg p-2 transition-colors hover:bg-gray-100"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5 text-gray-700" />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-2 text-base font-bold text-gray-900">
              <ClipboardList className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
              Wellness Score
            </h1>
            <p className="text-xs text-gray-500">{formatDateLabel(dateStr)}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 px-4 py-4 pb-28">
        {loading && (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" aria-label="Loading" />
          </div>
        )}

        {error && !loading && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
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
            <section className="overflow-hidden rounded-2xl border border-emerald-200/80 bg-white shadow-sm">
              <div className="border-b border-emerald-100 bg-gradient-to-r from-emerald-50 to-white px-4 py-3">
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-emerald-600" aria-hidden />
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                    Daily wellness score
                  </p>
                </div>
              </div>
              <div className="px-4 py-4">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-4xl font-bold tabular-nums leading-none text-gray-900">
                      {Math.round(overallScore)}
                      <span className="text-lg font-semibold text-gray-400">/100</span>
                    </p>
                    <p className="mt-2 text-sm text-gray-600">
                      <span className="font-semibold text-gray-900">{earned}</span>
                      {' '}
                      of
                      {' '}
                      <span className="font-semibold text-gray-900">{possible}</span>
                      {' '}
                      points earned
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-right">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
                      Parameters
                    </p>
                    <p className="text-lg font-bold tabular-nums text-gray-900">{parameters.length}</p>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="mb-1.5 flex justify-between text-[11px] font-medium text-gray-500">
                    <span>Overall progress</span>
                    <span className="tabular-nums text-gray-700">{Math.round(overallScore)}%</span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r transition-all duration-700 ${scoreTone(overallScore)}`}
                      style={{ width: `${Math.min(100, overallScore)}%` }}
                      role="progressbar"
                      aria-valuenow={Math.round(overallScore)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label="Overall wellness score"
                    />
                  </div>
                </div>
              </div>
            </section>

            {PARAMETER_SECTIONS.map((section) => {
              const block = grouped[section.id];
              if (!block?.parameters?.length) return null;
              const SectionIcon = getSectionIcon(section.id);
              const sectionEarned = block.parameters.reduce((s, p) => s + (p.earnedPoints ?? 0), 0);
              const sectionMax = block.parameters.reduce((s, p) => s + (p.maxPoints ?? 0), 0);
              const sectionPct = sectionMax > 0 ? Math.round((sectionEarned / sectionMax) * 100) : 0;

              return (
                <section
                  key={section.id}
                  className="overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-sm"
                >
                  <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/80 px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <SectionIcon className="h-4 w-4 text-emerald-600" aria-hidden />
                      <h2 className="text-xs font-bold uppercase tracking-wide text-gray-700">
                        {section.label}
                      </h2>
                    </div>
                    <span className="text-xs font-semibold tabular-nums text-gray-600">
                      {sectionEarned}/{sectionMax} pts · {sectionPct}%
                    </span>
                  </div>
                  <div className="space-y-2 p-3">
                    {block.parameters.map((param) => (
                      <ScoreCategoryRow key={param.key} category={param} />
                    ))}
                  </div>
                </section>
              );
            })}
          </>
        )}
      </main>
    </div>
  );
}
