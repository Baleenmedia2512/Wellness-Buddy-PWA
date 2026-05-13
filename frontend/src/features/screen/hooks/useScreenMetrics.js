/**
 * useScreenMetrics.js — pure derivation hook.
 *
 * Takes raw `todayData` + `historyData` and computes the view-model values
 * the UI components need (totals, app buckets, chart bars). No state, no IO.
 */
import { useMemo } from 'react';

export function useScreenMetrics({ todayData, historyData, selectedPeriod } = {}) {
  return useMemo(() => {
    const todaySeconds = todayData?.totalScreenTimeSeconds || 0;
    const appUsage = todayData?.appUsage || [];
    const trackedApps = appUsage.filter((a) => a.isTrackedApp);
    const otherApps = appUsage.filter((a) => !a.isTrackedApp && !a.isSystemApp);
    const avgSeconds = historyData?.summary?.averageSeconds || 0;
    const chartBars = buildChartBars(historyData?.data, selectedPeriod);

    return {
      todaySeconds,
      appUsage,
      trackedApps,
      otherApps,
      avgSeconds,
      chartBars,
      hasChart: chartBars.length > 0 && (selectedPeriod || 0) > 1,
    };
  }, [todayData, historyData, selectedPeriod]);
}

/** Pure: turn the raw history rows into chart-ready bar descriptors. */
function buildChartBars(rawRows, selectedPeriod) {
  if (!Array.isArray(rawRows) || rawRows.length === 0) return [];
  const rows = rawRows
    .filter((r) => r.Date)
    .slice()
    .sort((a, b) => a.Date.localeCompare(b.Date))
    .slice(-Number(selectedPeriod || rawRows.length));
  if (rows.length === 0) return [];

  const maxSeconds = Math.max(
    ...rows.map((r) => r.TotalScreenTimeSeconds || 0),
    1,
  );

  return rows.map((record) => {
    const seconds = record.TotalScreenTimeSeconds || 0;
    return {
      date: record.Date,
      seconds,
      heightPercent: (seconds / maxSeconds) * 100,
      dayLabel: new Date(record.Date + 'T00:00:00')
        .toLocaleDateString('en', { weekday: 'narrow' }),
    };
  });
}
