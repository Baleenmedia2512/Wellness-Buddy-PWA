import React, { useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import ScoreCategoryRow from './ScoreCategoryRow';
import ParameterContributionModal from './ParameterContributionModal';
import WellnessScoreDayStrip from './WellnessScoreDayStrip';
import { getParameterMeta, PARAMETER_SECTIONS } from '../domain/parameterRegistry';
import { getSectionIcon } from '../domain/parameterIcons';
import { useTimeWindows } from '../hooks/useTimeWindows';
import { useParameterContribution } from '../hooks/useParameterContribution';
import { useWellnessScoreHistory } from '../hooks/useWellnessScoreHistory';

/** Sections shown on the Reports Nutrition tab (nutrition + progress). */
const REPORTS_NUTRITION_SECTIONS = PARAMETER_SECTIONS.filter(
  (s) => s.id === 'nutrition' || s.id === 'progress',
);

/**
 * Compute per-parameter averages across all history days.
 * Returns a map: { [paramKey]: { label, earnedAvg, maxPoints, avgPct } }
 * Only parameters that appear in at least one day are included.
 */
function computeParamAverages(historyDays) {
  if (!historyDays || historyDays.length < 2) return {};

  const totals = {};
  const counts = {};

  for (const day of historyDays) {
    for (const param of day.parameters || []) {
      const key = param.key;
      if (!key) continue;
      if (!totals[key]) {
        totals[key] = { label: param.label || key, earnedSum: 0, maxPoints: param.maxPoints ?? 0 };
        counts[key] = 0;
      }
      totals[key].earnedSum += param.earnedPoints ?? 0;
      // maxPoints is constant per parameter — keep the latest non-zero value
      if (param.maxPoints > 0) totals[key].maxPoints = param.maxPoints;
      counts[key] += 1;
    }
  }

  const result = {};
  for (const key of Object.keys(totals)) {
    const { label, earnedSum, maxPoints } = totals[key];
    const n = counts[key];
    const earnedAvg = n > 0 ? earnedSum / n : 0;
    const avgPct = maxPoints > 0 ? Math.min(100, Math.round((earnedAvg / maxPoints) * 100)) : 0;
    result[key] = { label, earnedAvg: Math.round(earnedAvg * 10) / 10, maxPoints, avgPct };
  }
  return result;
}

function avgBarTone(pct) {
  if (pct >= 100) return 'bg-emerald-500';
  if (pct >= 50) return 'bg-amber-500';
  if (pct > 0) return 'bg-orange-400';
  return 'bg-gray-300';
}

/**
 * Avg summary card shown above the day strip when Last 7 Days (or any multi-day
 * range with ≥2 days loaded) is selected.
 */
function MultiDayAvgSection({ historyDays, sections }) {
  const avgByKey = useMemo(
    () => computeParamAverages(historyDays),
    [historyDays],
  );

  const dayCount = historyDays.length;

  // Build the same section structure but using averaged values
  const avgSections = sections
    .map((section) => {
      const parameters = section.parameters
        .map((p) => avgByKey[p.key])
        .filter(Boolean);
      return { ...section, parameters };
    })
    .filter((s) => s.parameters.length > 0);

  if (!avgSections.length) return null;

  return (
    <section className="overflow-hidden rounded-2xl border-2 border-emerald-200 bg-emerald-50/60 shadow-sm">
      <div className="flex items-center justify-between border-b border-emerald-100 bg-emerald-100/70 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-emerald-700" aria-hidden>📊</span>
          <h2 className="text-xs font-bold uppercase tracking-wide text-emerald-800">
            Average — Last {dayCount} Days
          </h2>
        </div>
        <span className="rounded-full bg-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
          {dayCount} days
        </span>
      </div>

      {avgSections.map((section) => (
        <div key={section.id} className="space-y-2 p-3">
          {section.parameters.map(({ label, earnedAvg, maxPoints, avgPct }) => (
            <div
              key={label}
              className="rounded-xl border border-emerald-100 bg-white px-3.5 py-3 shadow-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-gray-900 truncate">{label}</p>
                <p className="shrink-0 text-sm font-bold tabular-nums text-gray-900">
                  {earnedAvg % 1 === 0 ? earnedAvg : earnedAvg.toFixed(1)}
                  <span className="font-medium text-gray-400">/{maxPoints}</span>
                  <span className="ml-1.5 text-[11px] font-medium text-emerald-700">{avgPct}%</span>
                </p>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${avgBarTone(avgPct)}`}
                  style={{ width: `${avgPct}%` }}
                  role="progressbar"
                  aria-valuenow={avgPct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${label} average progress`}
                />
              </div>
              <p className="mt-1 text-[10px] text-gray-400">avg pts/day over {dayCount} days</p>
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}

/**
 * Nutrition + Progress parameter lists — same cards as Wellness Score sheet.
 * One stacked card per parameter: badge, today status, points, Details, progress bar.
 */
export default function WellnessScoreNutritionSection({
  user,
  apiBaseUrl,
  date,
  startDate,
  endDate,
  isMultiDay = false,
  onSelectDate,
  today,
  viewerUserId = null,
  nutritionRefreshKey = 0,
}) {
  const { loading, error, historyDays, data: scoreData, reload } = useWellnessScoreHistory({
    user,
    apiBaseUrl,
    startDate: startDate || date,
    endDate: endDate || date,
    selectedDate: date,
    nutritionRefreshKey,
    persistSnapshot: false,
  });
  const timeWindows = useTimeWindows();
  const userId = scoreData?.userId || user?.id || user?.userId || null;
  const dateStr = scoreData?.date || date;

  const {
    selectedParam,
    contributionView,
    mealsLoading,
    mealsError,
    handleOpenContribution,
    handleCloseContribution,
    needsMeals,
  } = useParameterContribution({
    userId,
    dateStr,
    apiBaseUrl,
    nutritionRefreshKey,
    timeWindows,
    viewerUserId,
  });

  const sections = REPORTS_NUTRITION_SECTIONS.map((section) => {
    const parameters = (scoreData?.parameters || []).filter(
      (p) => getParameterMeta(p.key)?.section === section.id,
    );
    return {
      ...section,
      parameters,
      earned: parameters.reduce((s, p) => s + (p.earnedPoints ?? 0), 0),
      max: parameters.reduce((s, p) => s + (p.maxPoints ?? 0), 0),
    };
  }).filter((section) => section.parameters.length > 0);

  const hasAnyParams = sections.length > 0;

  return (
    <div className="space-y-3">
      {isMultiDay && historyDays.length > 1 && (
        <MultiDayAvgSection historyDays={historyDays} sections={sections} />
      )}

      {isMultiDay && historyDays.length > 1 && onSelectDate && (
        <WellnessScoreDayStrip
          days={historyDays}
          selectedDate={date}
          onSelectDate={onSelectDate}
          today={today}
        />
      )}

      {loading && !scoreData && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" aria-label="Loading nutrition score" />
        </div>
      )}

      {error && !scoreData && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
          <p className="text-sm text-red-700">{error}</p>
          {reload && (
            <button
              type="button"
              onClick={reload}
              className="mt-2 text-sm font-semibold text-red-800 underline"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {!loading && !error && !scoreData && (
        <p className="text-sm text-gray-500 py-10 text-center">
          No nutrition score data available for this user.
        </p>
      )}

      {scoreData && !hasAnyParams && (
        <p className="text-sm text-gray-500 py-10 text-center">
          No nutrition score data available for this user.
        </p>
      )}

      {scoreData && sections.map((section) => {
        const SectionIcon = getSectionIcon(section.id);
        const showHeader = section.id === 'progress';

        return (
          <section
            key={section.id}
            className="overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-sm"
          >
            {showHeader && (
              <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/80 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <SectionIcon className="h-4 w-4 text-emerald-600" aria-hidden />
                  <h2 className="text-xs font-bold uppercase tracking-wide text-gray-700">
                    {section.label}
                  </h2>
                </div>
                <span className="text-xs font-semibold tabular-nums text-gray-600">
                  {Math.round(section.earned)}/{Math.round(section.max)}
                </span>
              </div>
            )}
            <div className="space-y-2 p-3">
              {section.parameters.map((param) => (
                <ScoreCategoryRow
                  key={param.key}
                  category={param}
                  goalMode={scoreData?.goalMode}
                  timeWindows={timeWindows}
                  onOpenContribution={handleOpenContribution}
                />
              ))}
            </div>
          </section>
        );
      })}

      <ParameterContributionModal
        isOpen={!!selectedParam}
        onClose={handleCloseContribution}
        view={contributionView}
        loading={!!selectedParam && needsMeals && mealsLoading}
        error={selectedParam && needsMeals ? mealsError : null}
      />
    </div>
  );
}
