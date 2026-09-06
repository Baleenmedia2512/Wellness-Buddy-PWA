export const ACTIVITY_REPORT_TABLE_FILTER_COLUMNS = [
  { id: 'memberType', label: 'Member Type' },
  { id: 'level', label: 'Level' },
  { id: 'sponsorName', label: 'Sponsor' },
  { id: 'clubName', label: 'Club' },
  { id: 'idealCoachName', label: 'Coach' },
  { id: 'city', label: 'City' },
  { id: 'village', label: 'Village' },
];

/** Multi-value separator in filter_<column> query params (values may contain commas). */
export const ACTIVITY_REPORT_FILTER_VALUE_SEP = '|';

export const ACTIVITY_REPORT_ATTENDANCE = {
  ATTENDED: 'attended',
  NOT_ATTENDED: 'not_attended',
};

export const ACTIVITY_REPORT_ATTENDANCE_OPTIONS = [
  { id: ACTIVITY_REPORT_ATTENDANCE.ATTENDED, label: 'Attended' },
  { id: ACTIVITY_REPORT_ATTENDANCE.NOT_ATTENDED, label: 'Not attended' },
];

export function formatActivityReportAttendance(status) {
  return String(status) === ACTIVITY_REPORT_ATTENDANCE.NOT_ATTENDED
    ? 'Not attended'
    : 'Attended';
}

export function emptyActivityReportFilterOptions() {
  return {
    memberType: [],
    level: [],
    sponsorName: [],
    clubName: [],
    idealCoachName: [],
    city: [],
    village: [],
  };
}

export function formatActivityReportFilterOption(column, value) {
  if (column === 'memberType') {
    return String(value).toLowerCase() === 'sponsor' ? 'Sponsor' : 'Member';
  }
  if (column === 'clubName' && (value === '__remote__' || value === 'Remote')) {
    return 'Remote';
  }
  return String(value ?? '');
}

/** Each column holds an array of selected values (multi-select). */
export function emptyActivityReportTableFilterValues() {
  return {
    memberType: [],
    level: [],
    sponsorName: [],
    clubName: [],
    idealCoachName: [],
    city: [],
    village: [],
  };
}

export function normalizeActivityReportFilterValues(raw) {
  if (Array.isArray(raw)) {
    return [...new Set(raw.map((v) => String(v ?? '').trim()).filter(Boolean))];
  }
  const text = String(raw ?? '').trim();
  if (!text) return [];
  if (text.includes(ACTIVITY_REPORT_FILTER_VALUE_SEP)) {
    return [...new Set(text.split(ACTIVITY_REPORT_FILTER_VALUE_SEP).map((v) => v.trim()).filter(Boolean))];
  }
  return [text];
}

export function normalizeActivityReportTableFilters(filters = {}) {
  const next = emptyActivityReportTableFilterValues();
  for (const column of ACTIVITY_REPORT_TABLE_FILTER_COLUMNS) {
    next[column.id] = normalizeActivityReportFilterValues(filters[column.id]);
  }
  return next;
}

export function serializeActivityReportTableFilters(filters = {}) {
  const normalized = normalizeActivityReportTableFilters(filters);
  return ACTIVITY_REPORT_TABLE_FILTER_COLUMNS
    .map((column) => `${column.id}:${normalized[column.id].join(ACTIVITY_REPORT_FILTER_VALUE_SEP)}`)
    .join('||');
}

export function activityReportFilterQuery(filters = {}) {
  const normalized = normalizeActivityReportTableFilters(filters);
  const query = {};
  for (const column of ACTIVITY_REPORT_TABLE_FILTER_COLUMNS) {
    const values = normalized[column.id];
    if (values.length) {
      query[`filter_${column.id}`] = values.join(ACTIVITY_REPORT_FILTER_VALUE_SEP);
    }
  }
  return query;
}

export function toggleActivityReportFilterValue(filters, columnId, value) {
  const normalized = normalizeActivityReportTableFilters(filters);
  const current = normalized[columnId] || [];
  const token = String(value ?? '').trim();
  if (!token) return normalized;
  const exists = current.includes(token);
  normalized[columnId] = exists
    ? current.filter((item) => item !== token)
    : [...current, token];
  return normalized;
}

export function removeActivityReportFilterValue(filters, columnId, value) {
  const normalized = normalizeActivityReportTableFilters(filters);
  const token = String(value ?? '').trim();
  normalized[columnId] = (normalized[columnId] || []).filter((item) => item !== token);
  return normalized;
}

/** One chip per selected value across all columns. */
export function activeActivityReportTableFilters(filters = {}) {
  const normalized = normalizeActivityReportTableFilters(filters);
  const chips = [];
  for (const column of ACTIVITY_REPORT_TABLE_FILTER_COLUMNS) {
    for (const value of normalized[column.id]) {
      chips.push({
        id: `${column.id}:${value}`,
        columnId: column.id,
        label: column.label,
        value,
        displayValue: formatActivityReportFilterOption(column.id, value),
      });
    }
  }
  return chips;
}
