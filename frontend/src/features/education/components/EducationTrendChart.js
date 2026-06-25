/**
 * EducationTrendChart.js — SVG line/area chart for the trend slide.
 *
 * Stateless: receives an already-computed series and width and renders
 * the chart with sampled markers + bottom date labels. Behavior
 * preserved from the legacy `EducationDashboard.js` chart block.
 */
import React from 'react';
import { isSmallChartDevice } from '../services/educationDashboardFormatter';

const sampleIndices = (count, target) => {
  if (target <= 1) return [count - 1];
  if (count <= target) return Array.from({ length: count }, (_, i) => i);
  return Array.from({ length: target }, (_, i) => Math.round((i * (count - 1)) / (target - 1)));
};

const EducationTrendChart = ({ series, width }) => {
  const chartWidth = Math.max(width, 1);
  const chartHeight = 120;
  const maxValue = Math.max(...series.map((p) => p.value), 1);
  const plotLeft = 10;
  const plotRight = 14;
  const stepX = series.length > 1 ? (chartWidth - plotLeft - plotRight) / (series.length - 1) : 0;
  const points = series.map((p, i) => ({
    ...p,
    x: plotLeft + i * stepX,
    y: chartHeight - ((p.value || 0) / maxValue) * chartHeight,
  }));

  const sampled = new Set(sampleIndices(points.length, Math.min(7, points.length)));
  const sortedSampled = [...sampled].sort((a, b) => a - b);
  const firstIdx = sortedSampled[0] ?? -1;
  const lastIdx = sortedSampled[sortedSampled.length - 1] ?? -1;
  const linePath = sortedSampled.map((i) => points[i]).map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ');
  const areaPath = `${linePath} L ${chartWidth},${chartHeight} L 0,${chartHeight} Z`;
  const small = isSmallChartDevice();

  return (
    <>
      <svg
        viewBox={`0 -14 ${chartWidth} ${chartHeight + 38}`}
        className="block"
        style={{ width: '100%', height: `${chartHeight + 38}px`, overflow: 'visible' }}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="educationTrendArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.03" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#educationTrendArea)" />
        <path d={linePath} fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => sampled.has(i) && (
          <circle key={p.key} cx={p.x} cy={p.y} r={small ? 2.5 : 3} fill="#f59e0b" />
        ))}
        {points.map((p, i) => {
          if (!sampled.has(i)) return null;
          const isFirst = i === firstIdx, isLast = i === lastIdx;
          const anchor = isFirst ? 'start' : isLast ? 'end' : 'middle';
          const labelX = isFirst ? p.x + 4 : isLast ? p.x - 4 : p.x;
          return (
            <text key={`${p.key}-v`} x={labelX} y={Math.max(p.y - (small ? 5 : 6), -10)}
              textAnchor={anchor} fontSize={small ? 7 : 8} fontWeight="500" fill="#9ca3af">
              {p.value || 0}
            </text>
          );
        })}
      </svg>
      <div className={`relative mt-2 h-4 text-gray-500 ${small ? 'text-[8px]' : 'text-[10px] md:text-xs'}`}>
        {points.map((p, i) => {
          if (!sampled.has(i)) return null;
          const isFirst = i === firstIdx, isLast = i === lastIdx;
          return (
            <span key={`${p.key}-l`} className="absolute whitespace-nowrap"
              style={{
                left: `${(p.x / chartWidth) * 100}%`,
                transform: isFirst ? 'translateX(0)' : isLast ? 'translateX(-100%)' : 'translateX(-50%)',
              }}>{p.label}</span>
          );
        })}
      </div>
    </>
  );
};

export default EducationTrendChart;
