/**
 * Drop clubs the user just deleted so a stale list response cannot paint them again.
 * @param {Array<{ id?: number|string }>|null|undefined} rows
 * @param {Set<number|string>|Array<number|string>|null|undefined} removedIds
 * @returns {Array}
 */
export function omitRemovedCenters(rows, removedIds) {
  const list = Array.isArray(rows) ? rows : [];
  const ids = removedIds instanceof Set ? removedIds : new Set(removedIds || []);
  if (!ids.size) return list;
  return list.filter((center) => !ids.has(center?.id));
}

/**
 * Map a create/update API row onto the Physical Club list shape.
 * Attendance fields are copied only when the payload actually has them,
 * so an update can keep the counts already shown on the list.
 * @param {object|null|undefined} saved
 * @param {string} [ownerNameFallback]
 * @returns {object|null}
 */
export function toClubListRow(saved, ownerNameFallback = '') {
  if (saved == null || saved.id == null || saved.id === '') return null;
  const row = {
    id: saved.id,
    center_name: saved.center_name || saved.centerName || '',
    latitude: saved.latitude,
    longitude: saved.longitude,
    education_hour: saved.education_hour ?? saved.educationHour ?? null,
    owner_user_id: saved.owner_user_id ?? saved.ownerUserId ?? null,
    owner_phone: saved.owner_phone ?? saved.ownerPhone ?? null,
    ownerName: saved.ownerName || ownerNameFallback || 'Unknown',
  };
  if (saved.todayAttendance != null) row.todayAttendance = saved.todayAttendance;
  if (saved.attendancePercentage != null) row.attendancePercentage = saved.attendancePercentage;
  if (saved.totalParticipants != null) row.totalParticipants = saved.totalParticipants;
  return row;
}

/**
 * Show a club that was just saved without waiting for the list refetch.
 * A new club is placed first. An existing club keeps its attendance counts.
 * @param {Array<object>|null|undefined} rows
 * @param {object|null|undefined} saved
 * @returns {Array<object>}
 */
export function applySavedCenter(rows, saved) {
  const list = Array.isArray(rows) ? rows : [];
  if (saved == null || saved.id == null || saved.id === '') return list;
  const savedId = Number(saved.id);
  const idx = list.findIndex((center) => Number(center?.id) === savedId);
  if (idx === -1) {
    return [{
      todayAttendance: 0,
      attendancePercentage: 0,
      totalParticipants: 0,
      ...saved,
    }, ...list];
  }
  const prev = list[idx];
  const next = list.slice();
  next[idx] = {
    ...prev,
    ...saved,
    ownerName: saved.ownerName || prev.ownerName,
    todayAttendance: saved.todayAttendance ?? prev.todayAttendance ?? 0,
    attendancePercentage: saved.attendancePercentage ?? prev.attendancePercentage ?? 0,
    totalParticipants: saved.totalParticipants ?? prev.totalParticipants ?? 0,
  };
  return next;
}

/**
 * @param {number} previousTotal
 * @param {Array<object>} baseRows rows before the save was applied
 * @param {object} saved
 * @param {boolean} replaceList true when the visible list is not My Club
 * @returns {number}
 */
export function savedCenterTotalRecords(previousTotal, baseRows, saved, replaceList) {
  const base = Array.isArray(baseRows) ? baseRows : [];
  if (replaceList) return 1;
  const existed = base.some((center) => Number(center?.id) === Number(saved?.id));
  const current = Number(previousTotal) || base.length;
  return existed ? current : current + 1;
}
