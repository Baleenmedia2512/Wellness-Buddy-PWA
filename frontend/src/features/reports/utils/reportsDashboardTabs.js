/**
 * Reports Dashboard tab ids + default resolution.
 */
export const REPORT_DASHBOARD_TABS = {
  IDEAL_WEIGHT: 'ideal-weight',
  WELLNESS_SCORE: 'wellness-score',
  NUTRITION: 'nutrition',
  TREND: 'trend',
};

export const REPORT_DASHBOARD_TAB_LABELS = {
  [REPORT_DASHBOARD_TABS.IDEAL_WEIGHT]: 'Ideal Weight',
  [REPORT_DASHBOARD_TABS.WELLNESS_SCORE]: 'Wellness Score',
  [REPORT_DASHBOARD_TABS.NUTRITION]: 'Nutrition',
  [REPORT_DASHBOARD_TABS.TREND]: 'Trend',
};

/** Page title for the active Reports Dashboard tab. */
export function getReportsDashboardTitle(tab) {
  return REPORT_DASHBOARD_TAB_LABELS[tab]
    || REPORT_DASHBOARD_TAB_LABELS[REPORT_DASHBOARD_TABS.IDEAL_WEIGHT];
}

/**
 * Default active tab for Reports Dashboard.
 * Ideal Weight is always the default unless a WS deep-link is allowed by flag.
 */
export function resolveReportsDashboardTab(initialTab, wellnessScoreEnabled) {
  if (
    initialTab === REPORT_DASHBOARD_TABS.WELLNESS_SCORE
    && wellnessScoreEnabled
  ) {
    return REPORT_DASHBOARD_TABS.WELLNESS_SCORE;
  }
  if (initialTab === REPORT_DASHBOARD_TABS.NUTRITION) {
    return REPORT_DASHBOARD_TABS.NUTRITION;
  }
  if (initialTab === REPORT_DASHBOARD_TABS.TREND) {
    return REPORT_DASHBOARD_TABS.TREND;
  }
  return REPORT_DASHBOARD_TABS.IDEAL_WEIGHT;
}
