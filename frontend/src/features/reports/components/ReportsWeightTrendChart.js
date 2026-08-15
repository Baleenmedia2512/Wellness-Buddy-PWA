/**
 * ReportsWeightTrendChart — recorded weigh-ins with 5 days / 10 days /
 * 1 month / 1 year / Custom date, plus first→current weight. Reuses
 * weight chart geometry; does not change the Home Weight Dashboard
 * 7D/14D/30D chart.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import DateRangePicker from '../../../shared/components/common/DateRangePicker';
import { formatCustomRangeLabel } from '../../../shared/domain/reportDateRanges';
import {
  buildChartGeometry,
  buildRecordedTrendSeries,
  getFirstAndLatestRecordedWeight,
  isSmallChartDevice,
  REPORTS_WEIGHT_TREND_RANGES,
  WEIGHT_TREND_RANGE_CUSTOM,
} from '../../weight';

const PILL = 'px-2 py-1 text-[11px] sm:text-xs rounded-full transition-all duration-300 shrink-0';
const ACTIVE = 'bg-emerald-500 text-white shadow-sm';
const INACTIVE = 'text-gray-600 hover:bg-white';

function RangeSelector({
  selected,
  onSelect,
  customStartDate,
  customEndDate,
}) {
  return (
    <div className="flex items-center gap-1 bg-gray-100 rounded-full p-1 overflow-x-auto">
      {REPORTS_WEIGHT_TREND_RANGES.map((range) => {
        const isCustom = range.days === WEIGHT_TREND_RANGE_CUSTOM;
        const isActive = selected === range.days;
        const label = isCustom && isActive
          ? formatCustomRangeLabel(customStartDate, customEndDate)
          : range.label;
        return (
          <button
            key={String(range.key)}
            type="button"
            onClick={() => onSelect(range.days)}
            className={`${PILL} ${isActive ? ACTIVE : INACTIVE}`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function formatKg(value) {
  return Number.isFinite(value) ? `${value.toFixed(2)} kg` : '';
}

function firstToCurrentLabel(firstWeight, latestWeight) {
  if (!Number.isFinite(firstWeight) || !Number.isFinite(latestWeight)) {
    return 'First weight → Current weight';
  }
  return `First ${formatKg(firstWeight)} → Current ${formatKg(latestWeight)}`;
}

export default function ReportsWeightTrendChart({
  weightHistory,
  rangeDays,
  onRangeChange,
  customStartDate = null,
  customEndDate = null,
  onCustomDateSelect,
}) {
  const chartRef = useRef(null);
  const [chartWidth, setChartWidth] = useState(320);
  const [tooltip, setTooltip] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const small = isSmallChartDevice();
  const isCustom = rangeDays === WEIGHT_TREND_RANGE_CUSTOM;
  const hasCustomDates = Boolean(customStartDate && customEndDate);

  const { firstWeight, latestWeight } = useMemo(
    () => getFirstAndLatestRecordedWeight(weightHistory),
    [weightHistory],
  );

  const series = useMemo(
    () => buildRecordedTrendSeries(weightHistory, rangeDays, {
      startDate: customStartDate,
      endDate: customEndDate,
    }),
    [weightHistory, rangeDays, customStartDate, customEndDate],
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

  const handleRangeSelect = (days) => {
    onRangeChange(days);
    setShowDatePicker(days === WEIGHT_TREND_RANGE_CUSTOM);
  };

  const handleCustomSelect = (start, end) => {
    if (typeof onCustomDateSelect === 'function') onCustomDateSelect(start, end);
    setShowDatePicker(false);
  };

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
    : series.length === 0 && Number.isFinite(firstWeight)
      ? 'No weight records available for this period.'
      : 'No weight records available for this user.';

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
        <p className="text-xs sm:text-sm text-gray-500">
          {firstToCurrentLabel(firstWeight, latestWeight)}
        </p>
        <RangeSelector
          selected={rangeDays}
          onSelect={handleRangeSelect}
          customStartDate={customStartDate}
          customEndDate={customEndDate}
        />
      </div>

      <AnimatePresence>
        {showDatePicker && isCustom && (
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

      {series.length === 0 ? (
        <div className="h-36 rounded-xl border border-dashed border-gray-200 flex items-center justify-center text-sm text-gray-500">
          {emptyMessage}
        </div>
      ) : (
        <div
          ref={chartRef}
          className="relative w-full overflow-visible pb-1"
          onMouseLeave={hideTooltip}
        >
          {tooltip && (
            <div
              className="absolute z-10 -translate-x-1/2 pointer-events-none rounded-lg bg-gray-900 text-white px-2.5 py-1.5 text-center shadow-lg"
              style={{ left: tooltip.x, top: 0 }}
            >
              <p className="text-xs font-semibold">{formatKg(tooltip.value)}</p>
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
              <linearGradient id="reportsWeightTrendArea" x1="0" y1="0" x2="0" y2="1">
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
                  {level.toFixed(1)}
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
