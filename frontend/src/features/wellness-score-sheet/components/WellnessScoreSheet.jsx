import React from 'react';
import { ArrowLeft, ClipboardList, Loader2, Trophy } from 'lucide-react';
import { todayDateInIST } from '../../../shared/utils/timezoneUtils';
import ScoreCategoryRow from './ScoreCategoryRow';
import { PARAMETER_SECTIONS, parametersBySection } from '../domain/parameterRegistry';
import { getSectionIcon } from '../domain/parameterIcons';
import { formatWellnessDayLabel } from '../domain/dateRange';
import ReportDateRangeFilter from '../../../shared/components/common/ReportDateRangeFilter';
import { WELLNESS_SCORE_DATE_RANGES } from '../../../shared/domain/reportDateRanges';
import WellnessScoreDayStrip from './WellnessScoreDayStrip';

function scoreTone(pct) {
  if (pct >= 75) return 'from-emerald-500 to-emerald-600';
  if (pct >= 50) return 'from-amber-400 to-amber-500';
  return 'from-orange-400 to-red-500';
}

/**
 * Full wellness score sheet — configured points + parameter breakdown.
 */
export default function WellnessScoreSheet({
  onBack,
  scoreData,
  loading = false,
  error = null,
  onRetry,
  today = todayDateInIST(),
  dateRange = 'today',
  onDateRangeChange,
  customStartDate = null,
  customEndDate = null,
  onCustomDateSelect,
  historyDays = [],
  selectedDate,
  onSelectDate,
  isMultiDay = false,
}) {
  const dateStr = scoreData?.date || selectedDate || todayDateInIST();
  const parameters = scoreData?.parameters || [];
  const grouped = parametersBySection(parameters);
  const progressPct = scoreData?.percentage ?? 0;
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
            <p className="text-xs text-gray-500">{formatWellnessDayLabel(dateStr, today)}</p>
          </div>
        </div>
        {onDateRangeChange && (
          <div className="border-t border-gray-100 px-4 py-3">
            <ReportDateRangeFilter
              ranges={WELLNESS_SCORE_DATE_RANGES}
              dateRange={dateRange}
              onDateRangeChange={onDateRangeChange}
              customStartDate={customStartDate}
              customEndDate={customEndDate}
              onCustomDateSelect={onCustomDateSelect}
            />
          </div>
        )}
      </header>

      <main className="mx-auto max-w-lg space-y-4 px-4 py-4 pb-28">
        {isMultiDay && historyDays.length > 1 && onSelectDate && (
          <WellnessScoreDayStrip
            days={historyDays}
            selectedDate={selectedDate || dateStr}
            onSelectDate={onSelectDate}
            today={today}
          />
        )}
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
                    {formatWellnessDayLabel(dateStr, today)}&apos;s score
                  </p>
                </div>
              </div>
              <div className="px-4 py-4">
                <p className="text-4xl font-bold tabular-nums leading-none text-gray-900">
                  {earned.toLocaleString()}
                  <span className="text-xl font-semibold text-gray-400">
                    {' '}
                    /
                    {' '}
                    {possible.toLocaleString()}
                  </span>
                </p>
                <p className="mt-1.5 text-sm text-gray-600">
                  Points earned from
                  {' '}
                  <span className="font-semibold text-gray-900">{parameters.length}</span>
                  {' '}
                  active parameters
                </p>
                <div className="mt-4">
                  <div className="mb-1.5 flex justify-between text-[11px] font-medium text-gray-500">
                    <span>Progress</span>
                    <span className="tabular-nums text-gray-700">{Math.round(progressPct)}%</span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r transition-all duration-700 ${scoreTone(progressPct)}`}
                      style={{ width: `${Math.min(100, progressPct)}%` }}
                      role="progressbar"
                      aria-valuenow={Math.round(progressPct)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label="Wellness score progress"
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
                      {sectionEarned}/{sectionMax}
                    </span>
                  </div>
                  <div className="space-y-2 p-3">
                    {block.parameters.map((param) => (
                      <ScoreCategoryRow
                        key={param.key}
                        category={param}
                        goalMode={scoreData?.goalMode}
                      />
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
