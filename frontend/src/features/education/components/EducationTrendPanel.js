/**
 * EducationTrendPanel.js — trend slide of the swipeable header.
 *
 * Renders the range pills, the totals/active-days summary tiles and
 * the SVG chart (via `EducationTrendChart`). Tracks its own resize
 * observer for the chart container width.
 */
import React, { useEffect, useRef, useState } from 'react';
import EducationTrendChart from './EducationTrendChart';

const RANGE_OPTIONS = [7, 14, 30];

const RangePills = ({ value, onChange }) => (
  <div className="flex items-center gap-1 bg-gray-100 rounded-full p-1">
    {RANGE_OPTIONS.map((days) => (
      <button key={days} type="button" onClick={() => onChange(days)}
        className={`px-2.5 py-1 text-[11px] md:text-xs rounded-full transition-all duration-300 ${
          value === days ? 'bg-emerald-500 text-white shadow-sm' : 'text-gray-600 hover:bg-white'
        }`}>{days}D</button>
    ))}
  </div>
);

const EducationTrendPanel = React.forwardRef(({ series, rangeDays, onRangeChange }, ref) => {
  const [chartWidth, setChartWidth] = useState(0);
  const chartRef = useRef(null);

  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;
    const update = () => {
      const next = Math.floor(el.clientWidth || 0);
      setChartWidth((prev) => (prev === next ? prev : next));
    };
    update();
    if (typeof ResizeObserver !== 'undefined') {
      const obs = new ResizeObserver(update);
      obs.observe(el);
      return () => obs.disconnect();
    }
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [rangeDays, series.length]);

  const totalSessions = series.reduce((sum, p) => sum + (p.value || 0), 0);

  return (
    <div ref={ref} className="w-1/2 shrink-0 px-4 md:px-5 pb-4 md:pb-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs md:text-sm text-gray-500">Education Trend</p>
          <p className="text-sm md:text-base font-semibold text-gray-900">Last {rangeDays} days</p>
        </div>
        <RangePills value={rangeDays} onChange={onRangeChange} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
        <div className="rounded-lg bg-amber-50 px-2 py-1.5">
          <p className="text-[10px] text-amber-700">Total Sessions</p>
          <p className="text-xs md:text-sm font-semibold text-amber-900">
            {totalSessions}/{series.length || rangeDays}
          </p>
        </div>
      </div>
      {series.length === 0 ? (
        <div className="h-36 rounded-xl border border-dashed border-gray-200 flex items-center justify-center text-sm text-gray-500">
          No education trend data
        </div>
      ) : (
        <div ref={chartRef} className="w-full overflow-hidden">
          <EducationTrendChart series={series} width={chartWidth} />
        </div>
      )}
    </div>
  );
});

export default EducationTrendPanel;
