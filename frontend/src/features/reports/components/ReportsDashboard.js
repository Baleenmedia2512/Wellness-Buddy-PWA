/**
 * ReportsDashboard — single reports hub with in-page tabs.
 *
 * Tabs:
 *   1. Ideal Weight (default) — existing DownlineWeightReport
 *   2. Wellness Score Report — existing WellnessScoreReport (ff.wellness-score-sheet)
 *   3. Nutrition — selected member's nutrition (existing dashboard cards/APIs)
 *   4. Trend — selected member's weight history
 *
 * Ideal Weight and Wellness Score stay mounted after first visit so filters
 * survive tab switches. Nutrition and Trend share selectedMember.
 */
import React, { useEffect, useState, startTransition } from 'react';
import { isFlagEnabled } from '../../../config/featureFlags';
import DownlineWeightReport from './DownlineWeightReport';
import WellnessScoreReport from './WellnessScoreReport';
import ReportsMemberSearch from './ReportsMemberSearch';
import ReportsNutritionTab from './ReportsNutritionTab';
import ReportsTrendTab from './ReportsTrendTab';
import {
  REPORT_DASHBOARD_TABS,
  resolveReportsDashboardTab,
} from '../utils/reportsDashboardTabs.js';

export { REPORT_DASHBOARD_TABS } from '../utils/reportsDashboardTabs.js';

function scrollReportsViewportToTop() {
  const scrollBody = document.querySelector('.ios-scroll-body');
  if (scrollBody) {
    scrollBody.scrollTop = 0;
    return;
  }
  window.scrollTo(0, 0);
}

const TAB_BTN = (active) =>
  `flex-1 min-w-0 py-2 sm:py-2.5 rounded-lg text-[11px] sm:text-xs font-semibold transition-all duration-150 cursor-pointer px-1.5 sm:px-2 ${
    active
      ? 'bg-teal-700 text-white shadow-sm'
      : 'text-teal-900 hover:bg-teal-50'
  }`;

export default function ReportsDashboard({
  user,
  userRole,
  tabVisitKey = 0,
  initialTab = REPORT_DASHBOARD_TABS.IDEAL_WEIGHT,
}) {
  const wellnessScoreEnabled = isFlagEnabled('ff.wellness-score-sheet');
  const [activeTab, setActiveTab] = useState(() =>
    resolveReportsDashboardTab(initialTab, wellnessScoreEnabled),
  );
  const [wellnessScoreMounted, setWellnessScoreMounted] = useState(
    () => resolveReportsDashboardTab(initialTab, wellnessScoreEnabled)
      === REPORT_DASHBOARD_TABS.WELLNESS_SCORE,
  );
  const [nutritionMounted, setNutritionMounted] = useState(
    () => resolveReportsDashboardTab(initialTab, wellnessScoreEnabled)
      === REPORT_DASHBOARD_TABS.NUTRITION,
  );
  const [trendMounted, setTrendMounted] = useState(
    () => resolveReportsDashboardTab(initialTab, wellnessScoreEnabled)
      === REPORT_DASHBOARD_TABS.TREND,
  );
  const [selectedMember, setSelectedMember] = useState(null);

  useEffect(() => {
    const next = resolveReportsDashboardTab(initialTab, wellnessScoreEnabled);
    setActiveTab(next);
    if (next === REPORT_DASHBOARD_TABS.WELLNESS_SCORE) setWellnessScoreMounted(true);
    if (next === REPORT_DASHBOARD_TABS.NUTRITION) setNutritionMounted(true);
    if (next === REPORT_DASHBOARD_TABS.TREND) setTrendMounted(true);
  }, [initialTab, wellnessScoreEnabled]);

  const selectTab = (tab) => {
    if (tab === activeTab) return;
    if (tab === REPORT_DASHBOARD_TABS.WELLNESS_SCORE && !wellnessScoreEnabled) {
      return;
    }
    startTransition(() => {
      setActiveTab(tab);
      if (tab === REPORT_DASHBOARD_TABS.WELLNESS_SCORE) setWellnessScoreMounted(true);
      if (tab === REPORT_DASHBOARD_TABS.NUTRITION) setNutritionMounted(true);
      if (tab === REPORT_DASHBOARD_TABS.TREND) setTrendMounted(true);
      scrollReportsViewportToTop();
    });
  };

  const idealActive = activeTab === REPORT_DASHBOARD_TABS.IDEAL_WEIGHT;
  const wellnessActive = activeTab === REPORT_DASHBOARD_TABS.WELLNESS_SCORE;
  const nutritionActive = activeTab === REPORT_DASHBOARD_TABS.NUTRITION;
  const trendActive = activeTab === REPORT_DASHBOARD_TABS.TREND;
  const memberSearchVisible = nutritionActive || trendActive;
  const embeddedStickyClass = memberSearchVisible
    ? 'sticky top-[9.75rem] z-20'
    : 'sticky top-[6.5rem] z-20';

  return (
    <div className="min-h-full bg-gray-50 flex flex-col">
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto w-full px-3 sm:px-4 pt-3 pb-3">
          <h1 className="text-base sm:text-lg font-bold text-gray-900 leading-tight truncate">
            Reports Dashboard
          </h1>

          <div
            className="mt-3 bg-white rounded-xl border border-gray-200 shadow-sm p-1 flex gap-1 w-full"
            role="tablist"
            aria-label="Reports Dashboard tabs"
          >
            <button
              type="button"
              role="tab"
              id="reports-tab-ideal-weight"
              aria-controls="reports-panel-ideal-weight"
              aria-selected={idealActive}
              tabIndex={idealActive ? 0 : -1}
              onClick={() => selectTab(REPORT_DASHBOARD_TABS.IDEAL_WEIGHT)}
              className={TAB_BTN(idealActive)}
            >
              <span className="truncate">Ideal Weight</span>
            </button>
            {wellnessScoreEnabled && (
              <button
                type="button"
                role="tab"
                id="reports-tab-wellness-score"
                aria-controls="reports-panel-wellness-score"
                aria-selected={wellnessActive}
                tabIndex={wellnessActive ? 0 : -1}
                onClick={() => selectTab(REPORT_DASHBOARD_TABS.WELLNESS_SCORE)}
                className={TAB_BTN(wellnessActive)}
              >
                <span className="truncate">Wellness Score</span>
              </button>
            )}
            <button
              type="button"
              role="tab"
              id="reports-tab-nutrition"
              aria-controls="reports-panel-nutrition"
              aria-selected={nutritionActive}
              tabIndex={nutritionActive ? 0 : -1}
              onClick={() => selectTab(REPORT_DASHBOARD_TABS.NUTRITION)}
              className={TAB_BTN(nutritionActive)}
            >
              <span className="truncate">Nutrition</span>
            </button>
            <button
              type="button"
              role="tab"
              id="reports-tab-trend"
              aria-controls="reports-panel-trend"
              aria-selected={trendActive}
              tabIndex={trendActive ? 0 : -1}
              onClick={() => selectTab(REPORT_DASHBOARD_TABS.TREND)}
              className={TAB_BTN(trendActive)}
            >
              <span className="truncate">Trend</span>
            </button>
          </div>

          {memberSearchVisible && (
            <div className="mt-3">
              <ReportsMemberSearch
                user={user}
                userRole={userRole}
                selectedMember={selectedMember}
                onMemberSelect={setSelectedMember}
              />
            </div>
          )}
        </div>
      </div>

      <div
        id="reports-panel-ideal-weight"
        role="tabpanel"
        aria-labelledby="reports-tab-ideal-weight"
        hidden={!idealActive}
        className={idealActive ? undefined : 'hidden'}
      >
        <DownlineWeightReport
          user={user}
          tabVisitKey={tabVisitKey}
          hidePageTitle
          embeddedStickyClass={embeddedStickyClass}
        />
      </div>

      {wellnessScoreEnabled && wellnessScoreMounted && (
        <div
          id="reports-panel-wellness-score"
          role="tabpanel"
          aria-labelledby="reports-tab-wellness-score"
          hidden={!wellnessActive}
          className={wellnessActive ? undefined : 'hidden'}
        >
          <WellnessScoreReport
            user={user}
            tabVisitKey={tabVisitKey}
            hidePageTitle
            embeddedStickyClass={embeddedStickyClass}
          />
        </div>
      )}

      {nutritionMounted && (
        <div
          id="reports-panel-nutrition"
          role="tabpanel"
          aria-labelledby="reports-tab-nutrition"
          hidden={!nutritionActive}
          className={nutritionActive ? undefined : 'hidden'}
        >
          <ReportsNutritionTab user={user} selectedMember={selectedMember} />
        </div>
      )}

      {trendMounted && (
        <div
          id="reports-panel-trend"
          role="tabpanel"
          aria-labelledby="reports-tab-trend"
          hidden={!trendActive}
          className={trendActive ? undefined : 'hidden'}
        >
          <ReportsTrendTab user={user} selectedMember={selectedMember} />
        </div>
      )}
    </div>
  );
}
