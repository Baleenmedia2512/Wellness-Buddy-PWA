export * from './weightFormService';
export * from './weightDetectionService';
export * from './weight.api';
export {
  buildTrendSeries,
  buildRecordedTrendSeries,
  summarizeTrendSeries,
  getFirstAndLatestRecordedValue,
  getFirstAndLatestRecordedWeight,
  isSmallChartDevice,
  WEIGHT_TREND_RANGE_CUSTOM,
  WEIGHT_TREND_DEFAULT_DAYS,
  REPORTS_WEIGHT_TREND_RANGES,
  getTrendRangeBounds,
  getRecordedSeriesAxisBounds,
} from './weightDashboardFormatter';
export { buildChartGeometry, computeResponsiveDateLabelOptions, computeTrendChartRenderWidth } from './weightChartGeometry';
