/**
 * ReportsWeightTrendChart — one metric's recorded points for a date range.
 * Parent (Trend tab) owns range + stacks one card per metric, like Diary.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatCustomRangeLabel } from '../../../shared/domain/reportDateRanges';
import {
  buildChartGeometry,
  buildRecordedTrendSeries,
  getFirstAndLatestRecordedValue,
  isSmallChartDevice,
  REPORTS_WEIGHT_TREND_RANGES,
  WEIGHT_TREND_RANGE_CUSTOM,
} from '../../weight';
import {
  REPORTS_TREND_DEFAULT_METRIC,
  firstToCurrentMetricLabel,
  formatTrendMetricValue,
  getReportsTrendMetric,
  readTrendMetricValue,
} from '../utils/reportsTrendMetrics.js';

const PILL = 'min-w-0 px-1 py-1.5 text-[10px] xs:text-[11px] sm:text-xs font-semibold rounded-full transition-all duration-300 truncate';
const ACTIVE = 'bg-emerald-500 text-white shadow-sm';
const INACTIVE = 'text-gray-600 hover:bg-white';

const RANGE_SHORT_LABEL = {
  5: '5D',
  10: '10D',
  30: '1M',
  365: '1Y',
  [WEIGHT_TREND_RANGE_CUSTOM]: 'Custom',
};

export function ReportsTrendRangeSelector({
  selected,
  onSelect,
  customStartDate,
  customEndDate,
}) {
  return (
    <div className="grid grid-cols-5 items-center gap-1 bg-gray-100 rounded-full p-1 w-full min-w-0">
      {REPORTS_WEIGHT_TREND_RANGES.map((range) => {
        const isCustom = range.days === WEIGHT_TREND_RANGE_CUSTOM;
        const isActive = selected === range.days;
        const longLabel = isCustom && isActive
          ? formatCustomRangeLabel(customStartDate, customEndDate)
          : range.label;
        const shortLabel = isCustom && isActive
          ? (longLabel || RANGE_SHORT_LABEL[range.key])
          : RANGE_SHORT_LABEL[range.key];
        return (
          <button
            key={String(range.key)}
            type="button"
            onClick={() => onSelect(range.days)}
            className={`${PILL} ${isActive ? ACTIVE : INACTIVE}`}
            title={longLabel}
          >
            <span className="sm:hidden">{shortLabel}</span>
            <span className="hidden sm:inline">{longLabel}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function ReportsWeightTrendChart({
  weightHistory,
  metricKey = REPORTS_TREND_DEFAULT_METRIC,
  rangeDays,
  customStartDate = null,
  customEndDate = null,
}) {
  const chartRef = useRef(null);
  const [chartWidth, setChartWidth] = useState(320);
  const [tooltip, setTooltip] = useState(null);
  const small = isSmallChartDevice();
  const isCustom = rangeDays === WEIGHT_TREND_RANGE_CUSTOM;
  const hasCustomDates = Boolean(customStartDate && customEndDate);
  const metric = getReportsTrendMetric(metricKey);
  const gradientId = `reportsTrendArea-${metric.key}`;
  const valueOf = useCallback(
    (entry) => readTrendMetricValue(entry, metric.key),
    [metric.key],
  );

  const { firstValue, latestValue } = useMemo(
    () => getFirstAndLatestRecordedValue(weightHistory, valueOf),
    [weightHistory, valueOf],
  );

  const series = useMemo(
    () => buildRecordedTrendSeries(weightHistory, rangeDays, {
      startDate: customStartDate,
      endDate: customEndDate,
    }, { getValue: valueOf }),
    [weightHistory, rangeDays, customStartDate, customEndDate, valueOf],
  );
  const geom = useMemo(
    () => (series.length
      ? buildChartGeometry(series, chartWidth, {
        maxMarkers: series.length,
        maxDateLabels: 7,
        plotAllPoints: true,
      })
      : null),
    [series, chartWidth],
  );

  useEffect(() => {
    const node = chartRef.current;
    if (!node) return undefined;
    const update = () => {
      const w = Math.floor(node.clientWidth || 0);
      setChartWidth((prev) => (prev === w ? prev : w));
    };
    update();
    if (typeof ResizeObserver !== 'undefined') {
      const obs = new ResizeObserver(update);
      obs.observe(node);
      return () => obs.disconnect();
    }
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [series.length]);

  useEffect(() => {
    setTooltip(null);
  }, [metric.key]);

  const showPoint = (point, event) => {
    if (!point?.hasRecorded || !Number.isFinite(point.value)) return;
    const rect = chartRef.current?.getBoundingClientRect();
    const clientX = event.clientX ?? event.touches?.[0]?.clientX;
    setTooltip({
      value: point.value,
      dateLabel: point.tooltipDate || point.label,
      x: rect && Number.isFinite(clientX) ? clientX - rect.left : point.x,
    });
  };

  const hideTooltip = () => setTooltip(null);

  const emptyMessage = isCustom && !hasCustomDates
    ? 'Select a date range to view the trend.'
    : series.length === 0 && Number.isFinite(firstValue)
      ? `No ${metric.label} records available for this period.`
      : `No ${metric.label} records available for this user.`;

  return (
    <div className="min-w-0">
      <p className="text-xs sm:text-sm text-gray-500 mb-2 break-words">
        {firstToCurrentMetricLabel(firstValue, latestValue, metric.key)}
      </p>
      {series.length === 0 ? (
        <div className="h-36 rounded-xl border border-dashed border-gray-200 flex items-center justify-center text-sm text-gray-500 px-4 text-center">
          {emptyMessage}
        </div>
      ) : (
        <div
          ref={chartRef}
          className="relative w-full min-w-0 overflow-hidden pb-1"
          onMouseLeave={hideTooltip}
        >
          {tooltip && (
            <div
              className="absolute z-10 -translate-x-1/2 pointer-events-none rounded-lg bg-gray-900 text-white px-2.5 py-1.5 text-center shadow-lg"
              style={{ left: tooltip.x, top: 0 }}
            >
              <p className="text-xs font-semibold">{formatTrendMetricValue(tooltip.value, metric.key)}</p>
              <p className="text-[10px] text-gray-300">{tooltip.dateLabel}</p>
            </div>
          )}
          <svg
            viewBox={`0 -24 ${geom.chartWidth} ${geom.chartHeight + 52}`}
            className="block"
            style={{ width: '100%', height: `${geom.chartHeight + 52}px`, overflow: 'visible' }}
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#16a34a" stopOpacity="0.16" />
                <stop offset="100%" stopColor="#16a34a" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            <path
              d={geom.linePath}
              fill="none"
              stroke="#16a34a"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {geom.points.map((p) => (p.hasValue ? (
              <circle
                key={`pt-${p.key}`}
                cx={p.x}
                cy={p.y}
                r={small ? 4 : 5}
                fill="#16a34a"
                className="cursor-pointer"
                onMouseEnter={(e) => showPoint(p, e)}
                onClick={(e) => showPoint(p, e)}
                onTouchStart={(e) => showPoint(p, e)}
              />
            ) : null))}
            {geom.axisLevels.map((level, i) => {
              const y = geom.plotTopPad + geom.plottableHeight
                - ((level - geom.minValue) / geom.spread) * geom.plottableHeight;
              return (
                <text
                  key={`axis-${i}`}
                  x={0}
                  y={y + 3}
                  textAnchor="start"
                  fontSize={small ? 7 : 8}
                  fontWeight="500"
                  fill="#94a3b8"
                >
                  {Number(level).toFixed(metric.decimals)}
                </text>
              );
            })}
          </svg>
          <div
            className={`relative mt-1 h-4 text-gray-500 ${small ? 'text-[8px]' : 'text-[10px] md:text-xs'}`}
            style={{ width: '100%' }}
          >
            {geom.points.map((p, i) => {
              if (!geom.dateLabelIndices.has(i)) return null;
              const transform = i === geom.firstDateLabelIndex
                ? 'translateX(0)'
                : i === geom.lastDateLabelIndex
                  ? 'translateX(-100%)'
                  : 'translateX(-50%)';
              return (
                <span
                  key={`${p.key}-label`}
                  className="absolute whitespace-nowrap"
                  style={{ left: `${(p.x / geom.chartWidth) * 100}%`, transform }}
                >
                  {p.label}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
