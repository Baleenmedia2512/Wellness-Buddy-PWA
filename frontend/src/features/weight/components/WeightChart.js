/**
 * WeightChart.js — pure SVG renderer for the weight trend slide.
 *
 * Includes the period selector (7D/14D/30D), the Average / Direction /
 * Net Change tiles, the line + marker chart with axis labels, the date
 * label row, and the Latest / Avg footer. Geometry comes from
 * `weightChartGeometry`, summary from `summarizeTrendSeries`.
 */
import React from 'react';
import { WeightTrendRangeSelector } from './WeightActions';
import { buildChartGeometry } from '../services/weightChartGeometry';
import { isSmallChartDevice, summarizeTrendSeries } from '../services/weightDashboardFormatter';

const TrendStats = ({ avgValue, deltaValue, trendStatus }) => (
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
    <div className="rounded-lg bg-sky-50 px-2 py-1.5">
      <p className="text-[10px] text-sky-700">Average</p>
      <p className="text-xs md:text-sm font-semibold text-sky-900">
        {Number.isFinite(avgValue) ? avgValue.toFixed(1) : '-'} kg
      </p>
    </div>
    <div className={`rounded-lg px-2 py-1.5 ${trendStatus.className}`}>
      <p className="text-[10px]">Direction</p>
      <p className="text-xs md:text-sm font-semibold">{trendStatus.label}</p>
    </div>
    <div className="rounded-lg bg-indigo-50 px-2 py-1.5">
      <p className="text-[10px] text-indigo-700">Net Change</p>
      <p className="text-xs md:text-sm font-semibold text-indigo-900">
        {Number.isFinite(deltaValue) ? `${deltaValue > 0 ? '+' : ''}${deltaValue.toFixed(1)} kg` : '-'}
      </p>
    </div>
  </div>
);

const ChartSvg = ({ geom, small }) => {
  const {
    chartWidth, chartHeight, points, axisLevels, linePath,
    plotTopPad, plottableHeight, minValue, spread,
    firstVisibleIndex, lastVisibleIndex, dateLabelIndices,
    firstDateLabelIndex, lastDateLabelIndex, shouldRenderMarker,
  } = geom;
  return (
    <>
      <svg
        viewBox={`0 -24 ${chartWidth} ${chartHeight + 52}`}
        className="block"
        style={{ width: '100%', height: `${chartHeight + 52}px`, overflow: 'visible' }}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="weightTrendArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#16a34a" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#16a34a" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={linePath} fill="none" stroke="#16a34a" strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (shouldRenderMarker(p, i) && p.hasValue ? (
          <circle key={`weight-point-${p.key}`} cx={p.x} cy={p.y}
            r={small ? 2.8 : 3.4}
            fill={p.hasRecorded ? '#16a34a' : '#ffffff'}
            stroke="#16a34a" strokeWidth={p.hasRecorded ? 0 : 1.2} />
        ) : null))}
        {axisLevels.map((level, i) => {
          const y = plotTopPad + plottableHeight - ((level - minValue) / spread) * plottableHeight;
          return (
            <text key={`weight-axis-${i}`} x={0} y={y + 3} textAnchor="start"
              fontSize={small ? 7 : 8} fontWeight="500" fill="#94a3b8">
              {level.toFixed(1)}
            </text>
          );
        })}
        {points.map((p, i) => {
          if (!shouldRenderMarker(p, i) || !p.hasRecorded) return null;
          const isFirst = i === firstVisibleIndex;
          const isLast = i === lastVisibleIndex;
          const textAnchor = isFirst ? 'start' : isLast ? 'end' : 'middle';
          const labelX = isFirst ? p.x + 4 : isLast ? p.x - 4 : p.x;
          const labelY = Math.max(p.y - 14, -16);
          return (
            <text key={`${p.key}-value`} x={labelX}
              y={small ? Math.max(p.y - 12, -16) : labelY}
              textAnchor={textAnchor} fontSize={small ? 7 : 9}
              fontWeight="600" fill="#9ca3af">
              {`${p.value.toFixed(1)} kg`}
            </text>
          );
        })}
      </svg>
      <div
        className={`relative mt-2 h-4 text-gray-500 ${small ? 'text-[8px]' : 'text-[10px] md:text-xs'}`}
        style={{ width: '100%' }}
      >
        {points.map((p, i) => {
          if (!dateLabelIndices.has(i)) return null;
          const transform = i === firstDateLabelIndex ? 'translateX(0)'
            : i === lastDateLabelIndex ? 'translateX(-100%)' : 'translateX(-50%)';
          return (
            <span key={`${p.key}-label`} className="absolute whitespace-nowrap"
              style={{ left: `${(p.x / chartWidth) * 100}%`, transform }}>
              {p.label}
            </span>
          );
        })}
      </div>
    </>
  );
};

const WeightChart = ({
  trendRef, chartRef, weightTrendSeries, weightTrendChartWidth,
  weightTrendRangeDays, setWeightTrendRangeDays,
}) => {
  const { latestValue, avgValue, deltaValue, trendStatus } = summarizeTrendSeries(weightTrendSeries);
  const hasData = weightTrendSeries.filter((p) => Number.isFinite(p.value)).length > 0;
  const small = isSmallChartDevice();

  return (
    <div ref={trendRef} className="w-1/2 shrink-0 px-4 md:px-5 pb-4 md:pb-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs md:text-sm text-gray-500">Weight Trend</p>
          <p className="text-sm md:text-base font-semibold text-gray-900">Last {weightTrendRangeDays} days</p>
        </div>
        <WeightTrendRangeSelector
          selectedDays={weightTrendRangeDays} onSelect={setWeightTrendRangeDays} />
      </div>
      <TrendStats avgValue={avgValue} deltaValue={deltaValue} trendStatus={trendStatus} />
      {!hasData ? (
        <div className="h-36 rounded-xl border border-dashed border-gray-200 flex items-center justify-center text-sm text-gray-500">
          No weight trend data
        </div>
      ) : (
        <>
          <div ref={chartRef} className="w-full overflow-hidden pb-1">
            <ChartSvg geom={buildChartGeometry(weightTrendSeries, weightTrendChartWidth)} small={small} />
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-gray-600">
            <span>Latest: {Number.isFinite(latestValue) ? latestValue.toFixed(1) : '-'} kg</span>
            <span>Avg: {Number.isFinite(avgValue) ? avgValue.toFixed(1) : '-'} kg</span>
          </div>
        </>
      )}
    </div>
  );
};

export default WeightChart;
