/**
 * Reports Dashboard tab ids + default resolution.
 */
export const REPORT_DASHBOARD_TABS = {
  IDEAL_WEIGHT: 'ideal-weight',
  WELLNESS_SCORE: 'wellness-score',
  NUTRITION: 'nutrition',
  TREND: 'trend',
};

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
