/** Status filter values for weight report chips. */
export const STATUS_FILTERS = {
  ALL: 'all',
  OFF_TRACK: 'off_track',
  ON_TRACK: 'on_track',
  NO_DATA: 'no_data',
};

/** Team scope filter values. */
export const TEAM_SCOPES = {
  MINE: 'mine',
  DIRECT: 'direct',
  FULL: 'full',
};

const NO_DATA_STATUSES = new Set(['no_weight', 'no_height']);
const OFF_TRACK_STATUSES = new Set(['above_ideal', 'below_ideal']);

/** Derive a row's status bucket for filter chips. */
export function getReportRowStatusBucket(row) {
  if (OFF_TRACK_STATUSES.has(row?.status)) return STATUS_FILTERS.OFF_TRACK;
  if (row?.status === 'on_track') return STATUS_FILTERS.ON_TRACK;
  if (NO_DATA_STATUSES.has(row?.status)) return STATUS_FILTERS.NO_DATA;
  return STATUS_FILTERS.NO_DATA;
}

/** Filter rows by active status chip (all = no filter). */
export function filterRowsByStatus(rows, statusFilter) {
  if (!statusFilter || statusFilter === STATUS_FILTERS.ALL) return rows;
  return rows.filter((row) => getReportRowStatusBucket(row) === statusFilter);
}

/** Count rows per status bucket for summary chips within the active team scope. */
export function countRowsByStatus(rows) {
  const counts = rows.reduce(
    (acc, row) => {
      const bucket = getReportRowStatusBucket(row);
      if (bucket === STATUS_FILTERS.OFF_TRACK) acc.off_track += 1;
      else if (bucket === STATUS_FILTERS.ON_TRACK) acc.on_track += 1;
      else acc.no_data += 1;
      return acc;
    },
    { off_track: 0, on_track: 0, no_data: 0, all: 0 },
  );
  counts.all = rows.length;
  return counts;
}

/** Resolve rows for the selected team scope. */
export function getScopeRows(self, members, teamScope) {
  if (teamScope === TEAM_SCOPES.MINE) {
    return self ? [self] : [];
  }
  if (teamScope === TEAM_SCOPES.DIRECT) {
    return members.filter((row) => row.isDirect);
  }
  return members;
}

export const STATUS_FILTER_OPTIONS = [
  { key: STATUS_FILTERS.OFF_TRACK, label: 'Off Track' },
  { key: STATUS_FILTERS.ON_TRACK, label: 'On Track' },
  { key: STATUS_FILTERS.NO_DATA, label: 'No Data' },
  { key: STATUS_FILTERS.ALL, label: 'All' },
];

export const TEAM_SCOPE_OPTIONS = [
  { value: TEAM_SCOPES.MINE, label: 'Mine', short: 'Mine' },
  { value: TEAM_SCOPES.DIRECT, label: 'Direct Team', short: 'Direct' },
  { value: TEAM_SCOPES.FULL, label: 'Full Team', short: 'Full' },
];
