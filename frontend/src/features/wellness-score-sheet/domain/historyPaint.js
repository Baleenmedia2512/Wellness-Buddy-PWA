/**
 * Instant-paint helpers for the Wellness Score sheet.
 * Home already has today's /daily total; the sheet should show that number
 * immediately instead of waiting on a slower /history refetch.
 */

export function rangeKey(startDate, endDate) {
  return `${startDate || ''}__${endDate || ''}`;
}

export function isSingleDayRange(startDate, endDate) {
  return Boolean(startDate && endDate && startDate === endDate);
}

export function snapshotMatchesRange({ snapshot, userId, startDate, endDate }) {
  if (!snapshot || !Array.isArray(snapshot.days)) return false;
  if (userId != null && userId !== '' && snapshot.userId != null
      && String(snapshot.userId) !== String(userId)) {
    return false;
  }
  return snapshot.rangeKey === rangeKey(startDate, endDate);
}

export function asHistoryDay(score, date) {
  if (!score || !date) return null;
  return { ...score, date: score.date || date };
}

/** True when a daily payload is stamped for this YYYY-MM-DD (strict). */
export function scoreIsForDate(score, dateYmd) {
  if (!score || !dateYmd) return false;
  if (score.date == null || score.date === '') return false;
  return String(score.date) === String(dateYmd);
}

/**
 * Home Today/Yesterday must not paint the previous pill's total.
 * Last 10 (no dateYmd) keeps using the parent aggregate.
 */
export function pickLiveDailyScore({ liveScore, parentScore, dateYmd }) {
  if (!dateYmd) return liveScore || parentScore || null;
  if (scoreIsForDate(liveScore, dateYmd)) return liveScore;
  if (scoreIsForDate(parentScore, dateYmd)) return parentScore;
  return null;
}

/** Sheet selected day — never fall back to the only loaded row if its date differs. */
export function selectHistoryDay(historyDays, selectedDate) {
  if (!historyDays?.length) return null;
  if (selectedDate) {
    return historyDays.find((d) => String(d.date) === String(selectedDate)) || null;
  }
  return historyDays.length === 1 ? historyDays[0] : null;
}

/**
 * Days to paint before / while a network fetch runs.
 * Single-day: Home's /daily cache first so the sheet matches the carousel.
 * Else the in-memory sheet snapshot for this range.
 */
export function historyDaysForInstantPaint({
  snapshot,
  userId,
  startDate,
  endDate,
  dailyScore,
}) {
  if (isSingleDayRange(startDate, endDate)) {
    const datedOk = scoreIsForDate(dailyScore, endDate);
    const unstamped = Boolean(dailyScore) && (dailyScore.date == null || dailyScore.date === '');
    if (datedOk || unstamped) {
      const day = asHistoryDay(dailyScore, endDate);
      if (day) return [day];
    }
  }
  if (snapshotMatchesRange({ snapshot, userId, startDate, endDate })) {
    return snapshot.days;
  }
  return [];
}
