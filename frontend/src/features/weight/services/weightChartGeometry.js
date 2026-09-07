/**
 * weightChartGeometry.js — pure SVG-trend chart layout helper.
 *
 * Computes line path, sampled marker indices, axis levels and date-label
 * positions. Geometry constants and sampling rules preserved from the
 * legacy `WeightDashboard.js` implementation.
 */

function sampleIndices(length, count) {
  if (length <= 0) return [];
  const target = Math.min(Math.max(1, count), length);
  if (target <= 1) return [length - 1];
  if (length <= target) return Array.from({ length }, (_, i) => i);
  return Array.from(
    { length: target },
    (_, i) => Math.round((i * (length - 1)) / (target - 1)),
  );
}

/**
 * Pick label indices with at least minGapPx between x positions so text does not overlap.
 * Always tries to keep the first and last points.
 */
function sampleDateLabelIndicesByGap(points, maxLabels, minGapPx) {
  const count = points.length;
  if (count === 0) return new Set();
  if (count === 1) return new Set([0]);

  const maxCount = Math.min(Math.max(1, maxLabels), count);
  const minGap = Math.max(1, minGapPx);
  const picked = [0];
  let lastX = points[0].x;

  for (let i = 1; i < count - 1; i += 1) {
    const x = points[i].x;
    const endX = points[count - 1].x;
    if (x - lastX >= minGap && endX - x >= minGap) {
      picked.push(i);
      lastX = x;
    }
  }

  const lastIndex = count - 1;
  const endX = points[lastIndex].x;
  if (endX - points[picked[picked.length - 1]].x < minGap && picked.length > 1) {
    picked.pop();
  }
  if (picked[picked.length - 1] !== lastIndex) picked.push(lastIndex);

  while (picked.length > maxCount) {
    let removeAt = 1;
    let smallestGap = Infinity;
    for (let i = 1; i < picked.length - 1; i += 1) {
      const gap = Math.min(
        points[picked[i]].x - points[picked[i - 1]].x,
        points[picked[i + 1]].x - points[picked[i]].x,
      );
      if (gap < smallestGap) {
        smallestGap = gap;
        removeAt = i;
      }
    }
    picked.splice(removeAt, 1);
  }

  return new Set(picked);
}

function resolvePointX(point, index, plotLeft, stepX, plotWidth, rangeStart, rangeEnd) {
  if (rangeStart && rangeEnd && point.key) {
    const startMs = rangeStart.getTime();
    const endMs = rangeEnd.getTime();
    const spanMs = Math.max(endMs - startMs, 1);
    const [y, m, d] = point.key.split('-').map(Number);
    const pointMs = new Date(y, m - 1, d).getTime();
    const ratio = Math.min(Math.max((pointMs - startMs) / spanMs, 0), 1);
    return plotLeft + ratio * plotWidth;
  }
  return plotLeft + index * stepX;
}

/** Minimum plot width so day labels fit horizontally on narrow screens. */
export function computeTrendChartRenderWidth(containerWidth, rangeStart, rangeEnd, narrowChart) {
  const container = Math.max(containerWidth, 1);
  if (!rangeStart || !rangeEnd) return container;
  const spanMs = Math.max(rangeEnd.getTime() - rangeStart.getTime(), 86400000);
  const spanDays = Math.max(1, Math.round(spanMs / 86400000));
  const minDayPx = narrowChart ? 20 : 14;
  const minWidth = 44 + spanDays * minDayPx;
  return Math.max(container, minWidth);
}

/** Responsive x-axis label density from container width and point count. */
export function computeResponsiveDateLabelOptions(chartWidth, pointCount, small = false) {
  const width = Math.max(chartWidth, 1);
  const count = Math.max(pointCount, 1);
  const minDateLabelGapPx = Math.max(
    small ? 12 : 14,
    Math.floor(width / Math.min(count + 2, 12)),
  );
  const maxDateLabels = Math.min(
    count,
    Math.max(4, Math.floor(width / (small ? 26 : 34))),
  );
  return { minDateLabelGapPx, maxDateLabels };
}

export function buildChartGeometry(weightTrendSeries, weightTrendChartWidth, options = {}) {
  const chartWidth = Math.max(weightTrendChartWidth, 1);
  const chartHeight = 132;
  const numericValues = weightTrendSeries
    .map((p) => p.value).filter((v) => Number.isFinite(v));
  const maxValue = Math.max(...numericValues);
  const minValue = Math.min(...numericValues);
  const spread = Math.max(maxValue - minValue, 0.5);
  const plotLeft = 30;
  const plotRight = 14;
  const plotTopPad = 8;
  const plotBottomPad = 10;
  const plottableHeight = chartHeight - plotTopPad - plotBottomPad;
  const plotWidth = chartWidth - plotLeft - plotRight;
  const rangeStart = options.rangeStart ?? null;
  const rangeEnd = options.rangeEnd ?? null;
  const stepX = weightTrendSeries.length > 1 ? plotWidth / (weightTrendSeries.length - 1) : 0;

  const points = weightTrendSeries.map((point, index) => {
    const hasValue = Number.isFinite(point.value);
    const value = hasValue ? point.value : null;
    const x = resolvePointX(point, index, plotLeft, stepX, plotWidth, rangeStart, rangeEnd);
    const y = hasValue
      ? plotTopPad + plottableHeight - ((value - minValue) / spread) * plottableHeight
      : null;
    return { ...point, value, hasValue, x, y };
  });

  const axisLevels = [maxValue, minValue + spread / 2, minValue]
    .map((v) => Number(v.toFixed(1)));

  const defaultMarkerTarget = Math.min(7, points.length);
  const markerCountTarget = Number.isFinite(options.maxMarkers)
    ? Math.min(Math.max(1, options.maxMarkers), points.length)
    : defaultMarkerTarget;
  const sampledMarkerIndices = new Set(sampleIndices(points.length, markerCountTarget));
  const sampledIndices = Array.from(sampledMarkerIndices).sort((a, b) => a - b);

  const dateLabelCount = Number.isFinite(options.maxDateLabels)
    ? Math.min(Math.max(1, options.maxDateLabels), points.length)
    : markerCountTarget;
  const minDateLabelGapPx = Number.isFinite(options.minDateLabelGapPx)
    ? options.minDateLabelGapPx
    : 40;
  const dateLabelIndices = options.showAllDateLabels
    ? new Set(points.map((_, i) => i))
    : sampleDateLabelIndicesByGap(points, dateLabelCount, minDateLabelGapPx);
  const orderedDateLabelIndices = Array.from(dateLabelIndices).sort((a, b) => a - b);

  const shouldRenderMarker = (point, index) => point.hasValue && sampledMarkerIndices.has(index);

  const firstVisibleIndex = points.findIndex((p, i) => shouldRenderMarker(p, i));
  let lastVisibleIndex = -1;
  for (let i = points.length - 1; i >= 0; i--) {
    if (shouldRenderMarker(points[i], i)) { lastVisibleIndex = i; break; }
  }
  const firstDateLabelIndex = orderedDateLabelIndices[0] ?? -1;
  const lastDateLabelIndex = orderedDateLabelIndices[orderedDateLabelIndices.length - 1] ?? -1;

  const lineSource = options.plotAllPoints
    ? points.filter((p) => p.hasValue)
    : sampledIndices.map((i) => points[i]).filter((p) => p.hasValue);
  const linePath = lineSource
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ');

  return {
    chartWidth, chartHeight, points, axisLevels, linePath,
    plotTopPad, plottableHeight, minValue, spread,
    sampledMarkerIndices, dateLabelIndices,
    firstVisibleIndex, lastVisibleIndex,
    firstDateLabelIndex, lastDateLabelIndex,
    shouldRenderMarker,
  };
}
