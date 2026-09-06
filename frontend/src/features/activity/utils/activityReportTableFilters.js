export const ACTIVITY_REPORT_TABLE_FILTER_COLUMNS = [
  { id: 'memberType', label: 'Member Type' },
  { id: 'level', label: 'Level' },
  { id: 'sponsorName', label: 'Sponsor' },
  { id: 'clubName', label: 'Club' },
  { id: 'idealCoachName', label: 'Coach' },
  { id: 'city', label: 'City' },
  { id: 'village', label: 'Village' },
];

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

export function emptyActivityReportTableFilterValues() {
  return {
    memberType: '',
    level: '',
    sponsorName: '',
    clubName: '',
    idealCoachName: '',
    city: '',
    village: '',
  };
}

export function serializeActivityReportTableFilters(filters = {}) {
  return ACTIVITY_REPORT_TABLE_FILTER_COLUMNS
    .map((column) => `${column.id}:${String(filters[column.id] || '').trim()}`)
    .join('|');
}

export function activityReportFilterQuery(filters = {}) {
  const query = {};
  for (const column of ACTIVITY_REPORT_TABLE_FILTER_COLUMNS) {
    const value = String(filters[column.id] || '').trim();
    if (value) query[`filter_${column.id}`] = value;
  }
  return query;
}

export function activeActivityReportTableFilters(filters = {}) {
  return ACTIVITY_REPORT_TABLE_FILTER_COLUMNS
    .filter((column) => String(filters[column.id] || '').trim())
    .map((column) => ({
      id: column.id,
      label: column.label,
      value: String(filters[column.id]).trim(),
      displayValue: formatActivityReportFilterOption(column.id, filters[column.id]),
    }));
}
