/**
 * Run: node --test frontend/src/features/reports/utils/__tests__/reportsDashboardTabs.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  REPORT_DASHBOARD_TABS,
  resolveReportsDashboardTab,
} from '../reportsDashboardTabs.js';

describe('resolveReportsDashboardTab', () => {
  it('defaults to Ideal Weight', () => {
    assert.equal(
      resolveReportsDashboardTab(undefined, true),
      REPORT_DASHBOARD_TABS.IDEAL_WEIGHT,
    );
    assert.equal(
      resolveReportsDashboardTab(REPORT_DASHBOARD_TABS.IDEAL_WEIGHT, true),
      REPORT_DASHBOARD_TABS.IDEAL_WEIGHT,
    );
  });

  it('opens Wellness Score when requested and flag-enabled', () => {
    assert.equal(
      resolveReportsDashboardTab(REPORT_DASHBOARD_TABS.WELLNESS_SCORE, true),
      REPORT_DASHBOARD_TABS.WELLNESS_SCORE,
    );
  });

  it('falls back to Ideal Weight when WS flag is off', () => {
    assert.equal(
      resolveReportsDashboardTab(REPORT_DASHBOARD_TABS.WELLNESS_SCORE, false),
      REPORT_DASHBOARD_TABS.IDEAL_WEIGHT,
    );
  });
});
