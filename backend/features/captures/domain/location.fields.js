/**
 * Shared helpers for capture-time location fields.
 * Prefer client-supplied values; fall back to captures_table when missing.
 */

export function locationFieldsFromCapture(capture) {
  if (!capture) return {};
  return {
    latitude: capture.Latitude ?? null,
    longitude: capture.Longitude ?? null,
    city: capture.City ?? null,
    village: capture.Village ?? null,
    attendanceType: capture.AttendanceType ?? null,
    nutritionCenterId: capture.NutritionCenterId ?? null,
    centerName: capture.CenterName ?? null,
  };
}

/**
 * Merge request location with capture-stored location.
 * Non-null / non-empty request values win; otherwise use capture.
 */
export function mergeLocationWithCapture(input = {}, capture = null) {
  const fromCapture = locationFieldsFromCapture(capture);
  const pick = (key) => {
    const v = input[key];
    if (v !== undefined && v !== null && v !== '') return v;
    return fromCapture[key] ?? null;
  };
  return {
    latitude: pick('latitude'),
    longitude: pick('longitude'),
    city: pick('city'),
    village: pick('village'),
    attendanceType: pick('attendanceType'),
    nutritionCenterId: pick('nutritionCenterId'),
    centerName: pick('centerName'),
  };
}

/** True when any useful location signal is present. */
export function hasAnyLocationField(fields) {
  if (!fields) return false;
  return Boolean(
    fields.latitude != null ||
      fields.longitude != null ||
      fields.city ||
      fields.village ||
      fields.nutritionCenterId ||
      fields.centerName ||
      fields.attendanceType,
  );
}
