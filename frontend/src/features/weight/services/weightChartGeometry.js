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
  const stepX = weightTrendSeries.length > 1
    ? (chartWidth - plotLeft - plotRight) / (weightTrendSeries.length - 1) : 0;

  const points = weightTrendSeries.map((point, index) => {
    const hasValue = Number.isFinite(point.value);
    const value = hasValue ? point.value : null;
    const x = plotLeft + index * stepX;
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
  const dateLabelIndices = new Set(sampleIndices(points.length, dateLabelCount));
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
