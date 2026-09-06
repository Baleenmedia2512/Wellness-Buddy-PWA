/**
 * Activity Report attendance filter — attended (logged) vs not attended (no log).
 * Missing / unknown values stay `attended` so older clients keep the legacy table.
 */

export const ACTIVITY_REPORT_ATTENDANCE = Object.freeze({
  ATTENDED: 'attended',
  NOT_ATTENDED: 'not_attended',
});

/**
 * @param {unknown} raw
 * @returns {typeof ACTIVITY_REPORT_ATTENDANCE[keyof typeof ACTIVITY_REPORT_ATTENDANCE]}
 */
export function normalizeActivityReportAttendance(raw) {
  const value = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_');
  if (value === ACTIVITY_REPORT_ATTENDANCE.NOT_ATTENDED || value === 'notattended') {
    return ACTIVITY_REPORT_ATTENDANCE.NOT_ATTENDED;
  }
  return ACTIVITY_REPORT_ATTENDANCE.ATTENDED;
}

export function isNotAttendedActivityReport(raw) {
  return normalizeActivityReportAttendance(raw) === ACTIVITY_REPORT_ATTENDANCE.NOT_ATTENDED;
}

/**
 * Scope members who have no activity log in the selected period.
 * One row per member (period-level), not per missing day.
 *
 * @param {Array<number|string>} scopeUserIds
 * @param {Array<number|string>} attendedUserIds
 * @returns {number[]}
 */
export function missingActivityUserIds(scopeUserIds, attendedUserIds) {
  const attended = new Set(
    (attendedUserIds || [])
      .map((id) => Number(id))
      .filter(Number.isFinite),
  );
  const missing = [];
  const seen = new Set();
  for (const raw of scopeUserIds || []) {
    const id = Number(raw);
    if (!Number.isFinite(id) || attended.has(id) || seen.has(id)) continue;
    seen.add(id);
    missing.push(id);
  }
  return missing;
}

/**
 * User IDs that belong in the detail table for the current attendance filter.
 *
 * @param {unknown} attendanceStatus
 * @param {Array<number|string>} scopeUserIds
 * @param {Array<number|string>} attendedUserIds
 * @returns {number[]}
 */
export function resolveActivityReportTableUserIds(
  attendanceStatus,
  scopeUserIds,
  attendedUserIds,
) {
  if (isNotAttendedActivityReport(attendanceStatus)) {
    return missingActivityUserIds(scopeUserIds, attendedUserIds);
  }
  const seen = new Set();
  const ids = [];
  for (const raw of attendedUserIds || []) {
    const id = Number(raw);
    if (!Number.isFinite(id) || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}
