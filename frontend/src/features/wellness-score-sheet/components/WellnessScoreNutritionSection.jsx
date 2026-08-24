import React from 'react';
import { Loader2 } from 'lucide-react';
import ScoreCategoryRow from './ScoreCategoryRow';
import ParameterContributionModal from './ParameterContributionModal';
import WellnessScoreMultiDayCarousel from './WellnessScoreMultiDayCarousel';
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
  const showMultiDayCarousel = isMultiDay && historyDays.length > 1;
  // Multi-day ranges show period average only — no per-day picker or day detail cards.
  const showDayDetailCards = !showMultiDayCarousel;

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
      {showMultiDayCarousel && (
        <WellnessScoreMultiDayCarousel
          historyDays={historyDays}
          sections={sections}
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

      {showDayDetailCards && scoreData && sections.map((section) => {
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
        isOpen={showDayDetailCards && !!selectedParam}
        onClose={handleCloseContribution}
        view={contributionView}
        loading={!!selectedParam && needsMeals && mealsLoading}
        error={selectedParam && needsMeals ? mealsError : null}
      />
    </div>
  );
}
