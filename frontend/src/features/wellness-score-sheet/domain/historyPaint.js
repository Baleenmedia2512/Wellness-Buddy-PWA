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
    const day = asHistoryDay(dailyScore, endDate);
    if (day) return [day];
  }
  if (snapshotMatchesRange({ snapshot, userId, startDate, endDate })) {
    return snapshot.days;
  }
  return [];
}
