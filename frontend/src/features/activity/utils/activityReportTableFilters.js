import {
  formatHierarchyPersonType,
  HIERARCHY_PERSON_TYPE_COLUMN_LABEL,
} from '../../../shared/domain/hierarchyPersonType.js';

export const ACTIVITY_REPORT_TABLE_FILTER_COLUMNS = [
  { id: 'memberType', label: HIERARCHY_PERSON_TYPE_COLUMN_LABEL },
  { id: 'level', label: 'Level' },
  { id: 'clubName', label: 'Club' },
];

/** Multi-value separator in filter_<column> query params (values may contain commas). */
export const ACTIVITY_REPORT_FILTER_VALUE_SEP = '|';

/** API values must match backend `activity-report.attendance` (`posted` / `not_posted`). */
export const ACTIVITY_REPORT_ATTENDANCE = {
  POSTED: 'posted',
  NOT_POSTED: 'not_posted',
};

export const ACTIVITY_REPORT_ATTENDANCE_OPTIONS = [
  { id: ACTIVITY_REPORT_ATTENDANCE.POSTED, label: 'Posted' },
  { id: ACTIVITY_REPORT_ATTENDANCE.NOT_POSTED, label: 'Not Posted' },
];

export function formatActivityReportAttendance(status) {
  const value = String(status || '').trim().toLowerCase().replace(/-/g, '_');
  return value === ACTIVITY_REPORT_ATTENDANCE.NOT_POSTED
    || value === 'not_attended'
    || value === 'notattended'
    ? 'Not Posted'
    : 'Posted';
}

export function emptyActivityReportFilterOptions() {
  return {
    memberType: [],
    level: [],
    clubName: [],
  };
}

export function formatActivityReportFilterOption(column, value) {
  if (column === 'memberType') {
    return formatHierarchyPersonType(value);
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
    clubName: [],
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
  if (!Object.prototype.hasOwnProperty.call(normalized, columnId)) {
    return normalized;
  }
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
  if (!Object.prototype.hasOwnProperty.call(normalized, columnId)) {
    return normalized;
  }
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
