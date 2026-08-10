/**
 * ReportsDashboard — single reports hub with in-page tabs.
 *
 * Tabs:
 *   1. Ideal Weight (default) — existing DownlineWeightReport
 *   2. Wellness Score Report — existing WellnessScoreReport (ff.wellness-score-sheet)
 *
 * Both panels stay mounted after first visit so filters/pagination survive tab switches.
 */
import React, { useEffect, useState, startTransition } from 'react';
import { isFlagEnabled } from '../../../config/featureFlags';
import DownlineWeightReport from './DownlineWeightReport';
import WellnessScoreReport from './WellnessScoreReport';
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

export default function ReportsDashboard({
  user,
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

  // Honour legacy deep-links / parent remounts that request the WS tab.
  useEffect(() => {
    const next = resolveReportsDashboardTab(initialTab, wellnessScoreEnabled);
    setActiveTab(next);
    if (next === REPORT_DASHBOARD_TABS.WELLNESS_SCORE) {
      setWellnessScoreMounted(true);
    }
  }, [initialTab, wellnessScoreEnabled]);

  const selectTab = (tab) => {
    if (tab === activeTab) return;
    if (tab === REPORT_DASHBOARD_TABS.WELLNESS_SCORE && !wellnessScoreEnabled) {
      return;
    }
    startTransition(() => {
      setActiveTab(tab);
      if (tab === REPORT_DASHBOARD_TABS.WELLNESS_SCORE) {
        setWellnessScoreMounted(true);
      }
      scrollReportsViewportToTop();
    });
  };

  const showTabBar = wellnessScoreEnabled;
  const idealActive = activeTab === REPORT_DASHBOARD_TABS.IDEAL_WEIGHT;
  const wellnessActive = activeTab === REPORT_DASHBOARD_TABS.WELLNESS_SCORE;
  // Keep toolbars under the sticky "Reports Dashboard" chrome (title ± tab bar).
  const embeddedStickyClass = showTabBar
    ? 'sticky top-[6.5rem] z-20'
    : 'sticky top-[3.25rem] z-20';

  return (
    <div className="min-h-full bg-gray-50 flex flex-col">
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto w-full px-3 sm:px-4 pt-3 pb-3">
          <h1 className="text-base sm:text-lg font-bold text-gray-900 leading-tight truncate">
            Reports Dashboard
          </h1>

          {showTabBar && (
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
                className={`flex-1 min-w-0 py-2 sm:py-2.5 rounded-lg text-[11px] sm:text-xs font-semibold transition-all duration-150 cursor-pointer px-2 ${
                  idealActive
                    ? 'bg-teal-700 text-white shadow-sm'
                    : 'text-teal-900 hover:bg-teal-50'
                }`}
              >
                <span className="truncate">Ideal Weight</span>
              </button>
              <button
                type="button"
                role="tab"
                id="reports-tab-wellness-score"
                aria-controls="reports-panel-wellness-score"
                aria-selected={wellnessActive}
                tabIndex={wellnessActive ? 0 : -1}
                onClick={() => selectTab(REPORT_DASHBOARD_TABS.WELLNESS_SCORE)}
                className={`flex-1 min-w-0 py-2 sm:py-2.5 rounded-lg text-[11px] sm:text-xs font-semibold transition-all duration-150 cursor-pointer px-2 ${
                  wellnessActive
                    ? 'bg-teal-700 text-white shadow-sm'
                    : 'text-teal-900 hover:bg-teal-50'
                }`}
              >
                <span className="hidden sm:inline truncate">Wellness Score Report</span>
                <span className="sm:hidden truncate">Wellness Score</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <div
        id="reports-panel-ideal-weight"
        role={showTabBar ? 'tabpanel' : undefined}
        aria-labelledby={showTabBar ? 'reports-tab-ideal-weight' : undefined}
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
    </div>
  );
}
