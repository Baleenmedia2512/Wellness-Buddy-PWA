/**
 * Shared sort keys / directions for Wellness Score Report (mirrors backend).
 */

/** @typedef {'score'|'name'|'weight'|'vsPrevious'|'sponsor'} WellnessScoreReportSortKey */
/** @typedef {'asc'|'desc'} WellnessScoreReportSortDir */

/**
 * @typedef {object} WellnessScoreReportRow
 * @property {number} userId
 * @property {string|null} name
 * @property {number|null} todayWeight  Weight logged on the selected score date (null → "—")
 * @property {number|null} previousWeight
 * @property {number|null} difference   todayWeight − previousWeight (kg)
 * @property {number|null} [percentage]
 * @property {number|null} [totalEarned]
 * @property {number|null} [wellnessScore]
 * @property {string|null} sponsor
 * @property {string|null} [computedAt]
 * @property {boolean} [isDirect]
 */

export const REPORT_SORT_KEYS = Object.freeze({
  SCORE: 'score',
  NAME: 'name',
  WEIGHT: 'weight',
  VS_PREVIOUS: 'vsPrevious',
  SPONSOR: 'sponsor',
});

export const REPORT_SORT_DIRS = Object.freeze({
  ASC: 'asc',
  DESC: 'desc',
});

/** First-click default direction per column. */
export const DEFAULT_SORT_DIR_BY_KEY = Object.freeze({
  [REPORT_SORT_KEYS.SCORE]: REPORT_SORT_DIRS.DESC,
  [REPORT_SORT_KEYS.NAME]: REPORT_SORT_DIRS.ASC,
  [REPORT_SORT_KEYS.WEIGHT]: REPORT_SORT_DIRS.ASC,
  [REPORT_SORT_KEYS.VS_PREVIOUS]: REPORT_SORT_DIRS.DESC,
  [REPORT_SORT_KEYS.SPONSOR]: REPORT_SORT_DIRS.ASC,
});

/**
 * @param {WellnessScoreReportSortKey} key
 * @param {WellnessScoreReportSortKey} currentKey
 * @param {WellnessScoreReportSortDir} currentDir
 * @returns {{ sort: WellnessScoreReportSortKey, sortDir: WellnessScoreReportSortDir }}
 */
export function nextReportSortState(key, currentKey, currentDir) {
  if (key === currentKey) {
    return {
      sort: key,
      sortDir: currentDir === REPORT_SORT_DIRS.ASC
        ? REPORT_SORT_DIRS.DESC
        : REPORT_SORT_DIRS.ASC,
    };
  }
  return {
    sort: key,
    sortDir: DEFAULT_SORT_DIR_BY_KEY[key] || REPORT_SORT_DIRS.ASC,
  };
}
