/**
 * weightChartGeometry.js — pure SVG-trend chart layout helper.
 *
 * Computes line path, sampled marker indices, axis levels and date-label
 * positions. Geometry constants and sampling rules preserved from the
 * legacy `WeightDashboard.js` implementation.
 */

export function buildChartGeometry(weightTrendSeries, weightTrendChartWidth) {
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

  const markerCountTarget = Math.min(7, points.length);
  const sampledMarkerIndices = new Set(
    (() => {
      if (markerCountTarget <= 1) return [points.length - 1];
      if (points.length <= markerCountTarget) return Array.from({ length: points.length }, (_, i) => i);
      return Array.from(
        { length: markerCountTarget },
        (_, i) => Math.round((i * (points.length - 1)) / (markerCountTarget - 1)),
      );
    })(),
  );
  const sampledIndices = Array.from(sampledMarkerIndices).sort((a, b) => a - b);
  const dateLabelIndices = new Set(sampledIndices);
  const orderedDateLabelIndices = Array.from(dateLabelIndices).sort((a, b) => a - b);

  const shouldRenderMarker = (point, index) => point.hasValue && sampledMarkerIndices.has(index);

  const firstVisibleIndex = points.findIndex((p, i) => shouldRenderMarker(p, i));
  let lastVisibleIndex = -1;
  for (let i = points.length - 1; i >= 0; i--) {
    if (shouldRenderMarker(points[i], i)) { lastVisibleIndex = i; break; }
  }
  const firstDateLabelIndex = orderedDateLabelIndices[0] ?? -1;
  const lastDateLabelIndex = orderedDateLabelIndices[orderedDateLabelIndices.length - 1] ?? -1;

  const plottedPoints = sampledIndices.map((i) => points[i]).filter((p) => p.hasValue);
  const linePath = plottedPoints
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
