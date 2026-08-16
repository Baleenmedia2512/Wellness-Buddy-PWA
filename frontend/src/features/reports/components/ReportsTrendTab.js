/**
 * ReportsTrendTab — Diary-style metric cards. Tap a card to open that trend.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  Activity,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Flame,
  Percent,
  Ruler,
} from 'lucide-react';
import DateRangePicker from '../../../shared/components/common/DateRangePicker';
import BathroomScaleIcon from '../../../shared/components/icons/BathroomScaleIcon';
import {
  getFirstAndLatestRecordedValue,
  getWeightHistory,
  WEIGHT_TREND_DEFAULT_DAYS,
  WEIGHT_TREND_RANGE_CUSTOM,
} from '../../weight';
import { fetchBodyParamsCardHistory } from '../../body-parameters-card';
import {
  reportsMemberPossessiveTitle,
  resolveReportsViewedUser,
} from '../utils/reportsViewedMember.js';
import {
  REPORTS_TREND_METRICS,
  formatTrendMetricValue,
  getReportsTrendMetric,
  mergeTrendHistory,
  readTrendMetricValue,
} from '../utils/reportsTrendMetrics.js';
import ReportsWeightTrendChart, {
  ReportsTrendRangeSelector,
} from './ReportsWeightTrendChart';

const METRIC_ICONS = {
  weight: BathroomScaleIcon,
  fatPercent: Percent,
  visceralFat: Activity,
  bmr: Flame,
  bmi: Activity,
  bodyAge: Calendar,
  chestCm: Ruler,
  waistCm: Ruler,
  hipCm: Ruler,
};

function TrendFeedSkeleton() {
  return (
    <div className="space-y-3" data-testid="trend-feed-skeleton">
      {REPORTS_TREND_METRICS.map((metric) => (
        <div
          key={metric.key}
          className="bg-white rounded-xl border border-gray-100 p-3 flex items-center gap-3 animate-pulse"
        >
          <div className="w-12 h-12 bg-gray-200 rounded-lg shrink-0" />
          <div className="flex-1 space-y-2 min-w-0">
            <div className="h-4 w-3/5 bg-gray-200 rounded" />
            <div className="h-3 w-2/5 bg-gray-200 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

function TrendMetricCard({ metric, latestValue, onOpen }) {
  const Icon = METRIC_ICONS[metric.key] || Activity;
  const display = Number.isFinite(latestValue)
    ? formatTrendMetricValue(latestValue, metric.key)
    : '—';
  return (
    <button
      type="button"
      onClick={() => onOpen(metric.key)}
      aria-label={`Open ${metric.noun}`}
      className="w-full min-w-0 text-left bg-white/70 backdrop-blur-xl border border-gray-200/80 rounded-xl shadow-sm p-3 flex items-center gap-3 cursor-pointer hover:shadow-md transition-shadow"
    >
      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center shrink-0">
        <Icon className="w-6 h-6 text-emerald-600" />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-gray-900 truncate">{metric.label}</h4>
        {metric.hint ? (
          <p className="text-xs text-gray-500 truncate">{metric.hint}</p>
        ) : null}
      </div>
      <p className="text-sm font-bold text-gray-900 shrink-0">{display}</p>
      <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" aria-hidden="true" />
    </button>
  );
}

export default function ReportsTrendTab({ user, selectedMember, onRefreshRegister }) {
  const viewedUser = resolveReportsViewedUser(selectedMember, user);
  const viewedUserId = viewedUser?.id || viewedUser?.userId;
  const viewerUserId = user?.id || user?.userId;

  const [openMetricKey, setOpenMetricKey] = useState(null);
  const openMetric = openMetricKey ? getReportsTrendMetric(openMetricKey) : null;
  const title = reportsMemberPossessiveTitle(
    selectedMember,
    openMetric ? openMetric.noun : 'Trend',
  );

  const [weightHistory, setWeightHistory] = useState([]);
  const [cardHistory, setCardHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rangeDays, setRangeDays] = useState(WEIGHT_TREND_DEFAULT_DAYS);
  const [customStartDate, setCustomStartDate] = useState(null);
  const [customEndDate, setCustomEndDate] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const refresh = useCallback(() => {
    setReloadToken((k) => k + 1);
  }, []);

  useEffect(() => {
    setOpenMetricKey(null);
  }, [viewedUserId]);

  useEffect(() => {
    if (typeof onRefreshRegister !== 'function') return undefined;
    onRefreshRegister({ refresh, refreshing: loading });
  }, [onRefreshRegister, refresh, loading]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!viewedUserId) {
        setWeightHistory([]);
        setCardHistory([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      const [weightResult, cardResult] = await Promise.all([
        getWeightHistory(viewedUserId, {
          includeImage: false,
          viewerUserId,
        }),
        fetchBodyParamsCardHistory(viewedUserId, { viewerUserId })
          .catch(() => ({ ok: false, status: 0, data: null })),
      ]);
      if (cancelled) return;
      if (!weightResult.ok || !weightResult.data?.success) {
        setWeightHistory([]);
        setCardHistory([]);
        setError(weightResult.status === 403
          ? 'You do not have permission to view this member.'
          : (weightResult.data?.message || 'Failed to load trend records.'));
        setLoading(false);
        return;
      }
      setWeightHistory(Array.isArray(weightResult.data.data) ? weightResult.data.data : []);
      setCardHistory(cardResult.ok && Array.isArray(cardResult.data?.data)
        ? cardResult.data.data
        : []);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [viewedUserId, viewerUserId, reloadToken]);

  const trendHistory = useMemo(
    () => mergeTrendHistory(weightHistory, cardHistory),
    [weightHistory, cardHistory],
  );

  const latestByMetric = useMemo(() => {
    const map = {};
    REPORTS_TREND_METRICS.forEach((metric) => {
      const { latestValue } = getFirstAndLatestRecordedValue(
        trendHistory,
        (entry) => readTrendMetricValue(entry, metric.key),
      );
      map[metric.key] = latestValue;
    });
    return map;
  }, [trendHistory]);

  const handleRangeSelect = (days) => {
    setRangeDays(days);
    setShowDatePicker(days === WEIGHT_TREND_RANGE_CUSTOM);
  };

  const handleCustomSelect = (start, end) => {
    setCustomStartDate(start);
    setCustomEndDate(end);
    setRangeDays(WEIGHT_TREND_RANGE_CUSTOM);
    setShowDatePicker(false);
  };

  return (
    <div className="max-w-6xl mx-auto w-full px-3 sm:px-4 py-4 min-w-0">
      <div className="flex items-center gap-2 mb-2">
        {openMetric ? (
          <button
            type="button"
            onClick={() => setOpenMetricKey(null)}
            aria-label="Back to trend cards"
            className="p-1.5 rounded-lg hover:bg-gray-100 shrink-0"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
        ) : null}
        <h2 className="flex-1 min-w-0 text-base sm:text-lg font-bold text-gray-900 truncate">
          {title}
        </h2>
      </div>
      {openMetric ? (
        <div className="mb-3 w-full min-w-0">
          <ReportsTrendRangeSelector
            selected={rangeDays}
            onSelect={handleRangeSelect}
            customStartDate={customStartDate}
            customEndDate={customEndDate}
          />
        </div>
      ) : null}

      <AnimatePresence>
        {openMetric && showDatePicker && rangeDays === WEIGHT_TREND_RANGE_CUSTOM && (
          <div className="mb-3 w-full">
            <DateRangePicker
              startDate={customStartDate}
              endDate={customEndDate}
              onSelect={handleCustomSelect}
              onClose={() => setShowDatePicker(false)}
            />
          </div>
        )}
      </AnimatePresence>

      {loading ? (
        <TrendFeedSkeleton />
      ) : error ? (
        <p className="text-sm text-gray-500 py-10 text-center">{error}</p>
      ) : openMetric ? (
        <div className="bg-white rounded-xl border border-gray-100 p-3 sm:p-4 min-w-0 overflow-hidden">
          <ReportsWeightTrendChart
            weightHistory={trendHistory}
            metricKey={openMetric.key}
            rangeDays={rangeDays}
            customStartDate={customStartDate}
            customEndDate={customEndDate}
          />
        </div>
      ) : (
        <div className="space-y-3" data-testid="trend-feed">
          {REPORTS_TREND_METRICS.map((metric) => (
            <TrendMetricCard
              key={metric.key}
              metric={metric}
              latestValue={latestByMetric[metric.key]}
              onOpen={setOpenMetricKey}
            />
          ))}
        </div>
      )}
    </div>
  );
}
