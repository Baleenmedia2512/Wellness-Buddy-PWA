/** AI started — food is not in the DB yet; a /daily now is stale and steals bandwidth. */
export const WELLNESS_SCORE_SKIP_REFRESH_SOURCES = new Set([
  'capture-ai-started',
]);

export function shouldSkipWellnessScoreRefresh(source) {
  return WELLNESS_SCORE_SKIP_REFRESH_SOURCES.has(source);
}
